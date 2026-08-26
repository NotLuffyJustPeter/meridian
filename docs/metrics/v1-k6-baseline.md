# Meridian V1 Performance Baseline

## Methodology

This baseline represents Meridian V1 before Redis caching, background workers, observability instrumentation, and PostgreSQL performance tuning.

- k6: 2.2.0
- Runs: 3
- Duration per run: 5 minutes
- Arrival rate: 4 requests/second
- Total workload requests: 3602
- Dataset version: 1
- Dataset commit: `6708d1d638dc6215118da974711c7f7d4289374b`
- HTTP errors: 0
- Failed checks: 0
- Dropped iterations: 0

The representative values below are the median of the corresponding metric across three independent runs. They are not pooled request-level percentiles.

## Aggregate baseline

| Metric | Median | Min run | Max run |
| --- | ---: | ---: | ---: |
| Throughput (req/s) | 4.0020 | 3.9990 | 4.0020 |
| Average latency (ms) | 5.965 | 5.559 | 7.040 |
| p50 latency (ms) | 5.356 | 5.023 | 6.354 |
| p90 latency (ms) | 9.319 | 8.715 | 11.217 |
| p95 latency (ms) | 10.183 | 9.330 | 12.580 |
| p99 latency (ms) | 12.464 | 11.014 | 16.963 |

## Endpoint baseline

| Endpoint | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: |
| GET /health | 2.701 | 3.682 | 4.831 |
| GET /trips | 4.601 | 6.462 | 8.042 |
| GET /trips/:id | 4.054 | 5.241 | 6.112 |
| GET itinerary | 9.150 | 12.669 | 14.784 |
| GET places | 5.554 | 7.203 | 8.393 |
| GET budget overview | 5.443 | 7.411 | 11.079 |
| GET expenses | 8.534 | 10.845 | 12.377 |

## Individual runs

| Run | Requests | req/s | p50 ms | p95 ms | p99 ms |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1201 | 4.0024 | 5.356 | 10.183 | 12.464 |
| 2 | 1200 | 3.9992 | 5.023 | 9.330 | 11.014 |
| 3 | 1201 | 4.0024 | 6.354 | 12.580 | 16.963 |

## Interpretation

The itinerary and expenses read paths are the highest-latency endpoints in the current internal workload.

Run 3 was slower than Runs 1 and 2 while still completing with zero HTTP errors, zero dropped iterations, and a 100% check rate. It is retained as part of the baseline rather than discarded.

This exact methodology must be reused for the Meridian V2 comparison.
