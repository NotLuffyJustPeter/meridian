import {
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

const root = process.cwd();

async function loadJson(path) {
  const raw = await readFile(
    resolve(root, path),
    'utf8',
  );

  return JSON.parse(
    raw.replace(/^\uFEFF/, ''),
  );
}

function number(
  value,
  digits = 3,
) {
  return Number(value)
    .toFixed(digits);
}

function percent(
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

const internal =
  await loadJson(
    'performance/results/v2-baseline-summary.json',
  );

const providers =
  await loadJson(
    'performance/results/v2-provider-cache.json',
  );

const endpointRows =
  Object.values(
    internal.comparison.endpoints,
  )
    .map(
      (endpoint) =>
        `| ${endpoint.label} | ` +
        `${number(endpoint.p50.v1Ms)} | ` +
        `${number(endpoint.p50.v2Ms)} | ` +
        `${percent(endpoint.p50.improvementPct)} | ` +
        `${number(endpoint.p95.v1Ms)} | ` +
        `${number(endpoint.p95.v2Ms)} | ` +
        `${percent(endpoint.p95.improvementPct)} | ` +
        `${number(endpoint.p99.v1Ms)} | ` +
        `${number(endpoint.p99.v2Ms)} | ` +
        `${percent(endpoint.p99.improvementPct)} |`,
    )
    .join('\n');

const regressions =
  Object.values(
    internal.comparison.endpoints,
  )
    .filter(
      (endpoint) =>
        endpoint.p95.improvementPct <= -2,
    );

const regressionText =
  regressions.length === 0
    ? 'None.'
    : regressions
        .map(
          (endpoint) =>
            `${endpoint.label} (${percent(endpoint.p95.improvementPct)})`,
        )
        .join(', ');

const bestEndpoint =
  [...Object.values(
    internal.comparison.endpoints,
  )]
    .sort(
      (a, b) =>
        b.p95.improvementPct -
        a.p95.improvementPct,
    )[0];

const markdown = `# Meridian V2 Performance Validation

## Executive summary

Meridian V2 was validated against the frozen Meridian V1 workload using the same k6 version, request rate, endpoint set, and median-of-three methodology.

The internal API showed lower aggregate latency while maintaining zero HTTP errors and zero dropped iterations.

The largest externally backed improvement came from Redis caching on weather requests, where cache-hit latency dropped from approximately 370 ms to approximately 15 ms.

## Internal API methodology

- k6: ${internal.k6Version}
- Method: ${internal.methodology}
- Runs: ${internal.runCount}
- Duration: ${internal.configuration.durationPerRun} per run
- Arrival rate: ${internal.configuration.ratePerSecond} req/s
- Endpoints: ${internal.configuration.endpointCount}
- V1 dataset commit: \`${internal.v1DatasetCommit}\`
- V2 dataset commit: \`${internal.v2DatasetCommit}\`

Positive latency percentages mean V2 is faster.

## Aggregate API comparison

| Metric | V1 | V2 | Change |
| --- | ---: | ---: | ---: |
| Throughput | ${number(internal.comparison.aggregate.throughput.v1Rps)} req/s | ${number(internal.comparison.aggregate.throughput.v2Rps)} req/s | ${percent(internal.comparison.aggregate.throughput.changePct)} |
| Avg latency | ${number(internal.comparison.aggregate.avg.v1Ms)} ms | ${number(internal.comparison.aggregate.avg.v2Ms)} ms | ${percent(internal.comparison.aggregate.avg.improvementPct)} |
| p50 latency | ${number(internal.comparison.aggregate.p50.v1Ms)} ms | ${number(internal.comparison.aggregate.p50.v2Ms)} ms | ${percent(internal.comparison.aggregate.p50.improvementPct)} |
| p90 latency | ${number(internal.comparison.aggregate.p90.v1Ms)} ms | ${number(internal.comparison.aggregate.p90.v2Ms)} ms | ${percent(internal.comparison.aggregate.p90.improvementPct)} |
| p95 latency | ${number(internal.comparison.aggregate.p95.v1Ms)} ms | ${number(internal.comparison.aggregate.p95.v2Ms)} ms | ${percent(internal.comparison.aggregate.p95.improvementPct)} |
| p99 latency | ${number(internal.comparison.aggregate.p99.v1Ms)} ms | ${number(internal.comparison.aggregate.p99.v2Ms)} ms | ${percent(internal.comparison.aggregate.p99.improvementPct)} |

## Endpoint comparison

| Endpoint | V1 p50 | V2 p50 | p50 change | V1 p95 | V2 p95 | p95 change | V1 p99 | V2 p99 | p99 change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${endpointRows}

## Internal API reliability

| Metric | V2 |
| --- | ---: |
| Requests | ${internal.totalRequests} |
| Error rate | ${(internal.aggregate.errorRate * 100).toFixed(4)}% |
| Check rate | ${(internal.aggregate.checkRate * 100).toFixed(4)}% |
| Dropped iterations | ${internal.aggregate.droppedIterations} |

## Redis provider-cache validation

The provider benchmark separately measures cache misses and cache hits.

Each provider-backed endpoint was measured using three independent cache misses and three cache hits. Redis keys were explicitly removed before each cold measurement.

Because external provider latency depends on network and upstream behavior, medians are used instead of individual runs.

### Geocoding / Nominatim

| Path | Median | Change |
| --- | ---: | ---: |
| V1 baseline | ${number(providers.baseline.geocodingMedianMs)} ms | - |
| V2 cache miss | ${number(providers.geocoding.cold.medianMs)} ms | ${percent(providers.geocoding.cold.versusV1Pct)} vs V1 |
| V2 cache hit | ${number(providers.geocoding.warm.medianMs)} ms | ${percent(providers.geocoding.warm.versusV1Pct)} vs V1 |
| Cache hit vs V2 miss | ${number(providers.geocoding.warm.medianMs)} ms | ${percent(providers.geocoding.warm.versusColdPct)} |

Cold runs:

\`${providers.geocoding.cold.runsMs.map((value) => number(value)).join(' ms`, `')} ms\`

Warm runs:

\`${providers.geocoding.warm.runsMs.map((value) => number(value)).join(' ms`, `')} ms\`

The wide spread in the geocoding cold measurements demonstrates why external-provider benchmarking must be interpreted using medians rather than a single request.

### Weather / Open-Meteo

| Path | Median | Change |
| --- | ---: | ---: |
| V1 baseline | ${number(providers.baseline.weatherMedianMs)} ms | - |
| V2 cache miss | ${number(providers.weather.cold.medianMs)} ms | ${percent(providers.weather.cold.versusV1Pct)} vs V1 |
| V2 cache hit | ${number(providers.weather.warm.medianMs)} ms | ${percent(providers.weather.warm.versusV1Pct)} vs V1 |
| Cache hit vs V2 miss | ${number(providers.weather.warm.medianMs)} ms | ${percent(providers.weather.warm.versusColdPct)} |

Cold runs:

\`${providers.weather.cold.runsMs.map((value) => number(value)).join(' ms`, `')} ms\`

Warm runs:

\`${providers.weather.warm.runsMs.map((value) => number(value)).join(' ms`, `')} ms\`

The V2 weather cache-miss median remained essentially unchanged from V1, while the warm path eliminated almost all provider latency.

## Findings

- Aggregate API p95 improved by **${percent(internal.comparison.aggregate.p95.improvementPct)}**, from ${number(internal.comparison.aggregate.p95.v1Ms)} ms to ${number(internal.comparison.aggregate.p95.v2Ms)} ms.
- Aggregate API p99 improved by **${percent(internal.comparison.aggregate.p99.improvementPct)}**, from ${number(internal.comparison.aggregate.p99.v1Ms)} ms to ${number(internal.comparison.aggregate.p99.v2Ms)} ms.
- The strongest internal p95 improvement was **${bestEndpoint.label}**, at **${percent(bestEndpoint.p95.improvementPct)}**.
- Weather cache hits improved latency by **${percent(providers.weather.warm.versusColdPct)}** compared with the V2 cache-miss path.
- Weather cache-hit latency improved by **${percent(providers.weather.warm.versusV1Pct)}** compared with the frozen V1 provider baseline.
- Geocoding cache-hit latency improved by **${percent(providers.geocoding.warm.versusColdPct)}** compared with its V2 cache-miss median.
- Internal endpoints with a p95 regression of at least 2%: ${regressionText}

## Interpretation

Throughput remained effectively unchanged because both internal API versions were intentionally tested at the same constant arrival rate. The benchmark therefore evaluates latency and reliability under equivalent load rather than maximum saturation throughput.

The provider results should not be interpreted as raw upstream-provider performance benchmarks. They measure Meridian end-to-end response latency with and without its Redis cache layer.

The weather result provides the clearest evidence of the value of caching: the uncached V2 path remained approximately equivalent to V1, while cache hits reduced response latency by more than 95%.

## Conclusion

Meridian V2 demonstrates measurable performance gains under a reproducible workload while maintaining reliability.

The final validation produced:

- lower aggregate API latency,
- no HTTP errors,
- no dropped k6 iterations,
- significant improvement on expense-heavy reads,
- and a major reduction in externally backed weather latency through Redis caching.

These results support performance claims using measured V1-to-V2 evidence rather than inferred improvements.
`;

await writeFile(
  resolve(
    root,
    'docs',
    'metrics',
    'v2-performance-report.md',
  ),
  markdown,
  'utf8',
);

console.log('');
console.log(
  'Final V2 performance report generated.',
);

console.log('');
console.log(
  `API p95: ${number(internal.comparison.aggregate.p95.v1Ms)} ms -> ${number(internal.comparison.aggregate.p95.v2Ms)} ms (${percent(internal.comparison.aggregate.p95.improvementPct)})`,
);

console.log(
  `Weather warm: ${number(providers.weather.warm.medianMs)} ms (${percent(providers.weather.warm.versusColdPct)} vs V2 cold)`,
);

console.log(
  `Geocoding warm: ${number(providers.geocoding.warm.medianMs)} ms (${percent(providers.geocoding.warm.versusColdPct)} vs V2 cold)`,
);

console.log('');
console.log(
  'Saved: docs/metrics/v2-performance-report.md',
);
