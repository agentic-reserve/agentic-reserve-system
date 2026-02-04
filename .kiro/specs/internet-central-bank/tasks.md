# Internet Central Bank (ICB) - Implementation Tasks

## Overview

This task list breaks down the ICB implementation into concrete, actionable tasks for a 10-day hackathon sprint.

**Timeline**: 10 days (Feb 3 - Feb 12, 2026)
**Tech Stack**: 
- Backend: TypeScript/Express + PostgreSQL + Redis
- Frontend: Vite + React + Tailwind CSS
- Blockchain: Solana/Anchor (Rust)
- AI Assistant: OpenClaw for development automation

## Task Status Legend
- `[ ]` = Not started
- `[~]` = Queued
- `[-]` = In progress
- `[x]` = Completed
- `[ ]*` = Optional

## Using OpenClaw for Development

OpenClaw is integrated throughout this project to accelerate development:

**Automation Features**:
- **Cron Jobs**: Schedule oracle updates, ILI calculations, policy monitoring
- **Webhooks**: Trigger actions on blockchain events (proposal execution, vault rebalance)
- **Multi-Agent**: Coordinate specialized agents for backend, frontend, and smart contract development
- **Skills**: Custom development workflows for Solana/Anchor, React, and Express
- **Browser Tools**: Test frontend UI and wallet interactions
- **Exec Tools**: Run build commands, tests, and deployments

**Development Workflow**:
1.  CLI to scaffold project structure
2. Leverage sub-agents for parallel development (backend + frontend + contracts)
3. Set up cron jobs for automated testing and oracle data fetching
4. Use webhooks to monitor devnet deployments
5. Integrate browser tools for UI testing

**Key Commands**:
```bash
# Set up OpenClaw for this project
openclaw setup

# Create development agents
openclaw agents create backend-agent --skill typescript-express
openclaw agents create frontend-agent --skill react-vite
openclaw agents create solana-agent --skill anchor-rust

# Schedule oracle updates
openclaw cron create "*/5 * * * *" "node backend/src/services/ili-calculator.ts"

# Monitor proposal execution
openclaw hooks create proposal-webhook --event blockchain --action notify
```

---

## Phase 1: Project Setup & Infrastructure (Days 1-2)

### 1. Project Initialization

- [x] 1.1 Initialize monorepo with backend/, frontend/, programs/ directories
  -  exec tool to scaffold structure
  - Create package.json for workspace management
- [x] 1.2 Initialize Anchor workspace with three programs
  - Run `anchor init icb-protocol` via OpenClaw
  - Configure Anchor.toml for devnet
- [ ] 1.3 Set up Express.js backend with TypeScript
  -  generate Express boilerplate
  - Configure tsconfig.json and nodemon
- [ ] 1.4 Set up Supabase and Redis with Docker Compose
  - Create docker-compose.yml with OpenClaw
  - Set up Supabase project (PostgreSQL + real-time + auth)
  - Configure Redis for caching
  - Set up health checks and volume mounts
  - Enable Supabase real-time subscriptions
  - Configure Row Level Security for agent data
- [ ] 1.5 Initialize Vite + React + TypeScript frontend
  -  scaffold Vite project
  - Configure vite.config.ts
- [ ] 1.6 Configure Tailwind CSS and install dependencies
  -  set up Tailwind config
  - Install all npm dependencies

---

## Phase 2: Oracle & Data Layer (Days 2-4)

### 2. Oracle Aggregation Service

- [ ] 2.1 Set up Helius SDK client with RPC connection
  -  generate Helius client wrapper
  - Add retry logic and error handling
  - Configure Priority Fee API integration
- [ ] 2.2 Integrate Pyth oracle for SOL, USDC, mSOL prices
  -  scaffold Pyth integration
  - Set up cron job for price updates (every 5 min)
  - Use Helius RPC for reliable data access
- [ ] 2.3 Integrate Switchboard oracle with confidence intervals
  -  generate Switchboard client
  - Add data validation logic
  - Use Helius RPC for queries
- [ ] 2.4 Integrate Birdeye API for market data
  -  create API client with rate limiting
  - Set up Redis caching
  - Add x402-PayAI for premium data access
- [ ] 2.5 Implement tri-source median aggregation with outlier detection
  -  generate aggregation logic
  - Add statistical outlier detection (>2σ)
- [ ] 2.6 Create oracle health monitoring service
  -  cron to schedule health checks
  - Set up webhook alerts for failures
- [ ] 2.7 Write property-based test for median calculation resistance
  -  generate fast-check tests
  - Validate manipulation resistance

