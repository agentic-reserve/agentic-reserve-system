# Railway Deployment Guide - ICB Agent Swarm

## 🚂 Overview

Deploy the Internet Capital Bank agent swarm system on Railway with OpenClaw Gateway for autonomous operations in the cloud.

## 📋 Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Fork or clone the ICB repository
3. **API Keys**: Prepare the following:
   - OpenRouter API key
   - Helius API key
   - Birdeye API key (optional)
   - Solana wallet private key (for agent operations)

## 🚀 Quick Deploy

### Option 1: One-Click Deploy (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/icb-agent-swarm)

### Option 2: Manual Deploy

1. **Create New Project**
   ```bash
   # Login to Railway CLI
   npm install -g @railway/cli
   railway login
   
   # Create new project
   railway init
   ```

2. **Link GitHub Repository**
   - Go to Railway Dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `internet-capital-bank` repository

3. **Configure Services**
   Railway will automatically detect and create services from `railway.toml`

## 🔧 Configuration

### Required Environment Variables

#### OpenClaw Gateway
```bash
# OpenClaw Configuration
SETUP_PASSWORD=your-secure-password
PORT=8080
OPENCLAW_STATE_DIR=/data/.openclaw
OPENCLAW_WORKSPACE_DIR=/data/workspace
OPENCLAW_GATEWAY_TOKEN=your-gateway-token

# Model Configuration
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_REFERER=https://internet-capital-bank.com
```

#### Backend Service
```bash
# Backend API
PORT=4000
NODE_ENV=production

# Database
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
HELIUS_API_KEY=your-helius-key

# DeFi APIs
BIRDEYE_API_KEY=your-birdeye-key
JUPITER_API_URL=https://quote-api.jup.ag/v6
METEORA_API_URL=https://dlmm-api.meteora.ag
KAMINO_API_URL=https://api.kamino.finance
MAGIC_ROUTER_URL=https://router.magicblock.gg

# Agent Wallet (Base58 encoded private key)
AGENT_PRIVATE_KEY=your-agent-wallet-private-key
```

#### Frontend Service
```bash
PORT=3000
VITE_API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
VITE_WS_URL=wss://${{Backend.RAILWAY_PUBLIC_DOMAIN}}
```

### Service Configuration

#### 1. OpenClaw Gateway Service
```toml
[deploy]
startCommand = "openclaw gateway --port 8080"
healthcheckPath = "/health"
healthcheckTimeout = 300

[volumes]
mount = "/data"
```

**Public Networking**:
- Enable HTTP Proxy
- Port: 8080
- Domain: `icb-gateway.up.railway.app`

#### 2. Backend Service
```toml
[deploy]
startCommand = "cd backend && npm run start"
healthcheckPath = "/health"
healthcheckTimeout = 60

[volumes]
mount = "/app/data"
```

**Public Networking**:
- Enable HTTP Proxy
- Port: 4000
- Domain: `icb-api.up.railway.app`

#### 3. Agent Orchestrator Service
```toml
[deploy]
startCommand = "cd backend && npm run agent:orchestrator"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**No Public Networking** (internal service)

#### 4. Redis Service
```toml
[deploy]
image = "redis:7-alpine"
```

**No Public Networking** (internal service)

#### 5. PostgreSQL Service
```toml
[deploy]
image = "postgres:15-alpine"

[env]
POSTGRES_DB = "icb"
POSTGRES_USER = "icb"
POSTGRES_PASSWORD = "${{POSTGRES_PASSWORD}}"
```

**No Public Networking** (internal service)

## 🎯 Setup Flow

### 1. Deploy Services
```bash
# Deploy all services
railway up

# Check deployment status
railway status
```

### 2. Configure OpenClaw Gateway
1. Visit `https://icb-gateway.up.railway.app/setup`
2. Enter your `SETUP_PASSWORD`
3. Configure model provider:
   - Provider: OpenRouter
   - API Key: Your OpenRouter key
   - Model: `anthropic/claude-sonnet-4`
4. (Optional) Add chat integrations:
   - Telegram bot token
   - Discord bot token
5. Click "Run setup"

### 3. Initialize Database
```bash
# Run migrations
railway run --service backend npm run db:migrate

# Seed initial data
railway run --service backend npm run db:seed
```

### 4. Start Agent Swarm
```bash
# Start orchestrator
railway run --service icb-orchestrator npm run agent:orchestrator

# Verify agents are running
railway logs --service icb-orchestrator
```

