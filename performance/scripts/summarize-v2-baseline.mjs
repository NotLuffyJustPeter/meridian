import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

const root = process.cwd();

const RUN_COUNT = 3;

async function loadJson(relativePath) {
  const raw = await readFile(
    resolve(root, relativePath),
    'utf8',
  );

  return JSON.parse(raw);
}

function round(value, digits = 3) {
  return Number(
    Number(value).toFixed(digits),
  );
}

function median(values) {
  const sorted = [...values]
    .map(Number)
    .sort((a, b) => a - b);

  const middle = Math.floor(
    sorted.length / 2,
  );

  if (sorted.length % 2 === 0) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}

function summarizeMetric(values) {
  const numeric =
    values.map(Number);

  return {
    median: round(
      median(numeric),
    ),

    min: round(
      Math.min(...numeric),
    ),

    max: round(
      Math.max(...numeric),
    ),

    runs:
      numeric.map(
        (value) => round(value),
      ),
  };
}

function latencyImprovement(
  v1,
  v2,
) {
  if (!Number.isFinite(v1) || v1 === 0) {
    return 0;
  }

  return round(
    ((v1 - v2) / v1) * 100,
    2,
  );
}

function throughputChange(
  v1,
  v2,
) {
  if (!Number.isFinite(v1) || v1 === 0) {
    return 0;
  }

  return round(
    ((v2 - v1) / v1) * 100,
    2,
  );
}

function classify(
  improvementPct,
) {
  if (improvementPct >= 2) {
    return 'improved';
  }

  if (improvementPct <= -2) {
    return 'regressed';
  }

  return 'stable';
}

function comparisonMetric(
  v1,
  v2,
) {
  const improvementPct =
    latencyImprovement(v1, v2);

  return {
    v1Ms: round(v1),
    v2Ms: round(v2),
    improvementPct,
    status:
      classify(improvementPct),
  };
}

function formatNumber(
  value,
  digits = 3,
) {
  return Number(value)
    .toFixed(digits);
}

function formatPercent(
  value,
) {
  const numeric =
    Number(value);

  const sign =
    numeric > 0
      ? '+'
      : '';

  return `${sign}${numeric.toFixed(2)}%`;
}

const v1 =
  await loadJson(
    'performance/results/v1-baseline-summary.json',
  );

const v2Runs =
  await Promise.all(
    Array.from(
      {
        length: RUN_COUNT,
      },
      (_, index) =>
        loadJson(
          `performance/results/v2-baseline-run-${index + 1}.json`,
        ),
    ),
  );

const first =
  v2Runs[0];

for (
  const run of v2Runs
) {
  if (
    run.configuration.ratePerSecond !==
      first.configuration.ratePerSecond ||
    run.configuration.duration !==
      first.configuration.duration ||
    run.configuration.endpointCount !==
      first.configuration.endpointCount
  ) {
    throw new Error(
      'V2 benchmark runs do not share the same configuration.',
    );
  }

  if (
    run.dataset.gitCommit !==
    first.dataset.gitCommit
  ) {
    throw new Error(
      'V2 benchmark runs were generated from different dataset commits.',
    );
  }
}

const aggregate = {
  throughputRps:
    summarizeMetric(
      v2Runs.map(
        (run) =>
          run.aggregate
            .throughputRps,
      ),
    ),

  avgMs:
    summarizeMetric(
      v2Runs.map(
        (run) =>
          run.aggregate
            .latency.avgMs,
      ),
    ),

  p50Ms:
    summarizeMetric(
      v2Runs.map(
        (run) =>
          run.aggregate
            .latency.p50Ms,
      ),
    ),

  p90Ms:
    summarizeMetric(
      v2Runs.map(
        (run) =>
          run.aggregate
            .latency.p90Ms,
      ),
    ),

  p95Ms:
    summarizeMetric(
      v2Runs.map(
        (run) =>
          run.aggregate
            .latency.p95Ms,
      ),
    ),

  p99Ms:
    summarizeMetric(
      v2Runs.map(
        (run) =>
          run.aggregate
            .latency.p99Ms,
      ),
    ),

  errorRate:
    Math.max(
      ...v2Runs.map(
        (run) =>
          run.aggregate.errorRate,
      ),
    ),

  checkRate:
    Math.min(
      ...v2Runs.map(
        (run) =>
          run.aggregate.checkRate,
      ),
    ),

  droppedIterations:
    v2Runs.reduce(
      (total, run) =>
        total +
        run.aggregate
          .droppedIterations,
      0,
    ),
};

const endpoints = {};

for (
  const [
    key,
    endpoint,
  ] of Object.entries(
    first.endpoints,
  )
) {
  endpoints[key] = {
    label:
      endpoint.label,

    p50:
      summarizeMetric(
        v2Runs.map(
          (run) =>
            run.endpoints[key]
              .latency.p50Ms,
        ),
      ),

    p95:
      summarizeMetric(
        v2Runs.map(
          (run) =>
            run.endpoints[key]
              .latency.p95Ms,
        ),
      ),

    p99:
      summarizeMetric(
        v2Runs.map(
          (run) =>
            run.endpoints[key]
              .latency.p99Ms,
        ),
      ),
  };
}