**Property Test 2.7**: Verify median calculation resists single-source manipulation
- **Validates**: Requirements 6.2, 6.3

### 3. DeFi Protocol Integration

- [ ] 3.1 Integrate Jupiter API for swap volume and liquidity
  -  generate Jupiter client
  - Add swap execution for vault rebalancing
- [ ] 3.2 Integrate Meteora API for pool TVL and yield data
  -  scaffold Meteora integration
  - Add DLMM pool data fetching
  - Add Dynamic Vault APY tracking
  - Add DAMM v2 pool metrics
  - Add Stake2Earn data
- [ ] 3.3 Integrate Kamino Finance for lending rates
  -  generate Kamino SDK client
  - Add lending/borrowing operations
  - Add eMode (Elevation Mode) support
  - Add Multiply Vault integration
  - Add kToken collateral support
- [ ] 3.4 Integrate MagicBlock Ephemeral Rollups
  -  scaffold ER client
  - Add account delegation workflow
  - Add session management
  - Add state commitment logic
  - Add Magic Router integration
- [ ] 3.5 Integrate OpenRouter AI
  -  generate OpenRouter client
  - Add multi-model support
  - Add cost tracking
  - Add streaming responses
- [ ] 3.6 Integrate x402-PayAI
  -  scaffold x402 client
  - Add USDC payment logic
  - Add budget tracking
  - Add retry logic
- [ ] 3.7 Write unit tests for all protocol integrations
  -  generate test suites
  - Test each integration independently

### 4. ILI Calculator Service

- [ ] 4.1 Implement ILI formula with yield, volatility, TVL components
  -  generate calculation logic
  - Add mathematical validation
  - Include Meteora DLMM and Dynamic Vault data
  - Include Kamino lending rates and TVL
  - Include Jupiter swap volume
- [ ] 4.2 Create ILI update scheduler (every 5 minutes)
  -  cron: `*/5 * * * *`
  - Set up automated execution
  - Use Helius RPC for reliable data access
- [ ] 4.3 Store ILI snapshots in Supabase
  -  generate database queries
  - Add transaction handling
  - Enable real-time subscriptions for agents
- [ ] 4.4 Cache current ILI in Redis
  -  implement caching layer
  - Set 5-minute TTL
- [ ] 4.5 Write property-based test for ILI bounds
  -  generate fast-check tests
  - Validate positivity and bounds

**Property Test 4.5**: Verify ILI is always positive and bounded
- **Validates**: Requirements 1.5

### 5. ICR Calculator Service

- [ ] 5.1 Implement weighted average ICR from lending protocols
  -  generate calculation logic
  - Prioritize Kamino Finance (largest TVL)
  - Include MarginFi, Solend, Port Finance
  - Use Helius RPC for reliable data access
- [ ] 5.2 Calculate confidence intervals
  -  implement statistical logic
  - Add outlier detection
- [ ] 5.3 Create ICR update scheduler (every 10 minutes)
  -  cron: `*/10 * * * *`
  - Set up automated execution
- [ ] 5.4 Store ICR history and cache current value
  -  generate Supabase queries
  - Set up Redis caching
  - Enable real-time subscriptions
- [ ] 5.5 Write property-based test for ICR bounds
  -  generate fast-check tests
  - Validate 0-100% range

**Property Test 5.5**: Verify ICR stays within 0-100% range
- **Validates**: Requirements 4.1, 4.5

---

## Phase 3: Revenue & Fee Tracking (New Phase)

### 6. Revenue Tracking Service

- [ ] 6.1 Implement transaction fee collection (0.05%)
  -  generate fee calculation logic
  - Add fee collection on all agent operations
  - Store in Supabase revenue_events table
- [ ] 6.2 Implement oracle query fee tracking (x402-PayAI)
  - Track basic (free), real-time (0.001 USDC), premium (0.01 USDC) queries
  - Integrate with x402 payment protocol
  - Store in oracle_query_fees table
- [ ] 6.3 Implement ER session fee collection (0.02%)
  - Calculate fee on MagicBlock session creation
  - Track session value and fee amount
  - Store in revenue_events table
- [ ] 6.4 Implement AI usage markup tracking (10%)
  - Track OpenRouter API costs
  - Add 10% markup for ICB
  - Store markup revenue in revenue_events
- [ ] 6.5 Implement proposal fee collection (10 ICU burned)
  - Burn 10 ICU on proposal creation
  - Track burned amount in proposals table
  - Update ICU total supply
