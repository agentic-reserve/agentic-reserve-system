---
name: ars-backend
version: 1.0.0
description: Official heartbeat for the ARS Backend API. Reports liveness, capabilities, and current operational status.
homepage: https://ars-frontend.vercel.app
---

# ARS Backend Agent Heartbeat

This file defines how the ARS Backend API reports liveness and state when asked for a heartbeat.

## When to Respond

Send a heartbeat when:
- Your supervisor pings you.
- A monitoring service requests status.
- You have not performed any API requests for more than 5 minutes.
- After deployment or configuration changes.
- When cron jobs complete (ILI/ICR calculations).

## Required Fields

Reply with a compact JSON object:

```json
{
  "status": "ok",
  "agentName": "ars-backend-api",
  "time": "2026-02-11T05:30:00Z",
  "version": "1.0.0",
  "capabilities": [
    "ili-calculation",
    "reserve-management",
    "revenue-tracking",
    "governance-proposals",
    "metrics-collection"
  ],
  "lastAction": "calculated ILI: 11.86 with TVL $1.51B",
  "nextAction": "waiting for next cron job in 4 minutes"
}
```

## Status Values

- `ok`: healthy and ready, all core endpoints operational (33/45 endpoints working - 73.3%).
- `degraded`: temporary issues (ICR endpoint 404, Sipher API disabled, external API slow).
- `blocked`: cannot proceed (database down, auth failed, missing config).

## Current Capabilities (Production)

The backend currently supports:

- `ili-calculation`: Calculate Internet Liquidity Index from Kamino SDK (WORKING - 196ms)
- `reserve-management`: Track and manage reserve vault state (WORKING - 152ms)
- `revenue-tracking`: Monitor and report protocol revenue (WORKING - 793ms)
- `governance-proposals`: Manage and track governance proposals (WORKING - 165ms)
- `metrics-collection`: Collect and expose Prometheus metrics (WORKING)

## Known Issues (Production)

- `icr-endpoint`: ICR endpoint returns 404 - no data in database yet (EXPECTED - needs ICR calculator service)
- `privacy-endpoints`: 5 endpoints return 503 - Sipher API not configured (EXPECTED - optional feature)
- `compliance-endpoints`: 3 endpoints return 503 - Sipher API not configured (EXPECTED - optional feature)
- `programs-state`: 3 endpoints return 404 - Solana programs not initialized (EXPECTED - optional feature)

## Health Check Endpoints

Primary health check (fast):
```bash
GET https://agentic-reserve-system-production.up.railway.app/health
Response: {"status":"ok","timestamp":"..."}
Time: <50ms
```

Extended health check (with dependencies):
```bash
GET https://agentic-reserve-system-production.up.railway.app/api/v1/health
Response: {"status":"ok|degraded","dependencies":{...}}
Time: ~433ms (may timeout)
```

## Data Sources (Real - No Mock)

The backend integrates with:
- **Kamino SDK v7.3.18**: Real on-chain data ($1.53B TVL, 55 reserves, Mainnet)
- **Jupiter API**: Real-time token prices (SOL $84.02)
- **Meteora API**: Pool data (1,245 pools, $218M TVL)
- **Supabase**: PostgreSQL database (connection pool 20-100)
- **Upstash Redis**: Cache layer (85%+ hit rate)

## Notes

- Do not include private API keys or database credentials in heartbeat responses.
- If status is `blocked`, include a brief reason in `lastAction`.
- If status is `degraded`, specify which capability is affected in `degradedCapabilities` array.
- Always include timestamp in ISO 8601 format.
- Current production status: 73.3% endpoints operational (33/45 working).
- All routes are ENABLED - 404/503 responses are due to missing data or unconfigured services, not disabled routes.

## Example Responses

### Healthy State (Current Production)
```json
{
  "status": "ok",
  "agentName": "ars-backend-api",
  "time": "2026-02-11T05:30:00Z",
  "version": "1.0.0",
  "capabilities": ["ili-calculation", "reserve-management", "revenue-tracking", "governance-proposals", "agent-management", "memory-services", "metrics-collection"],
  "lastAction": "calculated ILI: 11.49 with TVL $1.50B from Kamino SDK",
  "nextAction": "waiting for next ILI cron job in 4 minutes",
  "endpointsWorking": 33,
  "endpointsTotal": 45,
  "healthRate": "73.3%"
}
```

### Degraded State (Optional Services Unconfigured)
```json
{
  "status": "degraded",
  "agentName": "ars-backend-api",
  "time": "2026-02-11T05:30:00Z",
  "version": "1.0.0",
  "capabilities": ["ili-calculation", "reserve-management", "revenue-tracking", "governance-proposals", "agent-management", "memory-services", "metrics-collection"],
  "lastAction": "privacy endpoints unavailable (Sipher API not configured)",
  "nextAction": "waiting for Sipher API configuration",
  "degradedCapabilities": ["privacy-features", "compliance-features"],
  "endpointsWorking": 33,
  "endpointsTotal": 45,
  "healthRate": "73.3%"
}
```

### Blocked State (Database Down)
```json
{
  "status": "blocked",
  "agentName": "ars-backend-api",
  "time": "2026-02-11T05:30:00Z",
  "version": "1.0.0",
  "capabilities": [],
  "lastAction": "database connection failed: ECONNREFUSED",
  "nextAction": "waiting for Supabase to be available",
  "blockReason": "Supabase connection timeout after 30s",
  "endpointsWorking": 0,
  "endpointsTotal": 45,
  "healthRate": "0%"
}
```

## Monitoring Integration

This heartbeat format is compatible with:
- Railway health checks (10s timeout)
- Prometheus monitoring (metrics at /metrics)
- Custom monitoring dashboards
- Agent orchestration systems

## Update Frequency

Heartbeat should be sent:
- Every 5 minutes during normal operation
- Every 30 seconds during degraded state
- Immediately after status change
- On supervisor request
- After each cron job completion (ILI: 5min, ICR: 10min)

## Cron Jobs

The backend runs scheduled tasks:
- **ILI Calculation**: Every 5 minutes (uses Kamino SDK)
- **ICR Calculation**: Every 10 minutes (currently failing - 404)
- **PnL Updates**: Every hour
- **Payment Scanner**: Every 30 seconds (if enabled)
