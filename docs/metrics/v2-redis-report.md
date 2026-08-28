# Meridian V2 Redis Cache Report

## Scope

This report records the implementation and runtime verification of
Redis caching for Meridian V2.

The goal of this phase was to reduce repeated external-provider work
without making Redis a critical dependency of the API.

## Architecture

Meridian uses Redis as a distributed cache in front of external data
providers.

Cached workloads:

- Nominatim geocoding searches
- Open-Meteo location resolution
- Open-Meteo weather forecasts

Application database reads and writes are not cached in this phase.

## Redis

Local Redis runs through Docker Compose.

Configuration:

- Redis 7.4 Alpine
- ephemeral cache
- persistence disabled
- maximum memory: 128 MB
- eviction policy: allkeys-lru
- host binding: 127.0.0.1:6379

Redis is used strictly as cache infrastructure and is not a system of
record.

## Cache abstraction

Application code accesses Redis through `CacheService`.

Provider modules depend on the cache abstraction rather than interacting
directly with the Redis client.

Implemented behavior includes:

- JSON serialization
- TTL expiration
- fail-open behavior
- in-process single-flight request coalescing
- OpenTelemetry cache spans
- automatic Redis reconnection

If Redis is unavailable, the loader is executed and the external
provider remains usable.

## Cache key privacy

Redis keys use the format:

`meridian:v2:<namespace>:<sha256>`

Verified namespaces:

- `geocoding.search`
- `weather.location`
- `weather.forecast`

Runtime validation confirmed that keys contain SHA-256 digests rather
than raw search terms, coordinates, destinations, or user-provided
query text.

Cache key privacy gate:

`CLEAN`

## TTL policy

Configured TTLs:

- geocoding search: 86400 seconds
- weather location: 604800 seconds
- weather forecast: 900 seconds

Runtime TTL inspection confirmed expiration was active for all three
cache namespaces.

Observed TTL values during validation were:

- geocoding search: 85809 seconds
- weather location: 604209 seconds
- weather forecast: 310 seconds

These observed values are validation snapshots and are not performance
metrics.

## Cache HIT / MISS behavior

Runtime provider-call counting verified the following behavior.

### Geocoding

First request:

`Redis MISS -> Nominatim -> Redis`

Second identical request:

`Redis HIT -> response`

Provider calls after first request:

`1`

Provider calls after second request:

`1`

Result:

`HIT verified`

### Weather location

First request:

`Redis MISS -> Open-Meteo geocoding -> Redis`

Second identical request:

`Redis HIT -> response`

Provider calls after first request:

`1`

Provider calls after second request:

`1`

Result:

`HIT verified`

### Weather forecast

First request:

`Redis MISS -> Open-Meteo forecast -> Redis`

Second identical request:

`Redis HIT -> response`

Provider calls after first request:

`1`

Provider calls after second request:

`1`

Result:

`HIT verified`

## Fail-open verification

Redis was intentionally stopped during runtime verification.

The Meridian API remained healthy:

`HTTP 200`

A new Open-Meteo location lookup was then performed while Redis was
unavailable.

Result:

- provider succeeded
- external provider calls: 1
- valid location returned: Guadalajara

Observed runtime for this validation request:

`766 ms`

This value is diagnostic evidence only and must not be treated as a
benchmark result.

Redis failure therefore does not make the external-provider path
unavailable.

## Recovery verification

Redis was restarted after the failure test.

Redis returned:

`PONG`

Meridian logged both states:

- Redis cache unavailable
- Redis cache connection restored

The API remained healthy after Redis recovery.

## OpenTelemetry verification

Cache operations emit OpenTelemetry spans.

Runtime trace:

`bd5a0de209ac426dc87622f96a373357`

Jaeger confirmed both MISS and HIT spans for every cached workload:

| Namespace | MISS | HIT | Fail-open |
| --- | --- | --- | --- |
| geocoding.search | yes | yes | no |
| weather.location | yes | yes | no |
| weather.forecast | yes | yes | no |

Runtime gate:

`JAEGER CACHE HIT/MISS GATE CLEAN`

No fail-open occurred during the controlled HIT/MISS trace.

## Existing Nominatim local cache

The existing Nominatim provider retains its in-process cache and
rate-limiting protection.

Redis operates as the outer distributed cache.

This preserves the existing provider safeguards while allowing cached
responses to be shared across API instances.

## Tests

New unit coverage protects:

- deterministic SHA-256 cache keys
- absence of raw key material
- namespace separation
- operation without Redis configuration
- same-key single-flight request coalescing
- independent execution for different cache keys

The dedicated cache test suite passed.

The complete API unit regression also passed.

End-to-end regression:

- test suites: 12 passed / 12 total
- tests: 82 passed / 82 total
- failed tests: 0

E2E tests were executed against:

`meridian_test`

Redis was intentionally not required by the E2E environment.

## Quality gates

The following S2 gates passed:

- Prettier format check
- TypeScript typecheck
- ESLint
- complete unit test suite
- API build
- Docker Compose validation
- git diff check
- Redis PING
- Redis HIT / MISS provider validation
- SHA-256 cache key validation
- TTL validation
- Redis failure validation
- Redis recovery validation
- OpenTelemetry HIT / MISS validation
- Jaeger trace validation
- E2E regression

## Status

Meridian V2 Redis caching is functionally verified.

Redis improves repeated external-provider requests while remaining a
non-critical optimization layer.

The implementation is ready to be frozen as the V2 Redis phase.