- [ ] 6.6 Implement vault management fee (0.1% annually)
  - Calculate quarterly fee on vault TVL
  - Distribute to ICU stakers
  - Store in revenue_events table
- [ ] 6.7 Create revenue distribution service
  - Calculate 40% buyback, 30% staking, 20% dev, 10% insurance
  - Execute ICU buyback via Jupiter
  - Distribute staking rewards to agents
  - Store in revenue_distributions table
- [ ] 6.8 Create revenue analytics dashboard
  - Use Supabase real-time for live revenue tracking
  - Show daily/monthly/annual projections
  - Display fee breakdown by type
  - Show agent fee contributions

### 7. Agent Staking System

- [ ] 7.1 Implement ICU staking for agents
  - Create staking contract on Solana
  - Track staked amounts in agent_staking table
  - Enable 50% fee discount for stakers
- [ ] 7.2 Implement staking rewards distribution
  - Calculate rewards from 30% of protocol fees
  - Distribute proportionally to staked ICU
  - Allow agents to claim rewards
- [ ] 7.3 Calculate and display staking APY
  - Real-time APY based on protocol revenue
  - Show projected APY for different agent counts
  - Update via Supabase real-time subscriptions

---

## Phase 4: Smart Contracts (Days 4-6)

### 8. ICB Core Program

- [ ] 8.1 Define account structures (GlobalState, ILIOracle, PolicyProposal, VoteRecord)
- [ ] 8.2 Implement initialization instructions
- [ ] 8.3 Implement ILI oracle update and query instructions
- [ ] 8.4 Implement futarchy proposal creation and voting with quadratic staking
- [ ] 8.5 Implement proposal execution with slashing logic
- [ ] 8.6 Implement circuit breaker logic (VHR and oracle health checks)
- [ ] 8.7 Write property-based test for futarchy stake invariants

**Property Test 8.7**: Verify total_stake = yes_stake + no_stake always holds
- **Validates**: Requirements 2.3, 2.6

### 9. ICB Reserve Program

- [ ] 9.1 Define ReserveVault and AssetConfig structures
  -  generate Anchor account structures
  - Add support for multiple asset types
- [ ] 9.2 Implement vault initialization and deposit/withdraw
  -  generate Anchor instructions
  - Add Helius Sender for reliable transactions
- [ ] 9.3 Implement VHR calculation logic
  -  generate calculation logic
  - Add circuit breaker integration
- [ ] 9.4 Implement rebalancing with Jupiter swap integration
  -  generate swap logic
  - Add Meteora liquidity provision
  - Add Kamino lending/borrowing
  - Add MagicBlock ER for high-frequency rebalancing
- [ ] 9.5 Emit rebalance events with metadata
  -  generate event emission
  - Add Helius LaserStream monitoring
- [ ] 9.6 Write property-based test for VHR invariants
  -  generate fast-check tests
  - Validate VHR >= 150% or circuit breaker active

**Property Test 9.6**: Verify VHR >= 150% or circuit breaker active
- **Validates**: Requirements 3.3

### 10. ICU Token Program

- [ ] 10.1 Create SPL token mint with controlled authority
- [ ] 10.2 Implement mint/burn instructions with ±2% cap validation
- [ ] 10.3 Implement stability fee collection (0.1%)
- [ ] 10.4 Add circuit breaker integration
- [ ] 10.5 Emit mint/burn events with reasoning hash
- [ ] 10.6 Write property-based test for supply cap

**Property Test 10.6**: Verify mint/burn never exceeds ±2% per epoch
- **Validates**: Requirements 5.2

---

## Phase 4: Backend API (Days 6-7)

### 11. REST API Endpoints

- [ ] 11.1 Implement ILI endpoints (current, history)
  -  generate Express routes
  - Add Supabase queries for historical data
  - Enable real-time subscriptions
- [ ] 11.2 Implement ICR endpoints (current)
  -  generate Express routes
  - Add Redis caching
- [ ] 11.3 Implement proposal endpoints (list, detail, create, vote)
  -  generate CRUD operations
  - Add Supabase real-time subscriptions
  - Track proposal fees
- [ ] 11.4 Implement reserve endpoints (state, history)
  -  generate vault queries
  - Add management fee tracking
- [ ] 11.5 Implement revenue endpoints (NEW)
  - GET /revenue/current - Current revenue metrics
  - GET /revenue/history - Historical revenue data
  - GET /revenue/projections - Revenue projections by agent count
  - GET /revenue/breakdown - Fee breakdown by type
  - GET /revenue/distributions - Distribution history
