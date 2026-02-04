# Running ARS Demo - Complete Guide

This guide will help you run the complete ARS demo with seeded data.

## Prerequisites

1. **Node.js** (v18+) - `node --version`
2. **Supabase Account** - Database already configured
3. **Git** - For cloning

## Quick Start (3 Steps)

### Step 1: Create Database Tables

The SQL migration file is ready at `supabase/migrations/002_create_all_tables.sql`.

**Option A: Via Supabase Dashboard** (Recommended)
1. Go to https://supabase.com/dashboard
2. Select your project: `nbgyuavahktdbxpgpyvr`
3. Click "SQL Editor" in left sidebar
4. Click "New Query"
5. Copy contents of `supabase/migrations/002_create_all_tables.sql`
6. Paste and click "Run"
7. Wait for "Success" message

**Option B: Via Supabase CLI** (If installed)
```bash
supabase db push
```

### Step 2: Seed Database with Demo Data

```bash
cd backend
npm run seed
```

This will create:
- ✅ 168 ILI history records (7 days, hourly)
- ✅ 4 proposals (1 executed, 1 passed, 1 rejected, 1 active)
- ✅ 9 votes across proposals
- ✅ 5 agents with transaction history
- ✅ 8 reserve rebalancing events
- ✅ 48 revenue events (6 types × 8 days)
- ✅ 5 agent staking records

**Expected Output:**
```
========================================
ARS Database Seeding Script
========================================

Seeding ILI history...
✓ Seeded 168 ILI history records
Seeding proposals...
✓ Seeded 4 proposals
Seeding votes...
✓ Seeded 9 votes
Seeding agents...
✓ Seeded 5 agents
Seeding reserve events...
✓ Seeded 8 reserve events
Seeding revenue events...
✓ Seeded 48 revenue events
Seeding agent staking...
✓ Seeded 5 agent staking records

========================================
✓ Database seeding completed successfully!
========================================
```

### Step 3: Start API Server

```bash
cd backend
npm run dev:simple
```

**Expected Output:**
```
========================================
ARS Simple API Server
========================================
Server running on http://localhost:3000

Available endpoints:
  GET  /health
  GET  /ili/current
  GET  /ili/history
  GET  /icr/current
  GET  /reserve/state
  GET  /reserve/rebalance-history
  GET  /proposals
  GET  /proposals/:id
  GET  /revenue/current
  GET  /revenue/breakdown
  GET  /agents/staking/metrics
  GET  /history/policies
========================================
```

### Step 4: Start Frontend (Optional)

In a new terminal:

```bash
cd frontend
npm run dev
```

Open browser: http://localhost:5173

## Testing Endpoints

### Test with curl

```bash
# Health check
curl http://localhost:3000/health

# Get current ILI
curl http://localhost:3000/ili/current

# Get ILI history (last 24 hours)
curl "http://localhost:3000/ili/history?start=$(date -d '1 day ago' +%s)000&end=$(date +%s)000"

# Get current ICR
curl http://localhost:3000/icr/current

# Get reserve state
curl http://localhost:3000/reserve/state

# Get proposals
curl http://localhost:3000/proposals

# Get active proposals only
curl http://localhost:3000/proposals?status=active

# Get specific proposal
curl http://localhost:3000/proposals/1

# Get revenue metrics
curl http://localhost:3000/revenue/current

# Get revenue breakdown
curl http://localhost:3000/revenue/breakdown

# Get staking metrics
curl http://localhost:3000/agents/staking/metrics

# Get policy history
curl http://localhost:3000/history/policies

# Get rebalance history
curl http://localhost:3000/reserve/rebalance-history
```

### Test with Browser

Open these URLs in your browser:

- http://localhost:3000/health
- http://localhost:3000/ili/current
- http://localhost:3000/proposals
- http://localhost:3000/revenue/current
- http://localhost:3000/reserve/state

## Expected Data

### ILI (Internet Liquidity Index)
- **Value**: ~450-550 (varies)
- **Avg Yield**: 5-15% (500-1500 basis points)
- **Volatility**: 1-5% (100-500 basis points)
- **TVL**: $10M-$50M

### ICR (Internet Credit Rate)
- **Value**: 7.5-9.5%
- **Confidence**: 95%
- **Sources**: Kamino, Solend, MarginFi

### Reserve Vault
- **VHR**: 150-210%
- **Total Value**: $25M-$30M
- **Assets**:
  - USDC: 40%
  - SOL: 35%
  - mSOL: 25%

### Proposals
1. **Proposal #1** (Executed)
   - Type: MINT
   - Amount: 1M ARU
   - Yes: 15,000 ARU (65%)
   - No: 8,000 ARU (35%)

2. **Proposal #2** (Passed)
   - Type: REBALANCE
   - From: SOL → USDC
   - Yes: 12,000 ARU (71%)
   - No: 5,000 ARU (29%)

3. **Proposal #3** (Rejected)
   - Type: BURN
   - Amount: 500K ARU
   - Yes: 8,000 ARU (36%)
   - No: 14,000 ARU (64%)

4. **Proposal #4** (Active)
   - Type: ICR_UPDATE
   - New ICR: 7.5%
   - Yes: 10,000 ARU (63%)
   - No: 6,000 ARU (37%)

