# Meridian V2 Performance Validation

## Executive summary

Meridian V2 was validated against the frozen Meridian V1 workload using the same k6 version, request rate, endpoint set, and median-of-three methodology.

The internal API showed lower aggregate latency while maintaining zero HTTP errors and zero dropped iterations.

The largest externally backed improvement came from Redis caching on weather requests, where cache-hit latency dropped from approximately 370 ms to approximately 15 ms.

## Internal API methodology

- k6: 2.2.0
- Method: median-of-three-runs
- Runs: 3
- Duration: 5m per run
- Arrival rate: 4 req/s
- Endpoints: 7
- V1 dataset commit: `6708d1d638dc6215118da974711c7f7d4289374b`
- V2 dataset commit: `545639c67629fe801aec36a477f3b944b9121bf6`

Positive latency percentages mean V2 is faster.

## Aggregate API comparison

| Metric | V1 | V2 | Change |
| --- | ---: | ---: | ---: |
| Throughput | 4.002 req/s | 4.002 req/s | 0.00% |
| Avg latency | 5.965 ms | 5.500 ms | +7.80% |
| p50 latency | 5.356 ms | 5.154 ms | +3.77% |
| p90 latency | 9.319 ms | 8.205 ms | +11.95% |
| p95 latency | 10.183 ms | 9.183 ms | +9.82% |
| p99 latency | 12.464 ms | 11.267 ms | +9.60% |

## Endpoint comparison

| Endpoint | V1 p50 | V2 p50 | p50 change | V1 p95 | V2 p95 | p95 change | V1 p99 | V2 p99 | p99 change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GET /health | 2.701 | 2.721 | -0.74% | 3.682 | 3.673 | +0.24% | 4.831 | 5.783 | -19.71% |
| GET /trips | 4.601 | 4.313 | +6.26% | 6.462 | 5.970 | +7.61% | 8.042 | 7.575 | +5.81% |
| GET /trips/:id | 4.054 | 4.117 | -1.55% | 5.241 | 5.486 | -4.67% | 6.112 | 6.230 | -1.93% |
| GET itinerary | 9.150 | 8.244 | +9.90% | 12.669 | 11.235 | +11.32% | 14.784 | 14.324 | +3.11% |
| GET places | 5.554 | 5.014 | +9.72% | 7.203 | 7.173 | +0.42% | 8.393 | 8.198 | +2.32% |
| GET budget overview | 5.443 | 5.600 | -2.88% | 7.411 | 7.966 | -7.49% | 11.079 | 10.135 | +8.52% |
| GET expenses | 8.534 | 6.511 | +23.71% | 10.845 | 8.450 | +22.08% | 12.377 | 10.389 | +16.06% |

## Internal API reliability

| Metric | V2 |
| --- | ---: |
| Requests | 3602 |
| Error rate | 0.0000% |
| Check rate | 100.0000% |
| Dropped iterations | 0 |

## Redis provider-cache validation

The provider benchmark separately measures cache misses and cache hits.

Each provider-backed endpoint was measured using three independent cache misses and three cache hits. Redis keys were explicitly removed before each cold measurement.

Because external provider latency depends on network and upstream behavior, medians are used instead of individual runs.

### Geocoding / Nominatim

| Path | Median | Change |
| --- | ---: | ---: |
| V1 baseline | 16.747 ms | - |
| V2 cache miss | 14.935 ms | +10.82% vs V1 |
| V2 cache hit | 13.726 ms | +18.04% vs V1 |
| Cache hit vs V2 miss | 13.726 ms | +8.10% |

Cold runs:

`11.868 ms`, `14.935 ms`, `569.337 ms`

Warm runs:

`13.421 ms`, `13.726 ms`, `13.836 ms`

The wide spread in the geocoding cold measurements demonstrates why external-provider benchmarking must be interpreted using medians rather than a single request.

### Weather / Open-Meteo

| Path | Median | Change |
| --- | ---: | ---: |
| V1 baseline | 369.733 ms | - |
| V2 cache miss | 371.162 ms | -0.39% vs V1 |
| V2 cache hit | 15.437 ms | +95.82% vs V1 |
| Cache hit vs V2 miss | 15.437 ms | +95.84% |

Cold runs:

`371.034 ms`, `371.162 ms`, `1467.643 ms`

Warm runs:

`15.413 ms`, `15.437 ms`, `15.997 ms`

The V2 weather cache-miss median remained essentially unchanged from V1, while the warm path eliminated almost all provider latency.

## Findings

- Aggregate API p95 improved by **+9.82%**, from 10.183 ms to 9.183 ms.
- Aggregate API p99 improved by **+9.60%**, from 12.464 ms to 11.267 ms.
- The strongest internal p95 improvement was **GET expenses**, at **+22.08%**.
- Weather cache hits improved latency by **+95.84%** compared with the V2 cache-miss path.
- Weather cache-hit latency improved by **+95.82%** compared with the frozen V1 provider baseline.
- Geocoding cache-hit latency improved by **+8.10%** compared with its V2 cache-miss median.
- Internal endpoints with a p95 regression of at least 2%: GET /trips/:id (-4.67%), GET budget overview (-7.49%)

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