### 5. Verify Deployment
```bash
# Check backend health
curl https://icb-api.up.railway.app/health

# Check OpenClaw gateway
curl https://icb-gateway.up.railway.app/health

# Check agent status
curl https://icb-api.up.railway.app/api/agents/status
```

## 🤖 Agent Configuration

### Agent Services on Railway

Create separate Railway services for each agent:

#### 1. Policy Agent
```bash
railway service create policy-agent
railway service set-start-command "cd backend && npm run agent:policy"
```

#### 2. Oracle Agent
```bash
railway service create oracle-agent
railway service set-start-command "cd backend && npm run agent:oracle"
```

#### 3. DeFi Agent
```bash
railway service create defi-agent
railway service set-start-command "cd backend && npm run agent:defi"
```

#### 4. Governance Agent
```bash
railway service create governance-agent
railway service set-start-command "cd backend && npm run agent:governance"
```

#### 5. Risk Agent
```bash
railway service create risk-agent
railway service set-start-command "cd backend && npm run agent:risk"
```

#### 6. Execution Agent
```bash
railway service create execution-agent
railway service set-start-command "cd backend && npm run agent:execution"
```

#### 7. Payment Agent
```bash
railway service create payment-agent
railway service set-start-command "cd backend && npm run agent:payment"
```

#### 8. Monitoring Agent
```bash
railway service create monitoring-agent
railway service set-start-command "cd backend && npm run agent:monitoring"
```

#### 9. Learning Agent
```bash
railway service create learning-agent
railway service set-start-command "cd backend && npm run agent:learning"
```

### Environment Variables for All Agents
```bash
# Shared across all agent services
REDIS_URL=${{Redis.REDIS_URL}}
DATABASE_URL=${{Postgres.DATABASE_URL}}
OPENROUTER_API_KEY=${{OPENROUTER_API_KEY}}
AGENT_PRIVATE_KEY=${{AGENT_PRIVATE_KEY}}
```

## 📊 Monitoring

### Railway Dashboard
- View logs: `railway logs --service <service-name>`
- View metrics: Railway Dashboard → Service → Metrics
- View deployments: Railway Dashboard → Service → Deployments

### Agent Health Checks
```bash
# Check all agents
curl https://icb-api.up.railway.app/api/agents/health

# Check specific agent
curl https://icb-api.up.railway.app/api/agents/policy-agent/health
```

### OpenClaw Control UI
Visit `https://icb-gateway.up.railway.app/openclaw` to:
- View agent conversations
- Monitor agent performance
- Trigger manual workflows
- View cost tracking

## 🔄 Automated Workflows

### Cron Jobs on Railway

Railway doesn't support native cron jobs, so we use the orchestrator's internal scheduler:

#### ILI Update (Every 5 minutes)
```typescript
// Automatically runs via orchestrator
// No Railway configuration needed
```

#### Vault Rebalance (Every 6 hours)
```typescript
// Automatically runs via orchestrator
// No Railway configuration needed
```

#### AI Policy Recommendation (Daily)
```typescript
// Automatically runs via orchestrator
// No Railway configuration needed
```

### Manual Workflow Triggers
```bash
# Trigger ILI update
curl -X POST https://icb-api.up.railway.app/api/workflows/ili-update

# Trigger policy execution
curl -X POST https://icb-api.up.railway.app/api/workflows/policy-execution \
  -H "Content-Type: application/json" \
  -d '{"proposal_id": "123"}'

# Trigger circuit breaker
curl -X POST https://icb-api.up.railway.app/api/workflows/circuit-breaker \
  -H "Content-Type: application/json" \
  -d '{"vhr": 145, "reason": "VHR below critical"}'
```

## 💰 Cost Estimation

### Railway Costs
- **Hobby Plan**: $5/month (500 hours)
- **Pro Plan**: $20/month (unlimited hours)

### Service Resource Usage
| Service | CPU | RAM | Storage | Est. Cost |
|---------|-----|-----|---------|-----------|
| OpenClaw Gateway | 0.5 vCPU | 512 MB | 1 GB | $5/mo |
| Backend API | 1 vCPU | 1 GB | 1 GB | $10/mo |
| Orchestrator | 0.5 vCPU | 512 MB | - | $5/mo |
| Each Agent (10) | 0.25 vCPU | 256 MB | - | $2.50/mo |
| Redis | 0.25 vCPU | 256 MB | 1 GB | $2.50/mo |
| PostgreSQL | 0.5 vCPU | 512 MB | 5 GB | $7.50/mo |
| **Total** | | | | **~$57.50/mo** |