### Revenue
- **Daily**: $200-400
- **Monthly**: $6,000-$12,000
- **Annual**: $73,000-$146,000
- **Agent Count**: 5
- **Avg Fee/Agent**: $40-$80/day

### Staking
- **Total Staked**: 67,000 ARU
- **Staking APY**: 124.5%
- **Rewards Pool**: 1,025 ARU
- **Total Stakers**: 5

## Troubleshooting

### Database Tables Not Found

If you get "table not found" errors:

1. Make sure you ran the SQL migration (Step 1)
2. Check Supabase dashboard → Table Editor
3. Verify tables exist: `ili_history`, `proposals`, `votes`, etc.
4. Re-run the SQL migration if needed

### Seeding Fails

If seeding fails:

1. Check `.env` file has correct Supabase credentials
2. Verify `SUPABASE_SERVICE_KEY` (not `SUPABASE_ANON_KEY`)
3. Check Supabase project is active
4. Try running seed script again

### API Server Won't Start

If server fails to start:

1. Check port 3000 is not in use:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Mac/Linux
   lsof -ti:3000
   ```

2. Kill existing process if needed
3. Check `.env` file exists in `backend/` folder
4. Verify Node.js version: `node --version` (should be 18+)

### Frontend Can't Connect

If frontend can't reach API:

1. Verify backend is running on port 3000
2. Check `frontend/.env` has `VITE_API_URL=http://localhost:3000`
3. Clear browser cache
4. Try incognito/private mode
5. Check browser console for errors

## Demo Scenarios

### Scenario 1: View System Health

1. Open http://localhost:5173
2. See ILI heartbeat animation
3. Check ICR display
4. View reserve vault composition
5. Monitor oracle status

### Scenario 2: Explore Proposals

1. Navigate to Proposals page
2. Filter by status (active, passed, rejected)
3. Click on a proposal to see details
4. View voting statistics
5. See quadratic staking explanation

### Scenario 3: Analyze History

1. Navigate to History page
2. View policy execution timeline
3. See ILI/ICR/VHR charts
4. Adjust date range
5. Analyze impact of policy decisions

### Scenario 4: Monitor Revenue

1. View revenue metrics on dashboard
2. See daily/monthly/annual projections
3. Check fee breakdown by type
4. View agent count and average fees
5. Monitor staking APY

### Scenario 5: Check Reserve Health

1. Navigate to Reserve page
2. View vault composition pie chart
3. Check VHR health indicator
4. See rebalance history
5. Click transaction links to Solscan

## API Response Examples

### GET /ili/current

```json
{
  "value": 487.23,
  "timestamp": 1738656000000,
  "avgYield": 1250,
  "volatility": 320,
  "tvl": 35000000
}
```

### GET /proposals

```json
{
  "proposals": [
    {
      "id": 4,
      "title": "ICR_UPDATE Proposal #4",
      "description": "Adjust based on market conditions",
      "policy_type": "icr_update",
      "status": "active",
      "yes_stake": 10000,
      "no_stake": 6000,
      "total_stake": 16000,
      "created_at": "2026-02-03T00:00:00Z",
      "voting_ends_at": "2026-02-05T00:00:00Z"
    }
  ]
}
```

### GET /reserve/state

```json
{
  "vault": {
    "vhr": 175.5,
    "totalValue": 27500000,
    "liabilities": 15668449,
    "assets": [
      { "symbol": "USDC", "amount": 11000000, "valueUsd": 11000000, "percentage": 40 },
      { "symbol": "SOL", "amount": 9625000, "valueUsd": 9625000, "percentage": 35 },
      { "symbol": "mSOL", "amount": 6875000, "valueUsd": 6875000, "percentage": 25 }
    ],
    "lastRebalance": 1738652400000,
    "circuitBreakerActive": false
  }
}
```

## Performance Benchmarks

Expected response times:

| Endpoint | Response Time |
|----------|--------------|
| /health | <10ms |
| /ili/current | 50-100ms |
| /ili/history | 100-200ms |
| /proposals | 100-150ms |
| /reserve/state | 80-120ms |
| /revenue/current | 150-250ms |

## Next Steps

After running the demo:

1. ✅ Test all API endpoints
2. ✅ Explore frontend dashboard
3. ✅ Review seeded data in Supabase
4. ✅ Take screenshots for documentation
5. ✅ Record demo video
6. ✅ Prepare final submission

## Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review logs in terminal
3. Check Supabase dashboard for errors
4. Verify environment variables
5. Try restarting services

## Clean Up

To reset the demo:

```bash
# Delete all data from Supabase
# Go to Supabase Dashboard → SQL Editor
# Run: TRUNCATE TABLE ili_history, proposals, votes, agents, reserve_events, revenue_events, agent_staking CASCADE;

# Re-seed database
cd backend
npm run seed
```

## Summary

You now have:
- ✅ Complete database with 7 days of historical data
- ✅ Working API server with 12 endpoints
- ✅ Frontend dashboard (optional)
- ✅ 4 proposals with voting data
- ✅ 5 agents with transaction history
- ✅ Revenue and staking metrics
- ✅ Reserve rebalancing history

**Demo is ready!** 🎉

---

**Last Updated**: February 4, 2026  
**Status**: Ready for demo and submission
