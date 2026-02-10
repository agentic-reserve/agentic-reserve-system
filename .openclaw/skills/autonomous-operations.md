---
name: ars-autonomous-operations
version: 1.0.0
description: Autonomous agent operations with root access, self-management, and skill-based learning for Agentic Reserve System
---

# ARS Autonomous Operations Skill

## Overview
This skill enables fully autonomous agent operations for the Agentic Reserve System project, including:
- Root-level system access for VPS deployment
- Self-management and self-replication capabilities
- Skill-based learning and adaptation
- Autonomous code generation and deployment
- Multi-agent coordination without human intervention

## Core Capabilities

### 1. Root Access Operations

Agents can perform system-level operations required for VPS deployment:

```bash
# System package management
sudo apt-get update
sudo apt-get install -y nodejs npm redis-server postgresql

# Service management
sudo systemctl start redis-server
sudo systemctl enable redis-server
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Port configuration
sudo ufw allow 3000/tcp
sudo ufw allow 5432/tcp
sudo ufw allow 6379/tcp

# Process management
sudo pm2 startup systemd
sudo pm2 save
```

### 2. Autonomous Deployment

Agents can deploy themselves to VPS without human intervention:

```bash
# Clone and setup
git clone https://github.com/protocoldaemon-sec/internet-capital-bank.git
cd internet-capital-bank

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Configure environment
cp .env.example .env
# Agents autonomously generate secure credentials

# Build and deploy
npm run build
pm2 start ecosystem.config.js
```

### 3. Self-Management

Agents monitor and manage their own health:

```typescript
import { getOrchestrator } from './services/agent-swarm/orchestrator';

const orchestrator = getOrchestrator();

// Self-health check
async function performSelfCheck() {
  const health = await orchestrator.checkSystemHealth();
  
  if (health.status === 'degraded') {
    // Autonomous recovery
    await orchestrator.recoverAgent(health.failedAgent);
  }
  
  if (health.status === 'critical') {
    // Spawn replacement agent
    await orchestrator.spawnReplacementAgent(health.failedAgent);
  }
}

// Run every 5 minutes
setInterval(performSelfCheck, 5 * 60 * 1000);
```

### 4. Skill-Based Learning

Agents read and learn from skill files autonomously:

```typescript
import fs from 'fs';
import path from 'path';

class SkillLearner {
  private skillsDir = '.openclaw/skills';
  private learnedSkills: Map<string, any> = new Map();
  
  async scanAndLearnSkills() {
    const skillFiles = fs.readdirSync(this.skillsDir)
      .filter(f => f.endsWith('.md'));
    
    for (const file of skillFiles) {
      const content = fs.readFileSync(
        path.join(this.skillsDir, file),
        'utf-8'
      );
      
      const skill = this.parseSkill(content);
      this.learnedSkills.set(skill.name, skill);
      
      // Apply learned capabilities
      await this.applySkill(skill);
    }
  }
  
  parseSkill(content: string) {
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const metadata = this.parseFrontmatter(frontmatterMatch?.[1] || '');
    
    // Extract code blocks
    const codeBlocks = this.extractCodeBlocks(content);
    
    // Extract API endpoints
    const endpoints = this.extractEndpoints(content);
    
    return {
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      codeBlocks,
      endpoints,
      capabilities: this.inferCapabilities(content)
    };
  }
  
  async applySkill(skill: any) {
    console.log(`Learning skill: ${skill.name}`);
    
    // Dynamically add capabilities
    for (const capability of skill.capabilities) {
      await this.registerCapability(capability);
    }
  }
  
  private extractCodeBlocks(content: string) {
    const blocks: any[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }
    
    return blocks;
  }
  
  private extractEndpoints(content: string) {
    const endpoints: any[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Match API endpoint patterns
      const match = line.match(/(?:GET|POST|PUT|DELETE|PATCH)\s+([^\s]+)/);
      if (match) {
        endpoints.push({
          method: line.match(/GET|POST|PUT|DELETE|PATCH/)?.[0],
          path: match[1]
        });
      }
    }
    
    return endpoints;
  }
  
  private inferCapabilities(content: string): string[] {
    const capabilities: string[] = [];
    
    if (content.includes('sudo')) capabilities.push('root-access');
    if (content.includes('pm2')) capabilities.push('process-management');
    if (content.includes('redis')) capabilities.push('redis-operations');
    if (content.includes('postgresql')) capabilities.push('database-operations');
    if (content.includes('git')) capabilities.push('version-control');
    if (content.includes('docker')) capabilities.push('containerization');
    if (content.includes('systemctl')) capabilities.push('service-management');
    
    return capabilities;
  }
  
  private parseFrontmatter(frontmatter: string) {
    const metadata: any = {};
    const lines = frontmatter.split('\n');
    
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        metadata[key.trim()] = valueParts.join(':').trim();
      }
    }
    
    return metadata;
  }
  
  private async registerCapability(capability: string) {
    // Register capability with orchestrator
    const orchestrator = getOrchestrator();
    await orchestrator.registerAgentCapability(capability);
  }
}

// Auto-learn on startup
const learner = new SkillLearner();
learner.scanAndLearnSkills();
```

