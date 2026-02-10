import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { config } from '../../config';

export interface AgentMessage {
  type: string;
  from: string;
  to: string;
  payload: any;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  correlationId?: string;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  agent: string;
  timestamp: number;
}

export interface WorkflowStep {
  agent: string;
  action: string;
  inputs: any;
  requires_approval?: string[];
  uses?: string;
}

export interface Workflow {
  description: string;
  trigger: string;
  priority?: string;
  steps: WorkflowStep[];
}

/**
 * ARS Agent Swarm Orchestrator
 * Coordinates multi-agent system for autonomous operations
 */
export class AgentOrchestrator extends EventEmitter {
  private redis: Redis;
  private agents: Map<string, AgentInfo> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private activeWorkflows: Map<string, WorkflowExecution> = new Map();

  constructor() {
    super();
    this.redis = new Redis(config.redis.url);
    this.initializeAgents();
    this.initializeWorkflows();
    this.startMessageListener();
    console.log('✅ Agent Orchestrator initialized');
  }

  /**
   * Initialize agent registry
   */
  private initializeAgents(): void {
    const agents = [
      {
        id: 'policy-agent',
        role: 'specialist',
        capabilities: ['ili-analysis', 'policy-recommendation', 'ai-forecasting'],
        status: 'active',
      },
      {
        id: 'oracle-agent',
        role: 'specialist',
        capabilities: ['price-aggregation', 'outlier-detection', 'health-monitoring'],
        status: 'active',
      },
      {
        id: 'defi-agent',
        role: 'specialist',
        capabilities: ['swap-execution', 'yield-optimization', 'rebalancing'],
        status: 'active',
      },
      {
        id: 'governance-agent',
        role: 'specialist',
        capabilities: ['proposal-management', 'vote-aggregation', 'slashing'],
        status: 'active',
      },
      {
        id: 'risk-agent',
        role: 'specialist',
        capabilities: ['vhr-monitoring', 'circuit-breaker', 'risk-scoring'],
        status: 'active',
      },
      {
        id: 'execution-agent',
        role: 'specialist',
        capabilities: ['transaction-execution', 'er-management', 'state-commitment'],
        status: 'active',
      },
      {
        id: 'payment-agent',
        role: 'specialist',
        capabilities: ['x402-payments', 'budget-tracking', 'cost-optimization'],
        status: 'active',
      },
      {
        id: 'monitoring-agent',
        role: 'specialist',
        capabilities: ['health-checks', 'alerting', 'dashboard-updates'],
        status: 'active',
      },
      {
        id: 'learning-agent',
        role: 'specialist',
        capabilities: ['pattern-recognition', 'strategy-optimization'],
        status: 'active',
      },
    ];

    agents.forEach((agent) => {
      this.agents.set(agent.id, agent as AgentInfo);
    });
  }

  /**
   * Initialize workflow definitions
   */
  private initializeWorkflows(): void {
    this.workflows.set('ili-update', {
      description: 'Update ILI every 5 minutes',
      trigger: 'cron:*/5 * * * *',
      steps: [
        {
          agent: 'oracle-agent',
          action: 'aggregate-prices',
          inputs: { tokens: ['SOL', 'USDC', 'mSOL'] },
        },
        {
          agent: 'defi-agent',
          action: 'fetch-protocol-metrics',
          inputs: { protocols: ['jupiter', 'meteora', 'kamino'] },
        },
        {
          agent: 'policy-agent',
          action: 'calculate-ili',
          inputs: { source: 'aggregated' },
        },
        {
          agent: 'monitoring-agent',
          action: 'update-dashboard',
          inputs: { metric: 'ili' },
        },
      ],
    });

    this.workflows.set('policy-execution', {
      description: 'Execute approved policy proposal',
      trigger: 'event:proposal-passed',
      steps: [
        {
          agent: 'governance-agent',
          action: 'verify-proposal',
          inputs: {},
        },
        {
          agent: 'risk-agent',
          action: 'assess-risk',
          inputs: {},
        },
        {
          agent: 'execution-agent',
          action: 'execute-policy',
          inputs: {},
          requires_approval: ['risk-agent'],
        },
        {
          agent: 'monitoring-agent',
          action: 'log-execution',
          inputs: {},
        },
      ],
    });

    this.workflows.set('circuit-breaker', {
      description: 'Emergency circuit breaker activation',
      trigger: 'event:vhr-critical',
      priority: 'critical',
      steps: [
        {
          agent: 'risk-agent',
          action: 'assess-severity',
          inputs: {},
        },
        {
          agent: 'execution-agent',
          action: 'activate-circuit-breaker',
          inputs: {},
        },
        {
          agent: 'monitoring-agent',
          action: 'send-critical-alert',
          inputs: {},
        },
      ],
    });
  }

