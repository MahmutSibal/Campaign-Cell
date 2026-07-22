# CampaignCell — Event Architecture

All events are transmitted via **Redis Pub/Sub**. Campaign Service publishes events;
Gamification Service subscribes. This ensures service independence — if Gamification
Service is down, events are missed (no persistence), which is acceptable for a demo.

---

## Event Channels

### `campaign.optimized`

Published by **Campaign Service** when an expert marks a case as TAMAMLANDI.

```json
{
  "event_type": "campaign.optimized",
  "timestamp": "2026-07-22T10:30:00Z",
  "payload": {
    "caseId": "uuid",
    "caseCode": "CMP-2026-000042",
    "expertId": "uuid",
    "expertName": "Ahmet Yıldız",
    "segment": "RISKLI_KAYIP",
    "priority": "YUKSEK",
    "conversionLift": 0.18,
    "durationMinutes": 95,
    "fastBonus": true
  }
}
```

**Consumed by:** Gamification Service → awards +10 base, +5 fast bonus if < 2h, +15 if conversionLift > 0.15, +15 if KRITIK + < 2h

---

### `campaign.sla_breached`

Published by **Campaign Service** when a case exceeds its SLA deadline.

```json
{
  "event_type": "campaign.sla_breached",
  "timestamp": "2026-07-22T10:30:00Z",
  "payload": {
    "caseId": "uuid",
    "caseCode": "CMP-2026-000010",
    "expertId": "uuid",
    "priority": "KRITIK"
  }
}
```

**Consumed by:** Gamification Service → deducts -5 points from expert

---

### `offer.accepted`

Published by **Campaign Service** when a subscriber accepts a campaign offer.

```json
{
  "event_type": "offer.accepted",
  "timestamp": "2026-07-22T10:30:00Z",
  "payload": {
    "subscriberId": "uuid",
    "campaignId": "uuid",
    "expertId": "uuid"
  }
}
```

**Consumed by:** Gamification Service (future: conversion tracking)

---

### `offer.rejected`

Published by **Campaign Service** when a subscriber rejects an offer.

```json
{
  "event_type": "offer.rejected",
  "timestamp": "2026-07-22T10:30:00Z",
  "payload": {
    "subscriberId": "uuid",
    "campaignId": "uuid",
    "reason": "İlgilenmiyorum"
  }
}
```

---

### `offer.rated`

Published by **Campaign Service** when a subscriber rates an accepted offer.

```json
{
  "event_type": "offer.rated",
  "timestamp": "2026-07-22T10:30:00Z",
  "payload": {
    "subscriberId": "uuid",
    "campaignId": "uuid",
    "rating": 2,
    "expertId": "uuid"
  }
}
```

**Consumed by:** Gamification Service → if rating ≤ 2 AND expertId present → -3 points

---

### `segment.override`

Published by **Campaign Service** when a staff member manually overrides an AI-assigned segment.
Used by AI Service for accuracy tracking.

```json
{
  "event_type": "segment.override",
  "timestamp": "2026-07-22T10:30:00Z",
  "payload": {
    "predictionId": "uuid",
    "caseId": "uuid",
    "oldSegment": "YUKSEK_DEGER",
    "newSegment": "RISKLI_KAYIP",
    "overriddenBy": "uuid",
    "overriddenByName": "Burak Supervisor"
  }
}
```

**Note:** The AI Service is called directly via REST for segment override (PATCH /v1/ai/segment-override).
This event is for future event-sourcing/audit purposes.

---

### `audit.log`

Published by **Campaign Service**, **AI Service**, and **Gamification Service** whenever a request is
rejected with 403 (insufficient role), or when a critical action happens (campaign deletion, optimization
case status change). Consumed by **Identity Service**, which persists the entry into its own `audit_logs`
table — this is how cross-service actions end up in the centralized audit log without any service reaching
into another service's database (database-per-service).

```json
{
  "event_type": "audit.log",
  "timestamp": "2026-07-22T10:30:00Z",
  "payload": {
    "userId": "uuid",
    "userName": "Ahmet Yıldız",
    "action": "UNAUTHORIZED_ACCESS",
    "resource": "/v1/campaigns",
    "resourceId": "uuid",
    "result": "FAILURE",
    "ipAddress": "10.0.0.5",
    "details": "Required roles: SUPERVISOR, ADMIN, current: CAMPAIGN_EXPERT"
  }
}
```

**Consumed by:** Identity Service → inserts into `audit_logs` (see `GET /v1/audit`)

---

### `badge.earned`

Published by **Gamification Service** to Redis the moment a badge condition is met after processing
`campaign.optimized` or `offer.rated`. Relayed to the frontend over `GET /v1/game/events?userId=<id>`
(Server-Sent Events) so the profile screen can show a toast notification immediately.

```json
{
  "userId": "uuid",
  "badgeId": "hiz-ustasi",
  "badgeName": "Hız Ustası",
  "badgeDescription": "2 saatin altında 10 optimizasyon",
  "earnedAt": "2026-07-22T10:30:00Z"
}
```

**Consumed by:** Frontend (`EventSource` on `/v1/game/events?userId=<id>`) → shows a toast notification

---

## Service Communication Summary

| From | To | Method | When |
|---|---|---|---|
| Campaign Service | AI Service | REST (sync) | Campaign created → score subscribers |
| Campaign Service | AI Service | REST (sync) | Case needs expert assignment |
| Campaign Service | Gamification | Redis Pub/Sub (async) | Case completed, SLA breached, offer rated |
| Frontend | Gateway | REST | All user interactions |
| Gateway | All Services | REST (proxy) | Route forwarding |

---

## Resilience Rules

- If **AI Service** is unreachable when a campaign is created:
  - Campaign is created with `isAiAnalyzed: false`
  - A case is created with `segment: BELIRSIZ`, `priority: ORTA`
  - The case goes to manual queue for supervisor assignment
- If **Redis** is unreachable when publishing:
  - Event is dropped (fire-and-forget)
  - Service logs a warning but does NOT fail the request
- If **Gamification Service** is down:
  - Redis events accumulate (up to Redis memory limit)
  - Points are NOT retroactively awarded when service comes back (demo limitation)
