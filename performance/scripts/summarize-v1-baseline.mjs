import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const RUN_COUNT = 3;
const K6_VERSION = '2.2.0';

const files = Array.from(
  { length: RUN_COUNT },
  (_, index) =>
    resolve(
      process.cwd(),
      'performance',
      'results',
      `v1-baseline-run-${index + 1}.json`,
    ),
);

function median(values) {
  const sorted = [...values].sort(
    (a, b) => a - b,
  );

  const middle =
    Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}

function range(values) {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function round(value, digits = 3) {
  return Number(
    value.toFixed(digits),
  );
}

function format(value, digits = 3) {
  return Number(value).toFixed(digits);
}

async function loadRuns() {
  return Promise.all(
    files.map(async (file) => {
      const content =
        await readFile(file, 'utf8');

      return JSON.parse(content);
    }),
  );
}

function validateRuns(runs) {
  const commits =
    new Set(
      runs.map(
        (run) =>
          run.dataset.gitCommit,
      ),
    );

  if (commits.size !== 1) {
    throw new Error(
      'Runs were executed against different dataset commits.',
    );
  }

  for (
    const [index, run] of
    runs.entries()
  ) {
    if (
      run.aggregate.errorRate !== 0
    ) {
      throw new Error(
        `Run ${index + 1} contains HTTP errors.`,
      );
    }

    if (
      run.aggregate.checkRate !== 1
    ) {
      throw new Error(
        `Run ${index + 1} contains failed checks.`,
      );
    }

    if (
      run.aggregate.droppedIterations !== 0
    ) {
      throw new Error(
        `Run ${index + 1} contains dropped iterations.`,
      );
    }

    if (
      run.configuration.ratePerSecond !== 4
    ) {
      throw new Error(
        `Run ${index + 1} does not use 4 req/s.`,
      );
    }

    if (
      run.configuration.duration !== '5m'
    ) {
      throw new Error(
        `Run ${index + 1} does not use a 5m duration.`,
      );
    }
  }
}

function summarizeMetric(
  runs,
  selector,
) {
  const values =
    runs.map(selector);

  const valueRange =
    range(values);

  return {
    median:
      round(median(values)),
    min:
      round(valueRange.min),
    max:
      round(valueRange.max),
    runs:
      values.map(
        (value) => round(value),
      ),
  };
}

function summarizeEndpoints(runs) {
  const endpointNames =
    Object.keys(
      runs[0].endpoints,
    );

  const result = {};

  for (
    const name of endpointNames
  ) {
    const label =
      runs[0].endpoints[
        name
      ].label;

    result[name] = {
      label,

      p50:
        summarizeMetric(
          runs,
          (run) =>
            run.endpoints[name]
              .latency.p50Ms,
        ),

      p95:
        summarizeMetric(
          runs,
          (run) =>
            run.endpoints[name]
              .latency.p95Ms,
        ),

      p99:
        summarizeMetric(
          runs,
          (run) =>
            run.endpoints[name]
              .latency.p99Ms,
        ),
    };
  }

  return result;
}

async function main() {
  const runs =
    await loadRuns();

  validateRuns(runs);

  const totalRequests =
    runs.reduce(
      (sum, run) =>
        sum +
        run.aggregate.totalRequests,
      0,
    );

  const aggregate = {
    throughputRps:
      summarizeMetric(
        runs,
        (run) =>
          run.aggregate
            .throughputRps,
      ),

    avgMs:
      summarizeMetric(
        runs,
        (run) =>
          run.aggregate
            .latency.avgMs,
      ),

    p50Ms:
      summarizeMetric(
        runs,
        (run) =>
          run.aggregate
            .latency.p50Ms,
      ),

    p90Ms:
      summarizeMetric(
        runs,
        (run) =>
          run.aggregate
            .latency.p90Ms,
      ),

    p95Ms:
      summarizeMetric(
        runs,
        (run) =>
          run.aggregate
            .latency.p95Ms,
      ),

    p99Ms:
      summarizeMetric(
        runs,
        (run) =>
          run.aggregate
            .latency.p99Ms,
      ),

    errorRate: 0,
    checkRate: 1,
    droppedIterations: 0,
  };

  const endpoints =
    summarizeEndpoints(runs);

  const summary = {
    benchmarkVersion: 1,
    methodology:
      'median-of-three-runs',
    k6Version:
      K6_VERSION,
    datasetCommit:
      runs[0].dataset.gitCommit,
    datasetVersion:
      runs[0].dataset.version,
    runCount:
      RUN_COUNT,
    totalRequests,
    configuration: {
      ratePerSecond: 4,
      durationPerRun: '5m',
      endpointCount:
        runs[0].configuration
          .endpointCount,
    },
    aggregate,
    endpoints,
  };

  const endpointRows =
    Object.values(endpoints)
      .map(
        (endpoint) =>
          `| ${endpoint.label} | ${format(endpoint.p50.median)} | ${format(endpoint.p95.median)} | ${format(endpoint.p99.median)} |`,
      )
      .join('\n');

  const runRows =
    runs
      .map(
        (run, index) =>
          `| ${index + 1} | ${run.aggregate.totalRequests} | ${format(run.aggregate.throughputRps, 4)} | ${format(run.aggregate.latency.p50Ms)} | ${format(run.aggregate.latency.p95Ms)} | ${format(run.aggregate.latency.p99Ms)} |`,
      )
      .join('\n');

  const markdown = `# Meridian V1 Performance Baseline

## Methodology

This baseline represents Meridian V1 before Redis caching, background workers, observability instrumentation, and PostgreSQL performance tuning.

- k6: ${K6_VERSION}
- Runs: ${RUN_COUNT}
- Duration per run: 5 minutes
- Arrival rate: 4 requests/second
- Total workload requests: ${totalRequests}
- Dataset version: ${runs[0].dataset.version}
- Dataset commit: \`${runs[0].dataset.gitCommit}\`
- HTTP errors: 0
- Failed checks: 0
- Dropped iterations: 0

The representative values below are the median of the corresponding metric across three independent runs. They are not pooled request-level percentiles.

## Aggregate baseline

| Metric | Median | Min run | Max run |
| --- | ---: | ---: | ---: |
| Throughput (req/s) | ${format(aggregate.throughputRps.median, 4)} | ${format(aggregate.throughputRps.min, 4)} | ${format(aggregate.throughputRps.max, 4)} |
| Average latency (ms) | ${format(aggregate.avgMs.median)} | ${format(aggregate.avgMs.min)} | ${format(aggregate.avgMs.max)} |
| p50 latency (ms) | ${format(aggregate.p50Ms.median)} | ${format(aggregate.p50Ms.min)} | ${format(aggregate.p50Ms.max)} |
| p90 latency (ms) | ${format(aggregate.p90Ms.median)} | ${format(aggregate.p90Ms.min)} | ${format(aggregate.p90Ms.max)} |
| p95 latency (ms) | ${format(aggregate.p95Ms.median)} | ${format(aggregate.p95Ms.min)} | ${format(aggregate.p95Ms.max)} |
| p99 latency (ms) | ${format(aggregate.p99Ms.median)} | ${format(aggregate.p99Ms.min)} | ${format(aggregate.p99Ms.max)} |

## Endpoint baseline

| Endpoint | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: |
${endpointRows}

## Individual runs

| Run | Requests | req/s | p50 ms | p95 ms | p99 ms |
| ---: | ---: | ---: | ---: | ---: | ---: |
${runRows}

## Interpretation

The itinerary and expenses read paths are the highest-latency endpoints in the current internal workload.

Run 3 was slower than Runs 1 and 2 while still completing with zero HTTP errors, zero dropped iterations, and a 100% check rate. It is retained as part of the baseline rather than discarded.

This exact methodology must be reused for the Meridian V2 comparison.
`;

  const metricsDirectory =
    resolve(
      process.cwd(),
      'docs',
      'metrics',
    );

  await mkdir(
    metricsDirectory,
    {
      recursive: true,
    },
  );

  const resultDirectory =
    resolve(
      process.cwd(),
      'performance',
      'results',
    );

  await writeFile(
    resolve(
      resultDirectory,
      'v1-baseline-summary.json',
    ),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );

  await writeFile(
    resolve(
      metricsDirectory,
      'v1-k6-baseline.md',
    ),
    markdown,
    'utf8',
  );

  console.log(
    'Meridian V1 k6 baseline summarized.',
  );

  console.log(
    `Total requests: ${totalRequests}`,
  );

  console.log(
    `p50: ${format(aggregate.p50Ms.median)} ms`,
  );

  console.log(
    `p95: ${format(aggregate.p95Ms.median)} ms`,
  );

  console.log(
    `p99: ${format(aggregate.p99Ms.median)} ms`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});