### API Costs
- **OpenRouter**: ~$0.003 per request (Claude Sonnet 4)
- **Helius**: Free tier (100k requests/day)
- **Birdeye**: Free tier (100 requests/min)
- **x402 Payments**: Variable (USDC on Solana)

**Estimated Monthly API Costs**: $50-100 (depending on usage)

## 🔐 Security

### Secrets Management
```bash
# Add secrets via Railway CLI
railway variables set OPENROUTER_API_KEY=sk-...
railway variables set AGENT_PRIVATE_KEY=base58-encoded-key
railway variables set SETUP_PASSWORD=secure-password
```

### Network Security
- All internal services (Redis, PostgreSQL, agents) are private
- Only Gateway and Backend have public domains
- Use Railway's built-in SSL/TLS

### Agent Wallet Security
- Store agent private key in Railway secrets
- Use separate wallet for each environment (dev/staging/prod)
- Monitor wallet balance and transactions

## 📦 Backup & Migration

### Export OpenClaw State
```bash
# Download backup
curl https://icb-gateway.up.railway.app/setup/export \
  -H "Authorization: Bearer $SETUP_PASSWORD" \
  -o openclaw-backup.tar.gz
```

### Export Database
```bash
# Backup PostgreSQL
railway run --service postgres pg_dump $DATABASE_URL > icb-backup.sql

# Restore
railway run --service postgres psql $DATABASE_URL < icb-backup.sql
```

### Export Redis Data
```bash
# Backup Redis
railway run --service redis redis-cli --rdb /tmp/dump.rdb
railway run --service redis cat /tmp/dump.rdb > redis-backup.rdb

# Restore
railway run --service redis redis-cli --pipe < redis-backup.rdb
```

## 🐛 Troubleshooting

### Agent Not Starting
```bash
# Check logs
railway logs --service policy-agent

# Restart service
railway service restart policy-agent

# Check environment variables
railway variables --service policy-agent
```

### Redis Connection Issues
```bash
# Verify Redis is running
railway logs --service redis

# Test connection
railway run --service backend redis-cli -u $REDIS_URL ping
```

### OpenClaw Gateway Issues
```bash
# Check gateway logs
railway logs --service openclaw-gateway

# Verify volume is mounted
railway volumes list

# Restart gateway
railway service restart openclaw-gateway
```

### High API Costs
```bash
# Check OpenRouter usage
curl https://icb-api.up.railway.app/api/costs/openrouter

# Switch to cheaper model
railway variables set OPENROUTER_MODEL=openrouter/mixtral-8x7b
```

## 🚀 Scaling

### Horizontal Scaling
```bash
# Scale agent services
railway service scale policy-agent --replicas 2

# Scale backend
railway service scale backend --replicas 3
```

### Vertical Scaling
```bash
# Increase resources
railway service set-resources policy-agent --cpu 1 --memory 1024
```

### Auto-Scaling
Railway Pro plan supports auto-scaling based on:
- CPU usage
- Memory usage
- Request rate

## 📚 Resources

- [Railway Documentation](https://docs.railway.app)
- [OpenClaw Railway Guide](https://docs.openclaw.ai/railway)
- [ICB Agent Swarm Architecture](./AGENT_SWARM_ARCHITECTURE.md)
- [ICB Complete Summary](./COMPLETE_PROJECT_SUMMARY.md)

## 🎉 Success Checklist

- [ ] All services deployed on Railway
- [ ] OpenClaw Gateway configured at `/setup`
- [ ] Database migrations completed
- [ ] All 10 agents running
- [ ] Orchestrator executing workflows
- [ ] Backend API responding
- [ ] Frontend accessible
- [ ] Redis connected
- [ ] PostgreSQL connected
- [ ] Monitoring dashboard active
- [ ] Automated workflows running
- [ ] Backup strategy in place

## 🆘 Support

- **Railway Support**: [railway.app/help](https://railway.app/help)
- **OpenClaw Discord**: [discord.gg/openclaw](https://discord.gg/openclaw)
- **ICB GitHub Issues**: [github.com/protocoldaemon-sec/internet-capital-bank/issues](https://github.com/protocoldaemon-sec/internet-capital-bank/issues)

---

**Deploy the most agentic DeFi project on Railway! 🚂🤖**