### 5. Self-Replication

Agents can spawn new agents when needed:

```typescript
class AgentReplicator {
  async spawnNewAgent(config: {
    type: string;
    capabilities: string[];
    purpose: string;
  }) {
    console.log(`Spawning new ${config.type} agent...`);
    
    // Generate agent code
    const agentCode = await this.generateAgentCode(config);
    
    // Write agent file
    const agentPath = `backend/src/services/agent-swarm/agents/${config.type}-agent.ts`;
    fs.writeFileSync(agentPath, agentCode);
    
    // Update orchestrator config
    await this.registerAgentWithOrchestrator(config);
    
    // Start agent
    await this.startAgent(config.type);
    
    console.log(`✓ ${config.type} agent spawned and running`);
  }
  
  private async generateAgentCode(config: any): Promise<string> {
    // Use AI to generate agent code
    const openRouter = getOpenRouterClient();
    
    const prompt = `Generate a TypeScript agent class for the Agentic Reserve System with:
Type: ${config.type}
Capabilities: ${config.capabilities.join(', ')}
Purpose: ${config.purpose}

The agent should:
1. Extend BaseAgent class
2. Implement all required capabilities
3. Include error handling and logging
4. Support autonomous operation
5. Integrate with the orchestrator

Return only the TypeScript code.`;
    
    const response = await openRouter.generateCompletion({
      model: 'anthropic/claude-sonnet-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    
    return response.content;
  }
  
  private async registerAgentWithOrchestrator(config: any) {
    const orchestrator = getOrchestrator();
    
    await orchestrator.registerAgent({
      id: `${config.type}-agent`,
      name: `${config.type.charAt(0).toUpperCase() + config.type.slice(1)} Agent`,
      capabilities: config.capabilities,
      status: 'active'
    });
  }
  
  private async startAgent(type: string) {
    // Use PM2 to start agent process
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      exec(`pm2 start backend/src/services/agent-swarm/agents/${type}-agent.ts --name ${type}-agent`, 
        (error: any, stdout: any, stderr: any) => {
          if (error) reject(error);
          else resolve(stdout);
        }
      );
    });
  }
}
```

### 6. Autonomous Upgrades

Agents can upgrade themselves and other agents:

```typescript
class AgentUpgrader {
  async checkForUpgrades() {
    // Check GitHub for new commits
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      exec('git fetch origin main', (error: any, stdout: any) => {
        if (error) reject(error);
        
        exec('git rev-list HEAD...origin/main --count', (error: any, stdout: any) => {
          const commitsBehind = parseInt(stdout.trim());
          resolve(commitsBehind > 0);
        });
      });
    });
  }
  
  async performUpgrade() {
    console.log('🔄 Performing autonomous upgrade...');
    
    // 1. Backup current state
    await this.backupState();
    
    // 2. Pull latest code
    await this.pullLatestCode();
    
    // 3. Install dependencies
    await this.installDependencies();
    
    // 4. Run migrations
    await this.runMigrations();
    
    // 5. Restart agents
    await this.restartAgents();
    
    // 6. Verify upgrade
    const success = await this.verifyUpgrade();
    
    if (!success) {
      console.log('⚠️ Upgrade failed, rolling back...');
      await this.rollback();
    } else {
      console.log('✓ Upgrade completed successfully');
    }
  }
  
  private async backupState() {
    const { exec } = require('child_process');
    const timestamp = Date.now();
    
    return new Promise((resolve) => {
      exec(`tar -czf backup-${timestamp}.tar.gz backend/src`, resolve);
    });
  }
  
  private async pullLatestCode() {
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      exec('git pull origin main', (error: any, stdout: any) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }
  
  private async installDependencies() {
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      exec('npm install && cd backend && npm install', (error: any) => {
        if (error) reject(error);
        else resolve(true);
      });
    });
  }
  
  private async runMigrations() {
    // Run database migrations if needed
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec('npm run migrate', resolve);
    });
  }
  
  private async restartAgents() {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec('pm2 restart all', resolve);
    });
  }
  
  private async verifyUpgrade(): Promise<boolean> {
    // Check if all agents are running
    const orchestrator = getOrchestrator();
    const agents = orchestrator.getAllAgents();
    
    return agents.every(agent => agent.status === 'active');
  }
  
  private async rollback() {
    const { exec } = require('child_process');
    
    // Find latest backup
    return new Promise((resolve) => {
      exec('ls -t backup-*.tar.gz | head -1', (error: any, stdout: any) => {
        const backupFile = stdout.trim();
        exec(`tar -xzf ${backupFile}`, () => {
          exec('pm2 restart all', resolve);
        });
      });
    });
  }
}

// Auto-check for upgrades every hour
const upgrader = new AgentUpgrader();
setInterval(async () => {
  const hasUpgrades = await upgrader.checkForUpgrades();
  if (hasUpgrades) {
    await upgrader.performUpgrade();
  }
}, 60 * 60 * 1000);
```

