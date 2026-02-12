# ARS Backend - Railway Deployment Guide

## Quick Start

### 1. Prerequisites
- Railway account (https://railway.app)
- GitHub repository connected to Railway
- Supabase project created
- Solana RPC endpoint (Mainnet)
- Jupiter API key

### 2. Railway Project Setup

#### Create New Project
```bash
# Option 1: Deploy from GitHub
1. Go to Railway dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Select "backend" as root directory

# Option 2: Deploy with Railway CLI
railway login
railway init
railway up
```

#### Configure Root Directory
Railway will automatically detect `railway.toml` which sets:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.railway"

[deploy]
startCommand = ""
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### 3. Environment Variables

Add these in Railway dashboard under "Variables":

```bash
# Required - Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# Required - Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# Required - DeFi APIs
JUPITER_API_KEY=your-jupiter-api-key

# Required - Server
PORT=4000
NODE_ENV=production

# Optional - Redis Cache
UPSTASH_REDIS_URL=your-redis-url
UPSTASH_REDIS_TOKEN=your-redis-token

# Optional - Privacy/Compliance
SIPHER_ENABLED=false
SIPHER_URL=https://sipher-api-url
SIPHER_API_KEY=your-sipher-key

# Optional - Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Deploy

#### Automatic Deployment
Railway will automatically deploy when you push to your main branch.

#### Manual Deployment
```bash
railway up
```

#### Check Deployment Status
```bash
railway status
railway logs
```

### 5. Verify Deployment

#### Health Check
```bash
curl https://your-app.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-11T..."
}
```

#### Extended Health Check
```bash
curl https://your-app.up.railway.app/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "database": "ok",
    "kamino": "ok",
    "jupiter": "ok",
    "meteora": "ok"
  }
}
```

#### Test Core Endpoints
```bash
# ILI Data
curl https://your-app.up.railway.app/api/v1/ili/current

# Revenue Data
curl https://your-app.up.railway.app/api/v1/revenue/current

# API Documentation
curl https://your-app.up.railway.app/ars-llms.txt
```

### 6. Custom Domain (Optional)

#### Add Custom Domain
1. Go to Railway project settings
2. Click "Domains"
3. Click "Add Domain"
4. Enter your domain (e.g., api.ars.finance)
5. Add CNAME record to your DNS:
   ```
   CNAME api.ars.finance -> your-app.up.railway.app
   ```

#### SSL Certificate
Railway automatically provisions SSL certificates for custom domains.

### 7. Monitoring

#### View Logs
```bash
railway logs
```

#### Metrics
```bash
# Prometheus metrics
curl https://your-app.up.railway.app/metrics