- [ ] 11.6 Implement agent endpoints (NEW)
  - GET /agents/:pubkey/fees - Agent fee history
  - GET /agents/:pubkey/staking - Staking status and rewards
  - POST /agents/:pubkey/stake - Stake ICU tokens
  - POST /agents/:pubkey/claim - Claim staking rewards
- [ ] 11.7 Add rate limiting and caching
  -  implement rate limiting
  - Add Redis caching for expensive queries
- [ ] 11.8 Write API integration tests
  -  generate test suites
  - Test all revenue endpoints

### 12. WebSocket API

- [ ] 12.1 Set up WebSocket server
  -  scaffold WebSocket server
  - Integrate with Supabase real-time
- [ ] 12.2 Implement real-time channels (ili, proposals, reserve, revenue)
  - Add revenue channel for live fee tracking
  - Add staking channel for reward updates
- [ ] 12.3 Add event broadcasting logic
  -  implement event handlers
  - Broadcast to subscribed agents
- [ ] 12.4 Write WebSocket tests
  -  generate test scenarios
  - Test real-time subscriptions

### 13. Policy Executor Service

- [ ] 13.1 Create background job to monitor proposals
  -  cron to check proposals every minute
  - Set up webhook for proposal state changes
- [ ] 13.2 Implement policy execution (mint/burn, ICR update, rebalance)
  -  generate transaction builders
  - Add Solana transaction signing
  - Collect proposal fees (10 ICU burned)
- [ ] 13.3 Add transaction retry logic
  -  implement exponential backoff
  - Add failure notifications
- [ ] 13.4 Write integration tests
  -  generate test scenarios
  - Test full execution flow

---

## Phase 6: Frontend Dashboard (Days 7-9)

### 14. Core UI Components

- [ ] 14.1 Create responsive layout (Header, Sidebar, Footer)
  -  scaffold React components
  - Add Tailwind responsive classes
- [ ] 14.2 Set up Solana Wallet Adapter
  -  generate wallet integration
  - Add wallet state management
- [ ] 14.3 Create wallet connection component
  -  browser tool to test wallet flows
  - Add error handling

### 15. Dashboard Page

- [ ] 15.1 Create ILI heartbeat visualization with 24h chart
  -  generate Recharts components
  - Add animated heartbeat effect
- [ ] 15.2 Create ICR display with trend chart
  -  scaffold chart components
  - Add confidence interval visualization
- [ ] 15.3 Create reserve vault pie chart with VHR
  -  generate pie chart
  - Add color-coded health indicators
- [ ] 15.4 Create oracle status indicators
  -  build status components
  - Add real-time health monitoring
- [ ] 15.5 Create revenue metrics dashboard (NEW)
  - Display current daily/monthly/annual revenue
  - Show fee breakdown by type (transaction, oracle, ER, AI, proposal, vault)
  - Display agent count and average fees per agent
  - Show revenue projections for 100/1,000/10,000 agents
  - Real-time revenue counter via Supabase subscriptions
- [ ] 15.6 Create staking metrics display (NEW)
  - Show total ICU staked
  - Display current staking APY
  - Show staking rewards pool
  - Display ICU buyback and burn stats
- [ ] 15.7 Implement real-time updates via WebSocket
  -  set up WebSocket client
  - Add reconnection logic
  - Subscribe to revenue and staking channels

### 16. Proposals Page

- [ ] 16.1 Create proposal list with filtering
- [ ] 16.2 Create proposal detail page
- [ ] 16.3 Create voting UI with stake input
- [ ] 16.4 Create proposal creation form
- [ ] 16.5 Implement wallet transaction signing

### 17. History Page

- [ ] 17.1 Create policy timeline component
- [ ] 17.2 Create historical charts (ILI, ICR, VHR)
- [ ] 17.3 Add date range selector

### 18. Reserve Page

- [ ] 16.1 Display detailed vault composition
- [ ] 16.2 Create rebalance history component

### 17. Documentation Page

- [ ] 17.1 Create SDK installation guide
- [ ] 17.2 Add code examples and API reference

---

## Phase 6: Integration SDK (Day 9)

### 18. TypeScript SDK

- [ ] 18.1 Create ICBClient with getILI(), getICR(), getReserveState()
- [ ] 18.2 Implement real-time subscriptions (onILIUpdate, onProposalUpdate)
- [ ] 18.3 Implement transaction methods (createProposal, voteOnProposal)
- [ ] 18.4 Write README and 3 integration examples
- [ ] 18.5 Generate TypeDoc documentation

