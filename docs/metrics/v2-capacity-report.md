# Meridian V2 Capacity and Stress Report

## Objective

Sprint S6 measured the sustainable request rate of the Meridian V2 API, identified the point at which latency begins to degrade non-linearly, and separated application security-policy limits from technical backend capacity.

The results represent the local Docker reference environment used for Meridian development and validation. They are not production-capacity guarantees.

## Reference Environment

- Application commit: 2c7550b08815a78b0c47b6c1aafcf8a4c180967e
- Docker CPUs available: 12
- Docker memory available: 8215216128 bytes (~7.65 GiB)
- API container CPU/memory limits: none
- PostgreSQL container CPU/memory limits: none
- Redis container CPU/memory limits: none
- Benchmark dataset commit: 545639c67629fe801aec36a477f3b944b9121bf6

## Methodology

- k6 constant-arrival-rate executor
- Seven API endpoints distributed round-robin
- 60 second capacity steps after smoke validation
- Configurable pre-allocated and maximum VUs
- Resource sampling with docker stats during selected runs
- No k6 pass/fail thresholds in the stress runner, allowing degradation to be observed instead of aborting the experiment

## Production Throttle Policy

The normal API configuration uses a global throttler with:

- limit: 300
- window: 60 seconds
- block duration: 15 seconds
- GET /health excluded from throttling

At the first tested policy-limited point, 64 RPS produced 21.56% non-2xx responses while still delivering 63.91 RPS and zero dropped iterations.

A controlled run at the same 64 RPS with the throttle temporarily raised produced 0% errors, 100% checks, zero dropped iterations, p95 9.52 ms and p99 12.60 ms.

This demonstrates that the 64 RPS failure mode under normal configuration was caused by the throttling policy rather than backend saturation.

The production throttle was restored after the experiment.

## Capacity Curve

| Configured RPS | Mode | Throughput | Errors | p50 | p95 | p99 | API CPU peak | Classification |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 4 | normal-throttle | 3.99 RPS | 0% | 5.76 ms | 11.143 ms | 13.069 ms | n/a | smoke |
| 8 | normal-throttle | 7.989 RPS | 0% | 5.225 ms | 9.432 ms | 11.592 ms | n/a | healthy |
| 16 | normal-throttle | 15.977 RPS | 0% | 5.111 ms | 9.159 ms | 11 ms | 31.58% | healthy |
| 32 | normal-throttle | 31.971 RPS | 0% | 5.05 ms | 9.033 ms | 11.56 ms | 39.02% | healthy |
| 64 | normal-throttle | 63.914 RPS | 21.56% | 4.235 ms | 8.586 ms | 10.965 ms | 45.62% | policy-limited |
| 64 | high-throttle-control | 63.864 RPS | 0% | 5.159 ms | 9.523 ms | 12.604 ms | n/a | healthy |
| 128 | high-throttle | 127.824 RPS | 0% | 4.723 ms | 8.914 ms | 14.715 ms | 65.36% | healthy |
| 192 | high-throttle | 191.677 RPS | 0% | 4.755 ms | 10.639 ms | 18.441 ms | 95% | sustainable |
| 224 | high-throttle | 223.655 RPS | 0% | 5.204 ms | 14.552 ms | 41.592 ms | 98.59% | upper-edge |
| 232 | high-throttle | 231.651 RPS | 0% | 5.618 ms | 98.404 ms | 176.051 ms | 126.52% | knee |
| 240 | high-throttle | 239.637 RPS | 0% | 5.74 ms | 25.623 ms | 144.759 ms | 119.29% | degraded |
| 256 | high-throttle | 255.595 RPS | 0% | 7.921 ms | 213.491 ms | 504.982 ms | 125.06% | severely-degraded |

## Technical Capacity Result

### Clearly sustainable region

192 RPS remained stable with:

- throughput: 191.68 RPS
- errors: 0%
- checks: 100%
- dropped iterations: 0
- p95: 10.64 ms
- p99: 18.44 ms
- API CPU peak: 95%

### Upper operating edge

224 RPS still sustained requested throughput and reliability, but tail latency and API CPU showed visible pressure:

- throughput: 223.66 RPS
- p95: 14.55 ms
- p99: 41.59 ms
- API CPU peak: 98.59%

### Latency knee

At 232 RPS, tail latency became non-linear:

- throughput: 231.65 RPS
- p95: 98.40 ms
- p99: 176.05 ms
- API CPU peak: 126.52%

The increase from 224 to 232 RPS represents only approximately 3.6% additional offered load, while aggregate p95 increased by roughly 6.8x.

Tail-latency instability emerges above the 224 RPS operating edge. The 232 and 240 RPS runs show significant tail-latency pressure, while 256 RPS confirms severe degradation.

### Degraded region

240 RPS:

- p95: 25.62 ms
- p99: 144.76 ms
- API CPU peak: 119.29%

256 RPS:

- throughput: 255.59 RPS
- errors: 0%
- dropped iterations: 0
- p95: 213.49 ms
- p99: 504.98 ms
- maximum observed latency: 1687.76 ms
- API CPU peak: 125.06%

The system continued accepting and completing requests at 256 RPS, but only by allowing severe queueing and tail-latency growth.

## Bottleneck Interpretation

The evidence points to the API layer as the primary pressure point during the latency knee.

At 232 RPS:

- API CPU peak: 126.52%
- PostgreSQL CPU peak: 20.99%
- Redis CPU peak: 0.36%

PostgreSQL and Redis were not close to resource saturation in the observed runs. The experiment does not isolate the exact API-layer subcomponent, so the result should be interpreted as API-side contention or queueing rather than proof of a specific Node.js or event-loop bottleneck.

## Conclusions

- Normal security policy becomes a limiting factor before the technical backend limit under this benchmark workload.
- 192 RPS is the clearly sustainable measured operating region.
- 224 RPS is the measured upper operating edge.
- Tail-latency instability emerges above 224 RPS, with significant degradation observed in the 232-256 RPS region.
- 232 RPS and above should not be treated as a normal sustained operating target in this reference environment.
- 256 RPS is not a hard throughput ceiling; throughput remained intact while latency degraded severely.
- A hard throughput ceiling was intentionally not pursued after severe latency degradation was established.

## Validation and Restoration

- Capacity runner successfully inspected by k6
- Smoke: 4 RPS, 120 requests, 0 errors
- Normal throttle policy behavior reproduced
- High-throttle control confirmed policy vs technical limit
- Production throttle restored to 300 requests per 60 second window
- API rebuilt after restoration
- API health after restoration: HTTP 200

## Sprint Status

S6 Capacity / Stress Testing: COMPLETE
