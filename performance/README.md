# Meridian Performance Dataset

This directory contains the reproducible dataset used to compare Meridian V1 and V2 performance.

## Profile

The API baseline dataset contains:

- 1 benchmark owner
- 1 primary benchmark journey
- 20 secondary journeys
- 10 trip days
- 30 saved places
- 50 itinerary activities
- 1 trip budget
- 7 budget category limits
- 150 expenses

All benchmark trips use the `[BENCH]` prefix.

Running the seed again deletes only previous `[BENCH]` trips owned by the benchmark account and recreates the dataset.

## Run

The Meridian local API must be available at:

`http://localhost:3001/api/v1`

Run:

`node performance/scripts/seed-benchmark.mjs`

Optional environment variables:

- `BENCHMARK_API_URL`
- `BENCHMARK_EMAIL`
- `BENCHMARK_PASSWORD`
- `BENCHMARK_SEED_DELAY_MS`

No password or access token is written to the benchmark manifest.

## Manifest

After a successful seed:

`performance/data/benchmark-manifest.json`

contains the generated resource IDs, dataset counts, Git commit and benchmark configuration required by the k6 suite.

## Important

External-provider benchmarks for Open-Meteo and Nominatim are intentionally separate from the internal API load tests.

Gemini must not be load-tested through the standard k6 suite.
## V2 Validation

Meridian V2 performance validation reuses the frozen V1 workload so that both versions are measured under equivalent conditions.

### Internal API

The V2 validation uses:

- k6 2.2.0
- 3 independent runs
- 5 minutes per run
- 4 requests per second
- 7 internal API endpoints
- median-of-three aggregation

Generate the V2 summary with:

`node performance/scripts/summarize-v2-baseline.mjs`

Generate the final comparison report with:

`node performance/scripts/generate-v2-performance-report.mjs`

Results are stored in:

- `performance/results/v2-baseline-run-1.json`
- `performance/results/v2-baseline-run-2.json`
- `performance/results/v2-baseline-run-3.json`
- `performance/results/v2-baseline-summary.json`
- `docs/metrics/v2-performance-report.md`

### Provider Cache Validation

Redis-backed provider performance is measured separately from the internal k6 workload.

The provider benchmark performs:

- 3 independent cache misses per provider-backed endpoint
- 3 cache hits per provider-backed endpoint
- explicit Redis cache removal before every cold request
- median latency comparison

Run:

`performance/scripts/run-provider-v2.ps1`

The benchmark requires `BENCHMARK_PASSWORD` to be present in the current environment. The password is never written to benchmark output.

Results are stored in:

`performance/results/v2-provider-cache.json`

External-provider results measure Meridian end-to-end latency and should not be interpreted as raw Nominatim or Open-Meteo benchmarks.

### Current V2 Results

Measured against the frozen V1 baseline:

- aggregate API p95 improved by 9.82%
- aggregate API p99 improved by 9.60%
- GET expenses p95 improved by 22.08%
- weather cache-hit latency improved by 95.84% compared with the V2 cache-miss path
- all V2 k6 runs completed with 0 HTTP errors and 0 dropped iterations