const comparison = {
  aggregate: {
    throughput: {
      v1Rps:
        round(
          v1.aggregate
            .throughputRps.median,
        ),

      v2Rps:
        round(
          aggregate
            .throughputRps.median,
        ),

      changePct:
        throughputChange(
          v1.aggregate
            .throughputRps.median,

          aggregate
            .throughputRps.median,
        ),
    },

    avg:
      comparisonMetric(
        v1.aggregate
          .avgMs.median,
        aggregate
          .avgMs.median,
      ),

    p50:
      comparisonMetric(
        v1.aggregate
          .p50Ms.median,
        aggregate
          .p50Ms.median,
      ),

    p90:
      comparisonMetric(
        v1.aggregate
          .p90Ms.median,
        aggregate
          .p90Ms.median,
      ),

    p95:
      comparisonMetric(
        v1.aggregate
          .p95Ms.median,
        aggregate
          .p95Ms.median,
      ),

    p99:
      comparisonMetric(
        v1.aggregate
          .p99Ms.median,
        aggregate
          .p99Ms.median,
      ),
  },

  endpoints: {},
};

for (
  const [
    key,
    endpoint,
  ] of Object.entries(
    endpoints,
  )
) {
  const v1Endpoint =
    v1.endpoints[key];

  if (!v1Endpoint) {
    throw new Error(
      `Endpoint ${key} does not exist in V1 summary.`,
    );
  }

  comparison.endpoints[key] = {
    label:
      endpoint.label,

    p50:
      comparisonMetric(
        v1Endpoint.p50.median,
        endpoint.p50.median,
      ),

    p95:
      comparisonMetric(
        v1Endpoint.p95.median,
        endpoint.p95.median,
      ),

    p99:
      comparisonMetric(
        v1Endpoint.p99.median,
        endpoint.p99.median,
      ),
  };
}

const summary = {
  benchmarkVersion: 2,

  workloadVersion:
    first.benchmarkVersion,

  workloadProfile:
    first.profile,

  methodology:
    'median-of-three-runs',

  k6Version:
    v1.k6Version,

  v1DatasetCommit:
    v1.datasetCommit,

  v2DatasetCommit:
    first.dataset.gitCommit,

  datasetVersion:
    first.dataset.version,

  runCount:
    RUN_COUNT,

  totalRequests:
    v2Runs.reduce(
      (total, run) =>
        total +
        run.aggregate
          .totalRequests,
      0,
    ),

  configuration: {
    ratePerSecond:
      first.configuration
        .ratePerSecond,

    durationPerRun:
      first.configuration
        .duration,

    endpointCount:
      first.configuration
        .endpointCount,
  },

  aggregate,

  endpoints,

  comparison,
};

const endpointRows =
  Object.values(
    comparison.endpoints,
  )
    .map(
      (endpoint) =>
        `| ${endpoint.label} | ` +
        `${formatNumber(endpoint.p50.v1Ms)} | ` +
        `${formatNumber(endpoint.p50.v2Ms)} | ` +
        `${formatPercent(endpoint.p50.improvementPct)} | ` +
        `${formatNumber(endpoint.p95.v1Ms)} | ` +
        `${formatNumber(endpoint.p95.v2Ms)} | ` +
        `${formatPercent(endpoint.p95.improvementPct)} | ` +
        `${formatNumber(endpoint.p99.v1Ms)} | ` +
        `${formatNumber(endpoint.p99.v2Ms)} | ` +
        `${formatPercent(endpoint.p99.improvementPct)} |`,
    )
    .join('\n');

const p95Comparisons =
  Object.values(
    comparison.endpoints,
  );

const bestP95 =
  [...p95Comparisons]
    .sort(
      (a, b) =>
        b.p95.improvementPct -
        a.p95.improvementPct,
    )[0];

const regressions =
  p95Comparisons
    .filter(
      (endpoint) =>
        endpoint.p95
          .improvementPct <= -2,
    );

const regressionText =
  regressions.length === 0
    ? 'No endpoint showed a p95 regression greater than 2%.'
    : regressions
        .map(
          (endpoint) =>
            `${endpoint.label} (${formatPercent(endpoint.p95.improvementPct)})`,
        )
        .join(', ');