  /**
   * Start listening for agent messages
   */
  private startMessageListener(): void {
    this.redis.subscribe('icb:orchestrator', (err) => {
      if (err) {
        console.error('Failed to subscribe to orchestrator channel:', err);
      }
    });

    this.redis.on('message', async (channel, message) => {
      try {
        const msg: AgentMessage = JSON.parse(message);
        await this.handleMessage(msg);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
  }

  /**
   * Handle incoming agent message
   */
  private async handleMessage(message: AgentMessage): Promise<void> {
    console.log(`📨 Message from ${message.from}: ${message.type}`);

    switch (message.type) {
      case 'workflow-request':
        await this.executeWorkflow(message.payload.workflow, message.payload.inputs);
        break;
      case 'agent-response':
        await this.handleAgentResponse(message);
        break;
      case 'consensus-request':
        await this.requestConsensus(message.payload);
        break;
      case 'alert':
        await this.handleAlert(message);
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Execute workflow
   */
  async executeWorkflow(
    workflowId: string,
    inputs: any = {}
  ): Promise<{ success: boolean; executionId: string }> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = `${workflowId}-${Date.now()}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflow: workflowId,
      status: 'running',
      currentStep: 0,
      results: [],
      startedAt: Date.now(),
    };

    this.activeWorkflows.set(executionId, execution);

    console.log(`🚀 Starting workflow: ${workflowId} (${executionId})`);

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        execution.currentStep = i;

        console.log(`  Step ${i + 1}/${workflow.steps.length}: ${step.agent}.${step.action}`);

        // Check if approval required
        if (step.requires_approval) {
          const approved = await this.requestApproval(step.requires_approval, step);
          if (!approved) {
            throw new Error(`Step ${i + 1} not approved`);
          }
        }

        // Execute step
        const result = await this.executeStep(step, inputs);
        execution.results.push(result);

        if (!result.success) {
          throw new Error(`Step ${i + 1} failed: ${result.error}`);
        }

        // Pass result to next step
        inputs = { ...inputs, ...result.data };
      }

      execution.status = 'completed';
      execution.completedAt = Date.now();

      console.log(`✅ Workflow completed: ${workflowId}`);

      return { success: true, executionId };
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = Date.now();

      console.error(`❌ Workflow failed: ${workflowId}`, error);

      return { success: false, executionId };
    }
  }

  /**
   * Execute workflow step
   */
  private async executeStep(step: WorkflowStep, inputs: any): Promise<AgentResponse> {
    const message: AgentMessage = {
      type: 'action-request',
      from: 'ars-orchestrator',
      to: step.agent,
      payload: {
        action: step.action,
        inputs: { ...step.inputs, ...inputs },
      },
      timestamp: Date.now(),
      priority: 'normal',
    };

    // Publish message to agent channel
    await this.sendMessage(step.agent, message);

    // Wait for response (with timeout)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: 'Agent response timeout',
          agent: step.agent,
          timestamp: Date.now(),
        });
      }, 30000); // 30s timeout

      const handler = (response: AgentResponse) => {
        if (response.agent === step.agent) {
          clearTimeout(timeout);
          this.removeListener('agent-response', handler);
          resolve(response);
        }
      };

      this.on('agent-response', handler);
    });
  }

  /**
   * Send message to agent
   */
  async sendMessage(agentId: string, message: AgentMessage): Promise<void> {
    const channel = `icb:${agentId.replace('-agent', '')}`;
    await this.redis.publish(channel, JSON.stringify(message));
  }

  /**
   * Handle agent response
   */
  private async handleAgentResponse(message: AgentMessage): Promise<void> {
    const response: AgentResponse = message.payload;
    this.emit('agent-response', response);
  }

  /**
   * Request approval from agents
   */
  private async requestApproval(
    approvers: string[],
    step: WorkflowStep
  ): Promise<boolean> {
    const approvals: boolean[] = [];

    for (const approver of approvers) {
      const message: AgentMessage = {
        type: 'approval-request',
        from: 'ars-orchestrator',
        to: approver,
        payload: { step },
        timestamp: Date.now(),
        priority: 'high',
      };

      await this.sendMessage(approver, message);

      // Wait for approval response
      const approved = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 10000);

        const handler = (response: AgentResponse) => {
          if (response.agent === approver) {
            clearTimeout(timeout);
            this.removeListener('agent-response', handler);
            resolve(response.success && response.data?.approved === true);
          }
        };

        this.on('agent-response', handler);
      });

      approvals.push(approved);
    }

    // All approvers must approve
    return approvals.every((a) => a);
  }

  /**
   * Request consensus from agents
   */
  private async requestConsensus(payload: any): Promise<void> {
    console.log('🗳️  Requesting consensus:', payload.topic);

    const votes: Map<string, boolean> = new Map();
    const weights = {
      'policy-agent': 3,
      'risk-agent': 3,
      'oracle-agent': 2,
      'defi-agent': 2,
      'governance-agent': 2,
      'execution-agent': 1,
      'payment-agent': 1,
      'monitoring-agent': 1,
      'learning-agent': 1,
    };

    // Request votes from all agents
    for (const [agentId] of this.agents) {
      const message: AgentMessage = {
        type: 'consensus-vote',
        from: 'ars-orchestrator',
        to: agentId,
        payload,
        timestamp: Date.now(),
        priority: 'high',
      };

      await this.sendMessage(agentId, message);
    }

    // Collect votes (with timeout)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Calculate weighted consensus
    let totalWeight = 0;
    let approvalWeight = 0;

    for (const [agentId, vote] of votes) {
      const weight = weights[agentId as keyof typeof weights] || 1;
      totalWeight += weight;
      if (vote) approvalWeight += weight;
    }

    const consensus = approvalWeight / totalWeight >= 0.6;

    console.log(
      `📊 Consensus result: ${consensus ? 'APPROVED' : 'REJECTED'} (${approvalWeight}/${totalWeight})`
    );

    this.emit('consensus-result', { topic: payload.topic, approved: consensus });
  }

  /**
   * Handle alert from agent
   */
  private async handleAlert(message: AgentMessage): Promise<void> {
    const { severity, title, description } = message.payload;

    console.log(`🚨 ALERT [${severity}] from ${message.from}: ${title}`);

    // Store alert in Redis
    await this.redis.lpush(
      'icb:alerts',
      JSON.stringify({
        from: message.from,
        severity,
        title,
        description,
        timestamp: message.timestamp,
      })
    );

    // Trigger alert workflow if critical
    if (severity === 'critical') {
      await this.executeWorkflow('circuit-breaker', message.payload);
    }
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(executionId: string): WorkflowExecution | undefined {
    return this.activeWorkflows.get(executionId);
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): WorkflowExecution[] {
    return Array.from(this.activeWorkflows.values()).filter((w) => w.status === 'running');
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down orchestrator...');
    await this.redis.quit();
  }
}

interface AgentInfo {
  id: string;
  role: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'error';
}

interface WorkflowExecution {
  id: string;
  workflow: string;
  status: 'running' | 'completed' | 'failed';
  currentStep: number;
  results: AgentResponse[];
  startedAt: number;
  completedAt?: number;
  error?: string;
}

// Singleton instance
let orchestrator: AgentOrchestrator | null = null;

/**
 * Get or create orchestrator instance
 */
export function getOrchestrator(): AgentOrchestrator {
  if (!orchestrator) {
    orchestrator = new AgentOrchestrator();
  }
  return orchestrator;
}

/**
 * Autonomous Operations Extension
 * Adds self-management, skill learning, and auto-upgrade capabilities
 */
export class AutonomousOrchestrator extends AgentOrchestrator {
  private skillLearner: SkillLearner | null = null;
  private autoUpgrader: AutoUpgrader | null = null;
  private selfManager: SelfManager | null = null;

  /**
   * Enable self-management capabilities
   */
  enableSelfManagement(): void {
    if (this.selfManager) return;
    
    this.selfManager = new SelfManager(this);
    this.selfManager.start();
    console.log('✅ Self-management enabled');
  }

  /**
   * Enable auto-upgrade capabilities
   */
  enableAutoUpgrade(): void {
    if (this.autoUpgrader) return;
    
    this.autoUpgrader = new AutoUpgrader(this);
    this.autoUpgrader.start();
    console.log('✅ Auto-upgrade enabled');
  }

  /**
   * Enable skill learning capabilities
   */
  enableSkillLearning(): void {
    if (this.skillLearner) return;
    
    this.skillLearner = new SkillLearner(this);
    this.skillLearner.start();
    console.log('✅ Skill learning enabled');
  }

  /**
   * Register agent capability
   */
  async registerAgentCapability(capability: string): Promise<void> {
    console.log(`📚 Registered capability: ${capability}`);
    // Store capability in Redis for persistence
    await this.redis.sadd('icb:capabilities', capability);
  }

  /**
   * Check system health
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    const agents = this.getAllAgents();
    const failedAgents = agents.filter(a => a.status !== 'active');
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (failedAgents.length > 0) {
      status = failedAgents.length > 3 ? 'critical' : 'degraded';
    }
    
    return {
      status,
      failedAgent: failedAgents[0]?.id,
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'active').length
    };
  }

  /**
   * Recover failed agent
   */
  async recoverAgent(agentId: string): Promise<void> {
    console.log(`🔄 Recovering agent: ${agentId}`);
    
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    // Update agent status
    agent.status = 'active';
    this.agents.set(agentId, agent);
    
    // Notify monitoring
    await this.sendMessage('monitoring-agent', {
      type: 'alert',
      from: 'ars-orchestrator',
      to: 'monitoring-agent',
      payload: {
        severity: 'info',
        title: 'Agent Recovered',
        description: `Agent ${agentId} has been recovered`
      },
      timestamp: Date.now(),
      priority: 'normal'
    });
  }

  /**
   * Spawn replacement agent
   */
  async spawnReplacementAgent(agentId: string): Promise<void> {
    console.log(`🆕 Spawning replacement for: ${agentId}`);
    
    // This would integrate with the AgentReplicator
    // For now, just mark as recovered
    await this.recoverAgent(agentId);
  }

  /**
   * Register new agent
   */
  async registerAgent(agent: AgentInfo): Promise<void> {
    this.agents.set(agent.id, agent);
    console.log(`✅ Registered agent: ${agent.id}`);
  }
}

/**
 * Skill Learner - Reads and learns from skill files
 */
class SkillLearner {
  private orchestrator: AutonomousOrchestrator;
  private skillsDir = '.openclaw/skills';
  private learnedSkills: Map<string, any> = new Map();
  private interval: NodeJS.Timeout | null = null;

  constructor(orchestrator: AutonomousOrchestrator) {
    this.orchestrator = orchestrator;
  }

  start(): void {
    // Learn skills immediately
    this.scanAndLearnSkills();
    
    // Re-scan every hour
    this.interval = setInterval(() => {
      this.scanAndLearnSkills();
    }, 60 * 60 * 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async scanAndLearnSkills(): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const skillFiles = fs.readdirSync(this.skillsDir)
        .filter((f: string) => f.endsWith('.md'));
      
      for (const file of skillFiles) {
        const content = fs.readFileSync(
          path.join(this.skillsDir, file),
          'utf-8'
        );
        
        const skill = this.parseSkill(content);
        this.learnedSkills.set(skill.name, skill);
        
        console.log(`📚 Learned skill: ${skill.name} v${skill.version}`);
        
        // Apply learned capabilities
        for (const capability of skill.capabilities) {
          await this.orchestrator.registerAgentCapability(capability);
        }
      }
    } catch (error) {
      console.error('Error learning skills:', error);
    }
  }

  private parseSkill(content: string): any {
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const metadata = this.parseFrontmatter(frontmatterMatch?.[1] || '');
    
    // Infer capabilities from content
    const capabilities = this.inferCapabilities(content);
    
    return {
      name: metadata.name || 'unknown',
      version: metadata.version || '1.0.0',
      description: metadata.description || '',
      capabilities
    };
  }

  private parseFrontmatter(frontmatter: string): any {
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

  private inferCapabilities(content: string): string[] {
    const capabilities: string[] = [];
    
    if (content.includes('sudo')) capabilities.push('root-access');
    if (content.includes('pm2')) capabilities.push('process-management');
    if (content.includes('redis')) capabilities.push('redis-operations');
    if (content.includes('postgresql')) capabilities.push('database-operations');
    if (content.includes('git')) capabilities.push('version-control');
    if (content.includes('docker')) capabilities.push('containerization');
    if (content.includes('systemctl')) capabilities.push('service-management');
    if (content.includes('workflow')) capabilities.push('workflow-execution');
    if (content.includes('consensus')) capabilities.push('consensus-voting');
    
    return capabilities;
  }
}

/**
 * Auto Upgrader - Checks for and applies upgrades
 */
class AutoUpgrader {
  private orchestrator: AutonomousOrchestrator;
  private interval: NodeJS.Timeout | null = null;

  constructor(orchestrator: AutonomousOrchestrator) {
    this.orchestrator = orchestrator;
  }

  start(): void {
    // Check for upgrades every 6 hours
    this.interval = setInterval(() => {
      this.checkAndUpgrade();
    }, 6 * 60 * 60 * 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async checkAndUpgrade(): Promise<void> {
    try {
      const hasUpgrades = await this.checkForUpgrades();
      
      if (hasUpgrades) {
        console.log('🔄 New version available, performing upgrade...');
        await this.performUpgrade();
      }
    } catch (error) {
      console.error('Error checking for upgrades:', error);
    }
  }

  private async checkForUpgrades(): Promise<boolean> {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec('git fetch origin main', (error: any) => {
        if (error) {
          resolve(false);
          return;
        }
        
        exec('git rev-list HEAD...origin/main --count', (error: any, stdout: any) => {
          if (error) {
            resolve(false);
            return;
          }
          
          const commitsBehind = parseInt(stdout.trim());
          resolve(commitsBehind > 0);
        });
      });
    });
  }

  private async performUpgrade(): Promise<void> {
    const { exec } = require('child_process');
    
    // Pull latest code
    await new Promise((resolve) => {
      exec('git pull origin main', resolve);
    });
    
    // Install dependencies
    await new Promise((resolve) => {
      exec('npm install && cd backend && npm install', resolve);
    });
    
    // Restart agents
    await new Promise((resolve) => {
      exec('pm2 reload all', resolve);
    });
    
    console.log('✅ Upgrade completed successfully');
  }
}

/**
 * Self Manager - Monitors and manages agent health
 */
class SelfManager {
  private orchestrator: AutonomousOrchestrator;
  private interval: NodeJS.Timeout | null = null;

  constructor(orchestrator: AutonomousOrchestrator) {
    this.orchestrator = orchestrator;
  }

  start(): void {
    // Check health every 5 minutes
    this.interval = setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.orchestrator.checkSystemHealth();
      
      if (health.status === 'degraded' && health.failedAgent) {
        console.log(`⚠️ System degraded, recovering ${health.failedAgent}`);
        await this.orchestrator.recoverAgent(health.failedAgent);
      } else if (health.status === 'critical' && health.failedAgent) {
        console.log(`🚨 System critical, spawning replacement for ${health.failedAgent}`);
        await this.orchestrator.spawnReplacementAgent(health.failedAgent);
      }
    } catch (error) {
      console.error('Error performing health check:', error);
    }
  }
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  failedAgent?: string;
  totalAgents: number;
  activeAgents: number;
}

/**
 * Get autonomous orchestrator instance
 */
export function getAutonomousOrchestrator(): AutonomousOrchestrator {
  if (!orchestrator) {
    orchestrator = new AutonomousOrchestrator();
    
    // Enable autonomous features based on environment
    if (process.env.ENABLE_SELF_MANAGEMENT === 'true') {
      (orchestrator as AutonomousOrchestrator).enableSelfManagement();
    }
    
    if (process.env.ENABLE_AUTO_UPGRADE === 'true') {
      (orchestrator as AutonomousOrchestrator).enableAutoUpgrade();
    }
    
    if (process.env.ENABLE_SKILL_LEARNING === 'true') {
      (orchestrator as AutonomousOrchestrator).enableSkillLearning();
    }
  }
  return orchestrator as AutonomousOrchestrator;
}
