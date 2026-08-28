import {
  readFile,
  writeFile,
  mkdir,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

const root = process.cwd();

async function loadJson(path) {
  const raw =
    await readFile(
      resolve(root, path),
      'utf8',
    );

  const normalized =
    raw.replace(/^\uFEFF/, '');

  return JSON.parse(
    normalized,
  );
}

function median(values) {
  const sorted =
    [...values].sort(
      (a, b) => a - b,
    );

  return sorted[
    Math.floor(
      sorted.length / 2,
    )
  ];
}

function fixed(
  value,
  digits = 3,
) {
  return Number(
    value,
  ).toFixed(digits);
}

const runs =
  await Promise.all(
    [1, 2, 3].map(
      (run) =>
        loadJson(
          `performance/results/v1-baseline-run-${run}.json`,
        ),
    ),
  );

const providers =
  await loadJson(
    'performance/results/v1-provider-baseline.json',
  );

const sql =
  await loadJson(
    'performance/results/v1-sql-baseline.json',
  );

const totalRequests =
  runs.reduce(
    (sum, run) =>
      sum +
      run.aggregate.totalRequests,
    0,
  );

const metric = (
  selector,
) =>
  median(
    runs.map(selector),
  );

const p50 =
  metric(
    (run) =>
      run.aggregate.latency.p50Ms,
  );

const p95 =
  metric(
    (run) =>
      run.aggregate.latency.p95Ms,
  );

const p99 =
  metric(
    (run) =>
      run.aggregate.latency.p99Ms,
  );

const throughput =
  metric(
    (run) =>
      run.aggregate.throughputRps,
  );

const endpoints =
  Object.keys(
    runs[0].endpoints,
  ).map(
    (key) => ({
      label:
        runs[0].endpoints[key].label,

      p50:
        metric(
          (run) =>
            run.endpoints[key]
              .latency.p50Ms,
        ),

      p95:
        metric(
          (run) =>
            run.endpoints[key]
              .latency.p95Ms,
        ),

      p99:
        metric(
          (run) =>
            run.endpoints[key]
              .latency.p99Ms,
        ),
    }),
  );

const endpointRows =
  endpoints
    .map(
      (endpoint) =>
        `| ${endpoint.label} | ${fixed(endpoint.p50)} | ${fixed(endpoint.p95)} | ${fixed(endpoint.p99)} |`,
    )
    .join('\n');

const report = `# Meridian V1 Baseline Report

## Purpose

This document freezes Meridian V1 performance before the V2 performance and platform engineering work.

The V2 comparison must reuse the same benchmark dataset, workload shape, request rate, run duration, and aggregation methodology whenever the comparison is intended to measure application-level improvement.

---

## Internal API baseline

Tool: k6 2.2.0

- Runs: 3
- Duration: 5 minutes per run
- Target arrival rate: 4 requests/second
- Total workload requests: ${totalRequests}
- HTTP errors: 0%
- Failed checks: 0
- Dropped iterations: 0

Representative values are the median of the corresponding metric across the three independent runs. They are not pooled request-level percentiles.

| Metric | V1 baseline |
| --- | ---: |
| Throughput | ${fixed(throughput, 4)} req/s |
| p50 | ${fixed(p50)} ms |
| p95 | ${fixed(p95)} ms |
| p99 | ${fixed(p99)} ms |

### Endpoint latency

| Endpoint | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: |
${endpointRows}

---

## PostgreSQL baseline

### Trips

- Plan: ${sql.trips.plan}
- Index used: \`${sql.trips.index}\`
- Rows returned: ${sql.trips.rows}
- EXPLAIN execution time: ${fixed(sql.trips.executionTimeMs)} ms
- No additional index justified by this measurement.

### Itinerary

The V1 read path performs an access check, membership lookup, itinerary-day materialization attempt, trip-day lookup, and activity lookup.

The GET path attempts to insert ${sql.itinerary.writeRowsAttemptedPerGet} trip-day rows using:

\`INSERT ... ON CONFLICT DO NOTHING\`

even after the itinerary days already exist.

Observed execute durations:

| Operation | Execute ms |
| --- | ---: |
| Access query | ${fixed(sql.itinerary.accessExecuteMs)} |
| Membership query | ${fixed(sql.itinerary.membershipExecuteMs)} |
| Trip-day INSERT attempt | ${fixed(sql.itinerary.insertExecuteMs)} |
| Trip-day SELECT | ${fixed(sql.itinerary.tripDaysExecuteMs)} |
| Activities SELECT | ${fixed(sql.itinerary.activitiesExecuteMs)} |

Primary V2 optimization candidate:

**Remove unnecessary repeated write-on-read behavior while preserving itinerary creation semantics.**

### Expenses

- Rows: ${sql.expenses.rows}
- Plan: ${sql.expenses.plan}
- Sort memory: ${sql.expenses.sortMemoryKb} kB
- EXPLAIN execution: ${fixed(sql.expenses.explainExecutionTimeMs)} ms
- Prisma execution observed: ${fixed(sql.expenses.prismaExecuteTimeMs)} ms

The sequential scan is appropriate at the current dataset scale. No index change is justified solely to remove the Seq Scan.

### Budget overview

The endpoint performs six logical database operations including access validation, budget retrieval, category-limit retrieval, expense aggregation, and grouping by category.

Individual observed execute durations:

| Operation | Execute ms |
| --- | ---: |
| Access | ${fixed(sql.budgetOverview.accessExecuteMs)} |
| Membership | ${fixed(sql.budgetOverview.membershipExecuteMs)} |
| Expense SUM + COUNT | ${fixed(sql.budgetOverview.aggregateExecuteMs)} |
| Expense GROUP BY | ${fixed(sql.budgetOverview.groupByExecuteMs)} |
| Budget | ${fixed(sql.budgetOverview.budgetExecuteMs)} |
| Category limits | ${fixed(sql.budgetOverview.categoryLimitsExecuteMs)} |

These durations are not summed and presented as endpoint wall-clock time because some operations are issued concurrently.

---

## External provider baseline

External providers were tested sequentially rather than load-tested.

### Geocoding â€” Nominatim

Query: \`Duomo di Milano\`

| Run | Latency |
| ---: | ---: |
| 1 | ${fixed(providers.runs.find((r) => r.providerTest === 'geocoding' && r.run === 1).elapsedMs)} ms |
| 2 | ${fixed(providers.runs.find((r) => r.providerTest === 'geocoding' && r.run === 2).elapsedMs)} ms |
| 3 | ${fixed(providers.runs.find((r) => r.providerTest === 'geocoding' && r.run === 3).elapsedMs)} ms |

Median: **${fixed(providers.geocoding.medianMs)} ms**

The first request shows substantially higher latency than subsequent requests. The cause is not attributed to any single caching layer without additional instrumentation.

### Weather â€” Open-Meteo

| Run | Latency |
| ---: | ---: |
| 1 | ${fixed(providers.runs.find((r) => r.providerTest === 'weather' && r.run === 1).elapsedMs)} ms |
| 2 | ${fixed(providers.runs.find((r) => r.providerTest === 'weather' && r.run === 2).elapsedMs)} ms |
| 3 | ${fixed(providers.runs.find((r) => r.providerTest === 'weather' && r.run === 3).elapsedMs)} ms |

Median: **${fixed(providers.weather.medianMs)} ms**

The benchmark trip returned \`OUT_OF_RANGE\` because its dates were outside the available forecast window at measurement time. The request still exercised the Meridian weather integration and returned HTTP 200.

---

## V1 conclusions

1. Meridian sustained the benchmark workload at approximately 4 req/s with zero HTTP errors, zero failed checks, and zero dropped iterations.

2. Internal API latency is already low at the current dataset scale.

3. No PostgreSQL index change is currently justified by measured evidence.

4. The clearest database-related inefficiency is itinerary write-on-read behavior.

5. External provider latency is orders of magnitude larger than internal database execution time, making Redis caching a strong candidate for weather and geocoding paths.

6. Future V2 performance claims must be measured against this frozen baseline rather than inferred.

---

## Baseline status

Meridian V1 performance baseline: **FROZEN**
`;

await mkdir(
  resolve(
    root,
    'docs',
    'metrics',
  ),
  {
    recursive: true,
  },
);

await writeFile(
  resolve(
    root,
    'docs',
    'metrics',
    'v1-baseline-report.md',
  ),
  report,
  'utf8',
);

console.log(
  'Meridian V1 baseline report generated.',
);

console.log(
  `Requests: ${totalRequests}`,
);

console.log(
  `p50: ${fixed(p50)} ms`,
);

console.log(
  `p95: ${fixed(p95)} ms`,
);

console.log(
  `p99: ${fixed(p99)} ms`,
);

console.log(
  `Geocoding median: ${fixed(providers.geocoding.medianMs)} ms`,
);

console.log(
  `Weather median: ${fixed(providers.weather.medianMs)} ms`,
);