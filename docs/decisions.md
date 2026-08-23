# Meridian — Architecture Decisions

This document records the major architecture decisions behind Meridian. It is intentionally concise: each entry captures context, decision, consequences, and the condition that would justify revisiting it.

---

## ADR-001 — pnpm monorepo

**Status:** Accepted

### Context

Meridian contains a Next.js web application, NestJS API and shared workspace-level tooling.

### Decision

Use pnpm workspaces with Turbo orchestration.

```text
apps/*
packages/*
```

### Consequences

**Positive**

- one dependency graph and lockfile;
- coordinated type/lint/build commands;
- easier shared tooling;
- CI can target each application independently.

**Trade-off**

- Docker and framework tracing must understand the monorepo root.

### Revisit when

Independent release cadence or repository size makes a single workspace a measurable delivery bottleneck.

---

## ADR-002 — Next.js BFF in front of the API

**Status:** Accepted

### Context

The browser needs authenticated access to a separately hosted NestJS API.

### Decision

Use Next.js server routes as a Backend-for-Frontend for browser-facing REST workflows.

### Consequences

**Positive**

- HttpOnly cookie handling remains server-side;
- access-token attachment is centralized;
- refresh + retry behavior is centralized;
- API origin is not duplicated throughout feature components.

**Trade-off**

- some requests pass through an additional server hop.

### Revisit when

A native/mobile client becomes a first-class consumer or latency measurements show the extra hop is material.

---

## ADR-003 — REST as source of truth; Socket.IO as invalidation channel

**Status:** Accepted

### Context

Collaborators need near-realtime itinerary and budget updates.

### Decision

Persist mutations through REST/PostgreSQL. After success, publish small room-scoped events such as:

```text
itinerary:changed
budget:changed
```

Receivers refetch canonical REST state.

### Consequences

**Positive**

- one mutation/validation path;
- one authorization path;
- resilient reconnect behavior;
- small socket payloads;
- simpler consistency model.

**Trade-off**

- realtime events trigger follow-up HTTP requests.

### Revisit when

Measured collaboration latency or scale requires streaming state patches rather than invalidation.

---

## ADR-004 — Short-lived realtime ticket

**Status:** Accepted

### Context

A socket needs authenticated identity but should not directly reuse the normal browser session mechanism indefinitely.

### Decision

Issue a signed realtime JWT with:

```text
type = realtime
TTL  = 60 seconds
```

Then check trip access before room join.

### Consequences

**Positive**

- narrow credential purpose;
- short exposure window;
- current authorization checked before room membership.

**Trade-off**

- connection setup requires an additional ticket request.

### Revisit when

The realtime transport changes or a dedicated identity/session service is introduced.

---

## ADR-005 — Neon pooled runtime URL + direct migration URL

**Status:** Accepted

### Context

Hosted PostgreSQL runtime traffic and schema migrations have different connection requirements.

### Decision

Use:

```text
DATABASE_URL → runtime / pooled
DIRECT_URL   → Prisma migration / CLI
```

`prisma.config.ts` prefers `DIRECT_URL` and falls back to `DATABASE_URL`.

### Consequences

**Positive**

- safer serverless/runtime connection behavior;
- direct connection available for migration operations;
- local fallback remains simple.

**Trade-off**

- production needs two correctly managed database URLs.

### Revisit when

The hosting/database topology changes.

---

## ADR-006 — Mailjet HTTPS for production email

**Status:** Accepted

### Context

Local development benefits from SMTP/Mailpit, while the hosted API needs reliable transactional delivery without depending on local SMTP assumptions.

### Decision

Support a provider switch:

```text
smtp    → local development
mailjet → production HTTPS API
```

### Consequences

**Positive**

- local testing remains simple;
- production delivery uses HTTPS;
- startup validation can enforce provider-specific secrets.

**Trade-off**

- the email service maintains two transport implementations.

### Revisit when

A different transactional provider materially improves cost, reliability or product requirements.

---

## ADR-007 — Fail-fast production environment validation

**Status:** Accepted

### Context

Security-sensitive services can appear healthy while being incorrectly configured.

### Decision

Validate environment variables during NestJS application bootstrap.

Examples:

- distinct JWT secrets;
- minimum secret length;
- valid MFA key encoding/length;
- explicit CORS origins;
- production app origin;
- URL/protocol restrictions;
- bounded TTL values;
- provider-specific mail requirements.

### Consequences

**Positive**

- bad deployments fail early;
- configuration expectations are executable;
- CI can test invalid configurations.

**Trade-off**

- production environment changes must satisfy stricter startup rules.

### Revisit when

Configuration moves to a typed external secrets/configuration service.

---

## ADR-008 — OWNER / EDITOR / VIEWER collaboration model

**Status:** Accepted

### Context

Meridian needs collaboration without giving all participants destructive control.

### Decision

Keep the trip owner as `Trip.ownerId`; model collaborators separately with:

```text
EDITOR
VIEWER
```

### Consequences

- OWNER controls collaborators, core trip settings and journey deletion;
- EDITOR can participate in planning mutations;
- VIEWER is read-only;
- destructive operations can remain clearly owner-only.

### Revisit when

Teams require custom roles or per-resource permissions.

---

## ADR-009 — Cascading trip cleanup

**Status:** Accepted

### Context

A deleted journey should not leave itinerary, financial or collaboration records behind.

### Decision

Use relational cascades from `Trip` to owned child resources.

Notable exception:

```text
Place deleted
  → Activity.placeId = null
  → Activity remains
```

### Consequences

**Positive**

- trip deletion is complete and predictable;
- no application-level cleanup orchestration is required for normal child resources.

**Trade-off**

- destructive trip deletion is intentionally high impact and must remain protected by owner authorization and explicit UI confirmation.

### Revisit when

The product introduces soft-delete, audit retention or regulatory retention requirements.

---

## ADR-010 — Free-tier multi-platform deployment

**Status:** Accepted for portfolio release

### Context

Meridian is a portfolio-grade project with a zero recurring infrastructure budget.

### Decision

Deploy:

```text
Web/API edge layer → Vercel
NestJS + Socket.IO → Render
PostgreSQL         → Neon
Transactional mail → Mailjet HTTPS
```

### Consequences

**Positive**

- real public deployment;
- realistic distributed architecture;
- no recurring infrastructure budget required for the current use case.

**Trade-off**

- cold starts and free-tier constraints are accepted;
- no production SLA is assumed.

### Revisit when

Traffic, availability requirements or commercial usage justify paid infrastructure.
