# Meridian V1 Baseline Report

## Purpose

This document freezes Meridian V1 performance before the V2 performance and platform engineering work.

The V2 comparison must reuse the same benchmark dataset, workload shape, request rate, run duration, and aggregation methodology whenever the comparison is intended to measure application-level improvement.

---

## Internal API baseline

Tool: k6 2.2.0

- Runs: 3
- Duration: 5 minutes per run
- Target arrival rate: 4 requests/second
- Total workload requests: 3602
- HTTP errors: 0%
- Failed checks: 0
- Dropped iterations: 0

Representative values are the median of the corresponding metric across the three independent runs. They are not pooled request-level percentiles.

| Metric | V1 baseline |
| --- | ---: |
| Throughput | 4.0024 req/s |
| p50 | 5.356 ms |
| p95 | 10.183 ms |
| p99 | 12.464 ms |

### Endpoint latency

| Endpoint | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: |
| GET /health | 2.701 | 3.682 | 4.831 |
| GET /trips | 4.601 | 6.462 | 8.042 |
| GET /trips/:id | 4.054 | 5.241 | 6.112 |
| GET itinerary | 9.150 | 12.669 | 14.784 |
| GET places | 5.554 | 7.203 | 8.393 |
| GET budget overview | 5.443 | 7.411 | 11.079 |
| GET expenses | 8.534 | 10.845 | 12.377 |

---

## PostgreSQL baseline

### Trips

- Plan: Bitmap Heap Scan + Bitmap Index Scan
- Index used: `trips_ownerId_startDate_idx`
- Rows returned: 21
- EXPLAIN execution time: 0.224 ms
- No additional index justified by this measurement.

### Itinerary

The V1 read path performs an access check, membership lookup, itinerary-day materialization attempt, trip-day lookup, and activity lookup.

The GET path attempts to insert 10 trip-day rows using:

`INSERT ... ON CONFLICT DO NOTHING`

even after the itinerary days already exist.

Observed execute durations:

| Operation | Execute ms |
| --- | ---: |
| Access query | 0.037 |
| Membership query | 0.004 |
| Trip-day INSERT attempt | 0.280 |
| Trip-day SELECT | 0.029 |
| Activities SELECT | 0.184 |

Primary V2 optimization candidate:

**Remove unnecessary repeated write-on-read behavior while preserving itinerary creation semantics.**

### Expenses

- Rows: 150
- Plan: Seq Scan + quicksort
- Sort memory: 57 kB
- EXPLAIN execution: 0.200 ms
- Prisma execution observed: 0.570 ms

The sequential scan is appropriate at the current dataset scale. No index change is justified solely to remove the Seq Scan.

### Budget overview

The endpoint performs six logical database operations including access validation, budget retrieval, category-limit retrieval, expense aggregation, and grouping by category.

Individual observed execute durations:

| Operation | Execute ms |
| --- | ---: |
| Access | 0.057 |
| Membership | 0.004 |
| Expense SUM + COUNT | 0.111 |
| Expense GROUP BY | 0.203 |
| Budget | 0.889 |
| Category limits | 0.489 |

These durations are not summed and presented as endpoint wall-clock time because some operations are issued concurrently.

---

## External provider baseline

External providers were tested sequentially rather than load-tested.

### Geocoding â€” Nominatim

Query: `Duomo di Milano`

| Run | Latency |
| ---: | ---: |
| 1 | 377.551 ms |
| 2 | 16.734 ms |
| 3 | 16.747 ms |

Median: **16.747 ms**

The first request shows substantially higher latency than subsequent requests. The cause is not attributed to any single caching layer without additional instrumentation.

### Weather â€” Open-Meteo

| Run | Latency |
| ---: | ---: |
| 1 | 1448.693 ms |
| 2 | 369.733 ms |
| 3 | 368.459 ms |

Median: **369.733 ms**

The benchmark trip returned `OUT_OF_RANGE` because its dates were outside the available forecast window at measurement time. The request still exercised the Meridian weather integration and returned HTTP 200.

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