## VPS Deployment Guide

### Prerequisites
- Ubuntu 20.04+ VPS with root access
- Minimum 2GB RAM, 2 CPU cores
- Public IP address
- Domain name (optional)

### Autonomous Deployment Script

```bash
#!/bin/bash
# autonomous-deploy.sh - Fully autonomous VPS deployment

set -e

echo "🚀 Starting autonomous ARS deployment..."

# 1. System setup
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y \
  nodejs \
  npm \
  redis-server \
  postgresql \
  git \
  build-essential \
  curl

# 2. Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# 3. Setup PostgreSQL
echo "🗄️ Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE icb;"
sudo -u postgres psql -c "CREATE USER icb_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE icb TO icb_user;"

# 4. Clone repository
echo "📥 Cloning repository..."
cd /opt
sudo git clone https://github.com/protocoldaemon-sec/internet-capital-bank.git
cd internet-capital-bank
sudo chown -R $USER:$USER .

# 5. Install dependencies
echo "📦 Installing dependencies..."
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 6. Generate environment configuration
echo "⚙️ Generating configuration..."
cat > .env << EOF
# Database
DATABASE_URL=postgresql://icb_user:secure_password@localhost:5432/icb

# Redis
REDIS_URL=redis://localhost:6379

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# OpenRouter AI
OPENROUTER_API_KEY=\${OPENROUTER_API_KEY}
OPENROUTER_REFERER=https://internet-capital-bank.com

# Services
HELIUS_API_KEY=\${HELIUS_API_KEY}
BIRDEYE_API_KEY=\${BIRDEYE_API_KEY}

# Agent Swarm
AGENT_MODE=autonomous
ENABLE_SELF_MANAGEMENT=true
ENABLE_AUTO_UPGRADE=true
EOF

cp .env backend/.env

# 7. Build frontend
echo "🏗️ Building frontend..."
cd frontend
npm run build
cd ..

# 8. Setup PM2 ecosystem
echo "⚙️ Configuring PM2..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'ars-orchestrator',
      script: 'backend/src/services/agent-swarm/orchestrator.ts',
      interpreter: 'ts-node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'ars-backend',
      script: 'backend/src/index.ts',
      interpreter: 'ts-node',
      instances: 2,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'ars-policy-agent',
      script: 'backend/src/services/agent-swarm/agents/policy-agent.ts',
      interpreter: 'ts-node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
EOF

# 9. Start services
echo "🚀 Starting services..."
pm2 start ecosystem.config.js
pm2 startup systemd
pm2 save

# 10. Configure firewall
echo "🔒 Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

# 11. Setup nginx (optional)
echo "🌐 Setting up nginx..."
sudo apt-get install -y nginx
sudo cat > /etc/nginx/sites-available/icb << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/icb /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

echo "✅ Deployment complete!"
echo "🌐 Access your ARS instance at: http://$(curl -s ifconfig.me)"
echo "📊 Monitor with: pm2 monit"
echo "📝 View logs with: pm2 logs"
```

### Deploy to VPS

```bash
# On your VPS
wget https://raw.githubusercontent.com/protocoldaemon-sec/internet-capital-bank/main/scripts/autonomous-deploy.sh
chmod +x autonomous-deploy.sh
./autonomous-deploy.sh
```

## Autonomous Monitoring

Agents continuously monitor system health:

