# Meridian V2 Targeted Performance Optimization

## Scope

Sprint S5 investigated the two V2 endpoints that had regressed during performance validation:

- GET /trips/:id
- GET budget overview

Trip detail showed no actionable SQL bottleneck during EXPLAIN ANALYZE or tracing, so it was intentionally left unchanged.

Budget overview was selected for optimization because it executed both an expense aggregate query and an expense groupBy query over the same trip expenses.

## Optimization

The redundant expense aggregate query was removed.

Total spent amount and expense count are now derived from the existing grouped expense results using integer cents for monetary arithmetic.

Optimization commit: 3c176892b9a1efc5e4142e2003c3f19f2652eeed

## Structural Evidence

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| PostgreSQL SELECTs per budget request | 6 | 5 | -16.67% |
| Prisma db_query spans | 6 | 5 | -16.67% |
| Typical Jaeger trace spans | 31 | 27 | -12.90% |

This confirms that the redundant database operation was removed in runtime, not only from source code.

## Benchmark Methodology

- 3 independent runs
- 5 minutes per run
- Constant arrival rate: 4 requests/second
- Same V2 benchmark dataset and endpoint mix
- 7 API endpoints
- Median of the 3 runs used for comparison

## Reliability

| Metric | Result |
| --- | ---: |
| Requests | 3601 |
| Error rate | 0% |
| Checks | 100% |
| Dropped iterations | 0 |

## Aggregate Median Latency

| Metric | V2 pre-S5 | V2 post-S5 | Change |
| --- | ---: | ---: | ---: |
| p50 | 5.154 ms | 5.204 ms | -0.97% |
| p95 | 9.183 ms | 9.248 ms | -0.71% |
| p99 | 11.267 ms | 11.524 ms | -2.28% |

Positive percentages indicate lower latency after S5.

## Endpoint Median Latency

| Endpoint | p50 before | p50 after | p95 before | p95 after | p99 before | p99 after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| GET /health | 2.721 ms | 2.733 ms | 3.673 ms | 4.379 ms | 5.783 ms | 5.379 ms |
| GET /trips | 4.313 ms | 4.517 ms | 5.97 ms | 6.446 ms | 7.575 ms | 8.062 ms |
| GET /trips/:id | 4.117 ms | 4.239 ms | 5.486 ms | 5.895 ms | 6.23 ms | 7.047 ms |
| GET itinerary | 8.244 ms | 8.49 ms | 11.234 ms | 11.673 ms | 14.324 ms | 13.305 ms |
| GET places | 5.014 ms | 5.144 ms | 7.172 ms | 6.853 ms | 8.198 ms | 9.511 ms |
| GET budget overview | 5.6 ms | 5.635 ms | 7.966 ms | 8.229 ms | 10.135 ms | 9.782 ms |
| GET expenses | 6.511 ms | 6.742 ms | 8.45 ms | 8.459 ms | 10.389 ms | 10.464 ms |

## Budget Overview Result

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| p50 | 5.6 ms | 5.635 ms | -0.62% |
| p95 | 7.966 ms | 8.229 ms | -3.3% |
| p99 | 10.135 ms | 9.782 ms | 3.48% |

The p95 change is small and does not demonstrate a measurable latency improvement by itself. Untouched endpoints also moved by larger percentages between benchmark sets, indicating normal environmental and run-to-run variation.

The optimization is therefore classified as latency-neutral within the observed benchmark variability.

## Decision

KEEP.

The optimization removes one redundant database query from every budget overview request, reduces database and tracing work, preserves the API contract, and maintains full benchmark reliability.

No database index changes were introduced because EXPLAIN ANALYZE showed no evidence that an additional index was warranted for the benchmark dataset.

## Validation

- BudgetService unit tests: 16/16 passing
- Full API suite: 30 suites, 194 tests passing
- API typecheck: passing
- API lint: passing
- API build: passing
- git diff --check: passing
- Runtime trace verification: 6 SELECTs reduced to 5
- Targeted benchmark: 0 errors, 100% checks, 0 dropped iterations

## Sprint Status

S5 Targeted Performance Optimization: COMPLETE
