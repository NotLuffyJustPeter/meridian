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