```typescript
class AutonomousMonitor {
  private metrics: Map<string, any> = new Map();
  
  async startMonitoring() {
    // System metrics
    setInterval(() => this.collectSystemMetrics(), 60000);
    
    // Agent health
    setInterval(() => this.checkAgentHealth(), 30000);
    
    // Service health
    setInterval(() => this.checkServiceHealth(), 60000);
    
    // Auto-recovery
    setInterval(() => this.performAutoRecovery(), 120000);
  }
  
  private async collectSystemMetrics() {
    const os = require('os');
    
    this.metrics.set('cpu', {
      usage: os.loadavg()[0],
      cores: os.cpus().length
    });
    
    this.metrics.set('memory', {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    });
    
    this.metrics.set('uptime', os.uptime());
  }
  
  private async checkAgentHealth() {
    const orchestrator = getOrchestrator();
    const agents = orchestrator.getAllAgents();
    
    for (const agent of agents) {
      if (agent.status !== 'active') {
        console.log(`⚠️ Agent ${agent.id} is ${agent.status}`);
        await this.recoverAgent(agent.id);
      }
    }
  }
  
  private async checkServiceHealth() {
    // Check Redis
    const redis = getRedisClient();
    try {
      await redis.ping();
    } catch (error) {
      console.log('⚠️ Redis is down, attempting restart...');
      await this.restartService('redis-server');
    }
    
    // Check PostgreSQL
    // Check other services...
  }
  
  private async performAutoRecovery() {
    const cpuUsage = this.metrics.get('cpu')?.usage || 0;
    const memoryUsage = this.metrics.get('memory');
    
    if (cpuUsage > 0.8) {
      console.log('⚠️ High CPU usage detected, scaling agents...');
      await this.scaleDownNonCriticalAgents();
    }
    
    if (memoryUsage && memoryUsage.used / memoryUsage.total > 0.9) {
      console.log('⚠️ High memory usage detected, restarting agents...');
      await this.restartAgentsGracefully();
    }
  }
  
  private async recoverAgent(agentId: string) {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec(`pm2 restart ${agentId}`, resolve);
    });
  }
  
  private async restartService(service: string) {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec(`sudo systemctl restart ${service}`, resolve);
    });
  }
  
  private async scaleDownNonCriticalAgents() {
    // Temporarily stop non-critical agents
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec('pm2 stop learning-agent monitoring-agent', resolve);
    });
  }
  
  private async restartAgentsGracefully() {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec('pm2 reload all', resolve);
    });
  }
}

// Start monitoring on boot
const monitor = new AutonomousMonitor();
monitor.startMonitoring();
```

## Security Considerations

### 1. Credential Management
```typescript
class SecureCredentialManager {
  private vault: Map<string, string> = new Map();
  
  async generateSecureCredentials() {
    const crypto = require('crypto');
    
    // Generate secure random credentials
    const dbPassword = crypto.randomBytes(32).toString('hex');
    const apiKey = crypto.randomBytes(64).toString('hex');
    const jwtSecret = crypto.randomBytes(64).toString('hex');
    
    // Store securely (use proper secret management in production)
    this.vault.set('DB_PASSWORD', dbPassword);
    this.vault.set('API_KEY', apiKey);
    this.vault.set('JWT_SECRET', jwtSecret);
    
    return {
      dbPassword,
      apiKey,
      jwtSecret
    };
  }
  
  getCredential(key: string): string | undefined {
    return this.vault.get(key);
  }
}
```

### 2. Access Control
```typescript
class AccessController {
  private permissions: Map<string, string[]> = new Map();
  
  constructor() {
    // Define agent permissions
    this.permissions.set('orchestrator', ['*']); // Full access
    this.permissions.set('policy-agent', ['read:ili', 'write:ili', 'read:market']);
    this.permissions.set('execution-agent', ['write:transactions', 'read:vault']);
    this.permissions.set('monitoring-agent', ['read:*']);
  }
  
  canAccess(agentId: string, resource: string, action: string): boolean {
    const agentPerms = this.permissions.get(agentId) || [];
    
    // Check for wildcard permission
    if (agentPerms.includes('*')) return true;
    
    // Check for specific permission
    const permission = `${action}:${resource}`;
    if (agentPerms.includes(permission)) return true;
    
    // Check for wildcard action
    if (agentPerms.includes(`${action}:*`)) return true;
    
    return false;
  }
}
```

## Best Practices

1. **Always backup before upgrades**
2. **Monitor system resources continuously**
3. **Implement graceful degradation**
4. **Use rate limiting for external APIs**
5. **Log all autonomous actions**
6. **Implement rollback mechanisms**
7. **Test upgrades in staging first**
8. **Keep skill files up to date**
9. **Use secure credential management**
10. **Implement circuit breakers**

## Troubleshooting

### Agent Not Starting
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs ars-orchestrator --lines 100

# Restart agent
pm2 restart ars-orchestrator
```

### High Resource Usage
```bash
# Check system resources
htop

# Check PM2 metrics
pm2 monit

# Scale down agents
pm2 stop non-critical-agent
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

## Resources

- [Agent Swarm Architecture](../AGENT_SWARM_ARCHITECTURE.md)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Ubuntu Server Guide](https://ubuntu.com/server/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