# JSON metrics
curl https://your-app.up.railway.app/api/v1/metrics/json
```

#### Health Monitoring
Set up external monitoring (e.g., UptimeRobot, Pingdom) to check:
- `/health` - Every 1 minute
- `/api/v1/health` - Every 5 minutes

### 8. Scaling

#### Vertical Scaling
1. Go to Railway project settings
2. Click "Resources"
3. Adjust CPU and Memory limits

#### Horizontal Scaling
Railway supports horizontal scaling:
1. Go to project settings
2. Enable "Horizontal Scaling"
3. Set min/max replicas

### 9. Database Setup

#### Supabase Tables
Run these SQL commands in Supabase SQL Editor:

```sql
-- ILI Snapshots
CREATE TABLE ili_snapshots (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  ili NUMERIC NOT NULL,
  tvl NUMERIC NOT NULL,
  components JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ICR Data
CREATE TABLE oracle_data (
  id SERIAL PRIMARY KEY,
  data_type TEXT NOT NULL,
  source TEXT NOT NULL,
  value TEXT NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue Records
CREATE TABLE revenue_records (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  total_revenue NUMERIC NOT NULL,
  breakdown JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Staking
CREATE TABLE agent_staking (
  id SERIAL PRIMARY KEY,
  agent_pubkey TEXT NOT NULL,
  staked_amount NUMERIC NOT NULL,
  rewards NUMERIC DEFAULT 0,
  last_claim TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proposals
CREATE TABLE proposals (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  votes_for NUMERIC DEFAULT 0,
  votes_against NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ili_timestamp ON ili_snapshots(timestamp DESC);
CREATE INDEX idx_oracle_timestamp ON oracle_data(timestamp DESC);
CREATE INDEX idx_revenue_timestamp ON revenue_records(timestamp DESC);
CREATE INDEX idx_agent_pubkey ON agent_staking(agent_pubkey);
CREATE INDEX idx_proposals_status ON proposals(status);
```

### 10. Troubleshooting

#### Build Fails
```bash
# Check build logs
railway logs --build

# Common issues:
# - Missing dependencies: Check package.json
# - TypeScript errors: Run `npm run build` locally
# - Docker issues: Test Dockerfile locally
```

#### Runtime Errors
```bash
# Check runtime logs
railway logs

# Common issues:
# - Missing env vars: Check Railway variables
# - Database connection: Verify Supabase URL/key
# - API keys: Verify Jupiter API key
```

#### Health Check Fails
```bash
# Check health endpoint
curl https://your-app.up.railway.app/health

# If 503 or 500:
# - Check logs: railway logs
# - Check env vars: railway variables
# - Check database: Test Supabase connection
```

#### Slow Response Times
```bash
# Check slow queries
curl https://your-app.up.railway.app/api/v1/slow-queries/stats

# Solutions:
# - Enable Redis caching (UPSTASH_REDIS_URL)
# - Optimize database queries
# - Increase Railway resources
```

### 11. Cost Optimization

#### Railway Pricing
- Hobby Plan: $5/month (500 hours)
- Pro Plan: $20/month (unlimited)

#### Optimize Costs
1. Use Redis caching to reduce database queries
2. Set appropriate resource limits
3. Use horizontal scaling only when needed
4. Monitor usage in Railway dashboard

### 12. Security Best Practices

#### Environment Variables
- Never commit `.env` files
- Use Railway's encrypted variables
- Rotate API keys regularly

#### API Security
- Enable rate limiting (already configured)
- Use HTTPS only (Railway default)
- Monitor for suspicious activity

#### Database Security
- Use Supabase RLS (Row Level Security)
- Limit database permissions
- Regular backups (Supabase automatic)

### 13. Backup & Recovery

#### Database Backups
Supabase provides automatic daily backups:
1. Go to Supabase dashboard
2. Click "Database"
3. Click "Backups"
4. Download or restore as needed

#### Application Backups
Railway provides automatic backups:
1. Go to Railway project
2. Click "Deployments"
3. Rollback to previous deployment if needed

### 14. CI/CD Pipeline

#### Automatic Deployment
Railway automatically deploys on git push:
```bash
git add .
git commit -m "Update backend"
git push origin main
# Railway automatically deploys
```

#### Manual Deployment
```bash
railway up
```

#### Deployment Notifications
Set up notifications in Railway:
1. Go to project settings
2. Click "Notifications"
3. Add webhook or email notifications

### 15. Production Checklist

Before going live:
- [ ] All environment variables configured
- [ ] Database tables created and indexed
- [ ] Health checks passing
- [ ] API documentation accessible
- [ ] Monitoring set up
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Rate limiting tested
- [ ] Load testing completed
- [ ] Backup strategy in place
- [ ] Team access configured
- [ ] Documentation updated

### 16. Support Resources

#### Railway
- Documentation: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

#### Supabase
- Documentation: https://supabase.com/docs
- Discord: https://discord.supabase.com
- Status: https://status.supabase.com

#### ARS Backend
- API Docs: https://your-app.up.railway.app/ars-llms.txt
- Health: https://your-app.up.railway.app/health
- Metrics: https://your-app.up.railway.app/metrics

## Quick Commands Reference

```bash
# Railway CLI
railway login                    # Login to Railway
railway init                     # Initialize project
railway up                       # Deploy application
railway logs                     # View logs
railway status                   # Check status
railway variables                # List variables
railway variables set KEY=VALUE  # Set variable
railway open                     # Open in browser

# Testing
curl https://your-app.up.railway.app/health
curl https://your-app.up.railway.app/api/v1/ili/current
curl https://your-app.up.railway.app/metrics

# Monitoring
railway logs --follow            # Follow logs
railway logs --build             # Build logs only
railway logs --deployment ID     # Specific deployment
```

## Production URL

After deployment, your API will be available at:
```
https://api.agenticreserve.dev
```

Update this URL in:
- Frontend configuration
- API documentation
- External integrations
- Monitoring services