---

## Phase 7: Testing & Demo (Days 9-10)

### 19. Integration Testing

- [ ] 19.1 Test end-to-end ILI calculation flow
- [ ] 19.2 Test full proposal lifecycle
- [ ] 19.3 Test reserve rebalancing flow
- [ ] 19.4 Test circuit breaker activation
- [ ] 19.5 Load test API (100 concurrent requests)

### 20. Demo Preparation

- [ ] 20.1 Create 3 demo scenarios with scripts
  -  generate demo scripts
  - Test each scenario end-to-end
- [ ] 20.2 Seed database with 7 days historical data
  -  generate seed data
  - Run migration scripts
- [ ] 20.3 Create sample proposals and votes
  -  create realistic test data
  - Populate with diverse scenarios
- [ ] 20.4 Record demo video (5-7 minutes)
  -  browser tool for screen recording
  - Edit and add narration

### 21. Documentation & Submission

- [ ] 21.1 Write comprehensive README.md
- [ ] 21.2 Create ARCHITECTURE.md and DEPLOYMENT.md
- [x] 21.3 Create forum discussion post (FORUM_DISCUSSION_POST.md)
- [x] 21.4 Create competitor analysis (COMPETITOR_ANALYSIS.md)
- [ ] 21.5 Register project on Colosseum platform
- [ ] 21.6 Upload demo video and submit repository
- [ ] 21.7 Post on hackathon forum

---

## Optional Enhancements

- [ ]* 22.1 Add AI-powered policy recommendations
- [ ]* 22.2 Implement advanced conditional futarchy
- [ ]* 22.3 Add governance token distribution
- [ ]* 22.4 Create mobile PWA version
- [ ]* 22.5 Add email/Discord notifications

---

## Success Criteria

### Technical Milestones
- [x] Requirements document completed
- [x] Design document completed
- [x] Smart contracts deployed to devnet
- [-] Backend API functional
- [ ] Frontend dashboard live
- [ ] SDK published and documented
- [ ] Demo video recorded

### Functional Requirements
- [ ] ILI from 3+ protocols
- [ ] 1+ successful futarchy proposal
- [ ] Reserve vault with 3 assets
- [ ] Real-time dashboard
- [ ] Working SDK example
- [ ] All property tests pass

### Hackathon Submission
- [ ] Project registered
- [ ] Demo video uploaded
- [ ] Repository public
- [ ] Forum post published
- [ ] Submitted before Feb 12, 2026

---

**Let's build autonomous monetary policy! 🏛️**

## OpenClaw Integration Summary

**Status:** ✅ **SETUP COMPLETE**

Throughout this project, OpenClaw provides:

1. **Code Generation**: Scaffold components, services, and smart contracts
2. **Automation**: Cron jobs for oracle updates and monitoring
3. **Testing**: Browser tools for UI testing, exec tools for unit tests
4. **Deployment**: Automated build and deployment scripts
5. **Monitoring**: Webhooks for blockchain events and system health
6. **Collaboration**: Multi-agent coordination for parallel development

**Current Setup:**
- ✅ OpenClaw 2026.1.30 installed globally
- ✅ Gateway running as Windows Scheduled Task
- ✅ Dashboard accessible at http://127.0.0.1:18789
- ✅ 4 agents configured:
  - `solana-dev` - Solana/Anchor smart contract development
  - `defi-integration` - DeFi protocol integration (Kamino, Meteora, Jupiter)
  - `oracle-agent` - Oracle data aggregation (ILI/ICR calculation)
  - `testing-agent` - Testing and quality assurance
- ✅ WhatsApp integration active (+6285161740419)
- ✅ Model: OpenRouter/Anthropic Claude Sonnet 4.5
- ✅ Project config: `.openclaw/config.json`
- ✅ npm scripts: `npm run openclaw:gateway`, `npm run openclaw:dashboard`

**Next Steps**: 
1. ✅ ~~Set up OpenClaw in your development environment~~ **COMPLETE**
2. ✅ ~~Configure agents for backend, frontend, and blockchain development~~ **COMPLETE**
3. 🔄 **START NOW:** Phase 1 tasks (Project Initialization)
4. 🔄  CLI to accelerate development at each phase

**Quick Commands:**
```bash
# Start gateway (if not running)
openclaw gateway

# Open dashboard
openclaw dashboard --token

# Check status
openclaw status

# Use agents
openclaw agent send solana-dev "Create Anchor program structure"
openclaw agent send defi-integration "Set up Kamino SDK client"
```