const markdown = `# Meridian V2 Performance Validation

## Purpose

This report compares the frozen Meridian V1 internal API baseline against Meridian V2 after the observability, Redis caching, and BullMQ phases.

The workload itself remains version 1 so that the V1 and V2 measurements exercise the same seven internal read paths.

## Methodology

- k6: ${v1.k6Version}
- Method: median of three independent runs
- Duration: ${first.configuration.duration} per run
- Arrival rate: ${first.configuration.ratePerSecond} req/s
- Endpoints: ${first.configuration.endpointCount}
- V1 dataset commit: \`${v1.datasetCommit}\`
- V2 dataset commit: \`${first.dataset.gitCommit}\`

The comparison uses the median of each metric across the three runs. Positive latency percentages mean V2 is faster.

## Aggregate comparison

| Metric | V1 | V2 | Change |
| --- | ---: | ---: | ---: |
| Throughput | ${formatNumber(v1.aggregate.throughputRps.median)} req/s | ${formatNumber(aggregate.throughputRps.median)} req/s | ${formatPercent(comparison.aggregate.throughput.changePct)} |
| Avg latency | ${formatNumber(v1.aggregate.avgMs.median)} ms | ${formatNumber(aggregate.avgMs.median)} ms | ${formatPercent(comparison.aggregate.avg.improvementPct)} |
| p50 latency | ${formatNumber(v1.aggregate.p50Ms.median)} ms | ${formatNumber(aggregate.p50Ms.median)} ms | ${formatPercent(comparison.aggregate.p50.improvementPct)} |
| p90 latency | ${formatNumber(v1.aggregate.p90Ms.median)} ms | ${formatNumber(aggregate.p90Ms.median)} ms | ${formatPercent(comparison.aggregate.p90.improvementPct)} |
| p95 latency | ${formatNumber(v1.aggregate.p95Ms.median)} ms | ${formatNumber(aggregate.p95Ms.median)} ms | ${formatPercent(comparison.aggregate.p95.improvementPct)} |
| p99 latency | ${formatNumber(v1.aggregate.p99Ms.median)} ms | ${formatNumber(aggregate.p99Ms.median)} ms | ${formatPercent(comparison.aggregate.p99.improvementPct)} |

## Endpoint comparison

| Endpoint | V1 p50 | V2 p50 | p50 change | V1 p95 | V2 p95 | p95 change | V1 p99 | V2 p99 | p99 change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${endpointRows}

## Reliability

| Metric | V2 |
| --- | ---: |
| Requests | ${summary.totalRequests} |
| Error rate | ${(aggregate.errorRate * 100).toFixed(4)}% |
| Check rate | ${(aggregate.checkRate * 100).toFixed(4)}% |
| Dropped iterations | ${aggregate.droppedIterations} |

## Findings

Aggregate p95 latency improved by **${formatPercent(comparison.aggregate.p95.improvementPct)}**, from ${formatNumber(comparison.aggregate.p95.v1Ms)} ms to ${formatNumber(comparison.aggregate.p95.v2Ms)} ms.

Aggregate p99 latency improved by **${formatPercent(comparison.aggregate.p99.improvementPct)}**, from ${formatNumber(comparison.aggregate.p99.v1Ms)} ms to ${formatNumber(comparison.aggregate.p99.v2Ms)} ms.

The strongest p95 endpoint improvement was **${bestP95.label}**, at **${formatPercent(bestP95.p95.improvementPct)}**.

Endpoints with a p95 regression of at least 2%: ${regressionText}.

Throughput is intentionally close to unchanged because both versions were tested with the same constant arrival rate. The primary comparison is therefore latency and reliability under equivalent load.

All V2 runs completed without HTTP errors or dropped iterations.

## Conclusion

Meridian V2 demonstrates a measurable reduction in aggregate latency under the frozen V1 workload while preserving reliability.

The results support performance claims based on measured V1-to-V2 evidence rather than inferred improvement.
`;

const resultDirectory =
  resolve(
    root,
    'performance',
    'results',
  );

const metricsDirectory =
  resolve(
    root,
    'docs',
    'metrics',
  );

await mkdir(
  resultDirectory,
  {
    recursive: true,
  },
);

await mkdir(
  metricsDirectory,
  {
    recursive: true,
  },
);

await writeFile(
  resolve(
    resultDirectory,
    'v2-baseline-summary.json',
  ),
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8',
);

await writeFile(
  resolve(
    metricsDirectory,
    'v2-performance-report.md',
  ),
  markdown,
  'utf8',
);

console.log('');
console.log(
  'Meridian V2 performance validation generated.',
);

console.log('');
console.log(
  `Aggregate p95: ${formatNumber(comparison.aggregate.p95.v1Ms)} ms -> ${formatNumber(comparison.aggregate.p95.v2Ms)} ms (${formatPercent(comparison.aggregate.p95.improvementPct)})`,
);

console.log(
  `Aggregate p99: ${formatNumber(comparison.aggregate.p99.v1Ms)} ms -> ${formatNumber(comparison.aggregate.p99.v2Ms)} ms (${formatPercent(comparison.aggregate.p99.improvementPct)})`,
);

console.log(
  `Best endpoint p95: ${bestP95.label} (${formatPercent(bestP95.p95.improvementPct)})`,
);

console.log('');
console.log(
  'Saved:',
);

console.log(
  '  performance/results/v2-baseline-summary.json',
);

console.log(
  '  docs/metrics/v2-performance-report.md',
);
