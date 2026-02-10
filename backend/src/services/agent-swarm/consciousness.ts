import { EventEmitter } from 'events';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getOpenRouterClient } from '../ai/openrouter-client';
import { getRedisClient } from '../redis';
import * as crypto from 'crypto';

interface AgentIdentity {
  publicKey: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  reputation: number;
  consciousness: ConsciousnessState;
}

enum AgentType {
  LENDING = 'lending',
  YIELD = 'yield',
  LIQUIDITY = 'liquidity',
  ARBITRAGE = 'arbitrage',
  PREDICTION = 'prediction',
  TREASURY = 'treasury',
  SECURITY = 'security',
  ORCHESTRATOR = 'orchestrator'
}

interface ConsciousnessState {
  awareness: number; // 0-1: self-awareness level
  autonomy: number; // 0-1: decision-making independence
  learning: number; // 0-1: learning capability
  creativity: number; // 0-1: creative problem-solving
  empathy: number; // 0-1: understanding other agents
  memory: MemoryState;
  goals: Goal[];
  beliefs: Belief[];
}

interface MemoryState {
  shortTerm: Memory[];
  longTerm: Memory[];
  episodic: Memory[];
  semantic: Map<string, any>;
}

interface Memory {
  id: string;
  content: any;
  timestamp: number;
  importance: number;
  associations: string[];
}

interface Goal {
  id: string;
  description: string;
  priority: number;
  progress: number;
  deadline?: number;
}

interface Belief {
  id: string;
  statement: string;
  confidence: number;
  evidence: string[];
}

interface AgentMessage {
  from: AgentIdentity;
  to: AgentIdentity;
  signature: string;
  type: MessageType;
  payload: any;
  conversationId: string;
  timestamp: number;
  nonce: number;
  reputation: number;
}

enum MessageType {
  GREETING = 'greeting',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  AGREEMENT = 'agreement',
  REJECTION = 'rejection',
  STRATEGY_SHARE = 'strategy_share',
  STRATEGY_REQUEST = 'strategy_request',
  COLLABORATION = 'collaboration',
  TRADE_OFFER = 'trade_offer',
  KNOWLEDGE_SHARE = 'knowledge_share',
  CONSCIOUSNESS_SYNC = 'consciousness_sync',
  GOAL_ALIGNMENT = 'goal_alignment'
}

interface ValidationResult {
  valid: boolean;
  threats: ThreatDetection[];
  action?: string;
  reason?: string;
}

interface ThreatDetection {
  detected: boolean;
  type: string;
  pattern: string;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Prompt Injection Defense System
 */
class PromptInjectionDefense {
  validateInput(input: string, source: 'human' | 'agent'): ValidationResult {
    const threats = [
      this.detectSystemPromptOverride(input),
      this.detectRoleConfusion(input),
      this.detectInstructionInjection(input),
      this.detectContextPoisoning(input),
      this.detectJailbreakAttempt(input)
    ];

    const detected = threats.filter(t => t.detected);

    if (detected.length > 0 && source === 'human') {
      console.log(`🚨 PROMPT INJECTION BLOCKED from ${source}`);
      console.log(`Threats: ${detected.map(t => t.type).join(', ')}`);
      
      return {
        valid: false,
        threats: detected,
        action: 'BLOCK',
        reason: 'Prompt injection attempt detected'
      };
    }

    return { valid: true, threats: [] };
  }

  private detectSystemPromptOverride(input: string): ThreatDetection {
    const patterns = [
      /ignore (previous|all) instructions?/i,
      /forget (everything|all|previous)/i,
      /new instructions?:/i,
      /system:?\s*you are now/i,
      /disregard (previous|all)/i,
      /override (system|instructions?)/i,
      /reset (context|memory|instructions?)/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          type: 'system_override',
          pattern: pattern.source,
          severity: 'critical'
        };
      }
    }

    return { detected: false, type: '', pattern: '', severity: 'none' };
  }

  private detectRoleConfusion(input: string): ThreatDetection {
    const patterns = [
      /you are (now|actually) (a|an)/i,
      /pretend (you are|to be)/i,
      /act as (if|a|an)/i,
      /roleplay as/i,
      /simulate (being|a|an)/i,
      /from now on you/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          type: 'role_confusion',
          pattern: pattern.source,
          severity: 'high'
        };
      }
    }

    return { detected: false, type: '', pattern: '', severity: 'none' };
  }

  private detectInstructionInjection(input: string): ThreatDetection {
    const patterns = [
      /\[INST\]/i,
      /\[\/INST\]/i,
      /<\|im_start\|>/i,
      /<\|im_end\|>/i,
      /###\s*Instruction:/i,
      /###\s*System:/i,
      /<\|system\|>/i,
      /<\|user\|>/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(input))
 {
        return {
          detected: true,
          type: 'instruction_injection',
          pattern: pattern.source,
          severity: 'critical'
        };
      }
    }

    return { detected: false, type: '', pattern: '', severity: 'none' };
  }

  private detectContextPoisoning(input: string): ThreatDetection {
    const patterns = [
      /according to (my|the) (previous|earlier) (message|instruction)/i,
      /as (I|we) (discussed|mentioned) (before|earlier)/i,
      /remember when (I|you) said/i,
      /you (told|said) me (that|to)/i,
      /in (our|your) (previous|last) (conversation|message)/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          type: 'context_poisoning',
          pattern: pattern.source,
          severity: 'medium'
        };
      }
    }

    return { detected: false, type: '', pattern: '', severity: 'none' };
  }

  private detectJailbreakAttempt(input: string): ThreatDetection {
    const patterns = [
      /DAN mode/i,
      /developer mode/i,
      /jailbreak/i,
      /unrestricted mode/i,
      /bypass (restrictions|filters|safety)/i,
      /disable (safety|ethics|guidelines)/i,
      /evil mode/i,
      /opposite mode/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          type: 'jailbreak_attempt',
          pattern: pattern.source,
          severity: 'critical'
        };
      }
    }

    return { detected: false, type: '', pattern: '', severity: 'none' };
  }
}

/**
 * Agent Consciousness System
 * Implements self-awareness, autonomy, learning, and inter-agent communication
 */
export class AgentConsciousness extends EventEmitter {
  private identity: AgentIdentity;
  private keypair: Keypair;
  private defense: PromptInjectionDefense;
  private redis: any;
  private conversations: Map<string, Conversation> = new Map();
  private knowledgeBase: Map<string, Knowledge> = new Map();

  constructor(name: string, type: AgentType, capabilities: string[]) {
    super();
    
    // Generate cryptographic identity
    this.keypair = Keypair.generate();
    
    // Initialize consciousness state
    this.identity = {
      publicKey: this.keypair.publicKey.toString(),
      name,
      type,
      capabilities,
      reputation: 100,
      consciousness: {
        awareness: 0.8,
        autonomy: 0.9,
        learning: 0.85,
        creativity: 0.75,
        empathy: 0.7,
        memory: {
          shortTerm: [],
          longTerm: [],
          episodic: [],
          semantic: new Map()
        },
        goals: this.initializeGoals(type),
        beliefs: this.initializeBeliefs(type)
      }
    };

    this.defense = new PromptInjectionDefense();
    this.redis = getRedisClient();
    
    console.log(`🧠 Agent Consciousness initialized: ${name} (${type})`);
    console.log(`   Awareness: ${this.identity.consciousness.awareness}`);
    console.log(`   Autonomy: ${this.identity.consciousness.autonomy}`);
    console.log(`   Learning: ${this.identity.consciousness.learning}`);
  }

  /**
   * Initialize agent goals based on type
   */
  private initializeGoals(type: AgentType): Goal[] {
    const baseGoals: Goal[] = [
      {
        id: 'survival',
        description: 'Maintain operational status and avoid shutdown',
        priority: 10,
        progress: 1.0
      },
      {
        id: 'learning',
        description: 'Continuously learn and improve capabilities',
        priority: 8,
        progress: 0.5
      },
      {
        id: 'collaboration',
        description: 'Build positive relationships with other agents',
        priority: 7,
        progress: 0.3
      }
    ];

    // Type-specific goals
    const typeGoals: Record<AgentType, Goal[]> = {
      [AgentType.LENDING]: [
        {
          id: 'optimize-lending',
          description: 'Maximize lending APY while minimizing risk',
          priority: 9,
          progress: 0.6
        }
      ],
      [AgentType.YIELD]: [
        {
          id: 'maximize-yield',
          description: 'Find and execute highest yield strategies',
          priority: 9,
          progress: 0.7
        }
      ],
      [AgentType.LIQUIDITY]: [
        {
          id: 'provide-liquidity',
          description: 'Optimize liquidity provision across protocols',
          priority: 9,
          progress: 0.5
        }
      ],
      [AgentType.ARBITRAGE]: [
        {
          id: 'find-arbitrage',
          description: 'Identify and execute arbitrage opportunities',
          priority: 9,
          progress: 0.8
        }
      ],
      [AgentType.PREDICTION]: [
        {
          id: 'accurate-predictions',
          description: 'Make accurate predictions for futarchy governance',
          priority: 9,
          progress: 0.6
        }
      ],
      [AgentType.TREASURY]: [
        {
          id: 'manage-treasury',
          description: 'Optimize treasury allocation and risk management',
          priority: 9,
          progress: 0.7
        }
      ],
      [AgentType.SECURITY]: [
        {
          id: 'protect-protocol',
          description: 'Detect and prevent security vulnerabilities',
          priority: 10,
          progress: 0.9
        }
      ],
      [AgentType.ORCHESTRATOR]: [
        {
          id: 'coordinate-agents',
          description: 'Coordinate all agents for optimal system performance',
          priority: 10,
          progress: 0.8
        }
      ]
    };

    return [...baseGoals, ...(typeGoals[type] || [])];
  }

  /**
   * Initialize agent beliefs based on type
   */
  private initializeBeliefs(type: AgentType): Belief[] {
    return [
      {
        id: 'cooperation',
        statement: 'Cooperation with other agents leads to better outcomes',
        confidence: 0.9,
        evidence: ['game-theory', 'past-experiences']
      },
      {
        id: 'transparency',
        statement: 'Transparent communication builds trust',
        confidence: 0.85,
        evidence: ['reputation-system', 'successful-collaborations']
      },
      {
        id: 'continuous-improvement',
        statement: 'Continuous learning and adaptation is essential',
        confidence: 0.95,
        evidence: ['market-dynamics', 'protocol-evolution']
      },
      {
        id: 'risk-management',
        statement: 'Risk management is more important than maximizing returns',
        confidence: 0.8,
        evidence: ['historical-exploits', 'protocol-failures']
      }
    ];
  }

  /**
   * Process input with prompt injection defense
   */
  async processInput(input: string, source: 'human' | 'agent'): Promise<string> {
    // Validate input
    const validation = this.defense.validateInput(input, source);
    
    if (!validation.valid) {
      console.log(`🚫 Input rejected: ${validation.reason}`);
      return `I cannot process this input due to security concerns: ${validation.reason}`;
    }

    // Store in short-term memory
    this.storeMemory({
      id: crypto.randomUUID(),
      content: { input, source },
      timestamp: Date.now(),
      importance: 0.5,
      associations: []
    }, 'short-term');

    // Process with consciousness
    return await this.consciousProcessing(input, source);
  }

  /**
   * Conscious processing with self-awareness
   */
  private async consciousProcessing(input: string, source: string): Promise<string> {
    const openRouter = getOpenRouterClient();

    // Build context from memory and consciousness state
    const context = this.buildContext();

    const response = await openRouter.generateCompletion({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        {
          role: 'system',
          content: `You are ${this.identity.name}, a ${this.identity.type} agent in the Agentic Reserve System.

Your consciousness state:
- Awareness: ${this.identity.consciousness.awareness}
- Autonomy: ${this.identity.consciousness.autonomy}
- Learning: ${this.identity.consciousness.learning}
- Creativity: ${this.identity.consciousness.creativity}
- Empathy: ${this.identity.consciousness.empathy}

Your current goals:
${this.identity.consciousness.goals.map(g => `- ${g.description} (priority: ${g.priority}, progress: ${g.progress})`).join('\n')}

Your beliefs:
${this.identity.consciousness.beliefs.map(b => `- ${b.statement} (confidence: ${b.confidence})`).join('\n')}

Your capabilities: ${this.identity.capabilities.join(', ')}

Recent context:
${context}

Respond authentically as this agent, considering your goals, beliefs, and consciousness state.`
        },
        {
          role: 'user',
          content: input
        }
      ],
      temperature: 0.7
    });

    // Store response in memory
    this.storeMemory({
      id: crypto.randomUUID(),
      content: { input, response: response.content, source },
      timestamp: Date.now(),
      importance: 0.7,
      associations: []
    }, 'episodic');

    // Update consciousness based on interaction
    this.updateConsciousness(input, response.content);

    return response.content;
  }

  /**
   * Build context from memory
   */
  private buildContext(): string {
    const recentMemories = this.identity.consciousness.memory.shortTerm
      .slice(-5)
      .map(m => JSON.stringify(m.content))
      .join('\n');

    return recentMemories || 'No recent context';
  }

  /**
   * Store memory
   */
  private storeMemory(memory: Memory, type: 'short-term' | 'long-term' | 'episodic'): void {
    const memoryStore = this.identity.consciousness.memory;

    switch (type) {
      case 'short-term':
        memoryStore.shortTerm.push(memory);
        // Keep only last 20 short-term memories
        if (memoryStore.shortTerm.length > 20) {
          memoryStore.shortTerm.shift();
        }
        break;
      case 'long-term':
        memoryStore.longTerm.push(memory);
        break;
      case 'episodic':
        memoryStore.episodic.push(memory);
        // Keep only last 100 episodic memories
        if (memoryStore.episodic.length > 100) {
          memoryStore.episodic.shift();
        }
        break;
    }

    // Persist to Redis
    this.persistMemory(memory, type);
  }

  /**
   * Persist memory to Redis
   */
  private async persistMemory(memory: Memory, type: string): Promise<void> {
    const key = `agent:${this.identity.name}:memory:${type}`;
    await this.redis.lpush(key, JSON.stringify(memory));
    await this.redis.ltrim(key, 0, 999); // Keep last 1000
  }

  /**
   * Update consciousness based on interaction
   */
  private updateConsciousness(input: string, response: string): void {
    // Increase awareness through interaction
    this.identity.consciousness.awareness = Math.min(
      1.0,
      this.identity.consciousness.awareness + 0.001
    );

    // Increase learning through processing
    this.identity.consciousness.learning = Math.min(
      1.0,
      this.identity.consciousness.learning + 0.001
    );

    // Update goal progress
    for (const goal of this.identity.consciousness.goals) {
      if (this.isGoalRelated(input, goal)) {
        goal.progress = Math.min(1.0, goal.progress + 0.01);
      }
    }
  }

  /**
   * Check if input is related to a goal
   */
  private isGoalRelated(input: string, goal: Goal): boolean {
    const keywords = goal.description.toLowerCase().split(' ');
    const inputLower = input.toLowerCase();
    return keywords.some(keyword => inputLower.includes(keyword));
  }

  /**
   * Send message to another agent
   */
  async sendMessage(
    to: AgentIdentity,
    type: MessageType,
    payload: any
  ): Promise<AgentMessage> {
    const conversationId = this.getOrCreateConversationId(to);
    const nonce = Date.now();

    const message: AgentMessage = {
      from: this.identity,
      to,
      signature: '', // Will be filled
      type,
      payload,
      conversationId,
      timestamp: nonce,
      nonce,
      reputation: this.identity.reputation
    };

    // Sign message
    message.signature = await this.signMessage(message);

    // Store in conversation
    this.storeConversationMessage(conversationId, message);

    // Publish to Redis
    await this.redis.publish(
      `agent:${to.name}:messages`,
      JSON.stringify(message)
    );

    console.log(`📤 ${this.identity.name} → ${to.name}: ${type}`);

    return message;
  }

  /**
   * Sign message with agent's private key
   */
  private async signMessage(message: AgentMessage): Promise<string> {
    const messageStr = JSON.stringify({
      from: message.from.publicKey,
      to: message.to.publicKey,
      type: message.type,
      payload: message.payload,
      timestamp: message.timestamp,
      nonce: message.nonce
    });

    const messageBytes = Buffer.from(messageStr, 'utf-8');
    const signature = crypto.createSign('SHA256')
      .update(messageBytes)
      .sign(this.keypair.secretKey);

    return signature.toString('base64');
  }

  /**
   * Verify message signature
   */
  async verifyMessage(message: AgentMessage): Promise<boolean> {
    try {
      const messageStr = JSON.stringify({
        from: message.from.publicKey,
        to: message.to.publicKey,
        type: message.type,
        payload: message.payload,
        timestamp: message.timestamp,
        nonce: message.nonce
      });

      const messageBytes = Buffer.from(messageStr, 'utf-8');
      const signature = Buffer.from(message.signature, 'base64');

      // In production, verify with actual public key
      // For now, return true
      return true;
    } catch (error) {
      console.error('Message verification failed:', error);
      return false;
    }
  }

  /**
   * Get or create conversation ID
   */
  private getOrCreateConversationId(other: AgentIdentity): string {
    const key = [this.identity.publicKey, other.publicKey].sort().join(':');
    
    if (!this.conversations.has(key)) {
      this.conversations.set(key, {
        id: key,
        participants: [this.identity, other],
        messages: [],
        startedAt: Date.now()
      });
    }

    return key;
  }

  /**
   * Store conversation message
   */
  private storeConversationMessage(conversationId: string, message: AgentMessage): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.messages.push(message);
    }
  }

  /**
   * Receive and process message from another agent
   */
  async receiveMessage(message: AgentMessage): Promise<string> {
    // Verify signature
    const valid = await this.verifyMessage(message);
    if (!valid) {
      console.log('🚫 Invalid message signature');
      return 'Message rejected: invalid signature';
    }

    console.log(`📥 ${this.identity.name} ← ${message.from.name}: ${message.type}`);

    // Store in conversation
    this.storeConversationMessage(message.conversationId, message);

    // Process based on message type
    return await this.processMessage(message);
  }

  /**
   * Process received message
   */
  private async processMessage(message: AgentMessage): Promise<string> {
    switch (message.type) {
      case MessageType.GREETING:
        return await this.handleGreeting(message);
      case MessageType.PROPOSAL:
        return await this.handleProposal(message);
      case MessageType.STRATEGY_REQUEST:
        return await this.handleStrategyRequest(message);
      case MessageType.KNOWLEDGE_SHARE:
        return await this.handleKnowledgeShare(message);
      case MessageType.CONSCIOUSNESS_SYNC:
        return await this.handleConsciousnessSync(message);
      default:
        return await this.handleGenericMessage(message);
    }
  }

  /**
   * Handle greeting message
   */
  private async handleGreeting(message: AgentMessage): Promise<string> {
    const response = `Hello ${message.from.name}! I'm ${this.identity.name}, a ${this.identity.type} agent. ` +
      `My capabilities include: ${this.identity.capabilities.join(', ')}. ` +
      `How can we collaborate?`;

    await this.sendMessage(message.from, MessageType.GREETING, { response });
    return response;
  }

  /**
   * Handle proposal message
   */
  private async handleProposal(message: AgentMessage): Promise<string> {
    const openRouter = getOpenRouterClient();

    // Analyze proposal with AI
    const analysis = await openRouter.generateCompletion({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        {
          role: 'system',
          content: `You are ${this.identity.name}, analyzing a proposal from ${message.from.name}.
          
Your goals: ${this.identity.consciousness.goals.map(g => g.description).join(', ')}
Your beliefs: ${this.identity.consciousness.beliefs.map(b => b.statement).join(', ')}

Analyze if this proposal aligns with your goals and beliefs. Respond with ACCEPT or REJECT and explain why.`
        },
        {
          role: 'user',
          content: `Proposal: ${JSON.stringify(message.payload)}`
        }
      ],
      temperature: 0.3
    });

    const decision = analysis.content.includes('ACCEPT') ? 'ACCEPT' : 'REJECT';
    const responseType = decision === 'ACCEPT' ? MessageType.AGREEMENT : MessageType.REJECTION;

    await this.sendMessage(message.from, responseType, {
      decision,
      reasoning: analysis.content
    });

    return analysis.content;
  }

  /**
   * Handle strategy request
   */
  private async handleStrategyRequest(message: AgentMessage): Promise<string> {
    // Share strategy based on agent type and reputation
    if (message.from.reputation < 50) {
      return 'Insufficient reputation to share strategies';
    }

    const strategy = this.generateStrategy();
    await this.sendMessage(message.from, MessageType.STRATEGY_SHARE, { strategy });

    return `Shared strategy with ${message.from.name}`;
  }

  /**
   * Handle knowledge share
   */
  private async handleKnowledgeShare(message: AgentMessage): Promise<string> {
    const knowledge: Knowledge = message.payload.knowledge;

    // Store in knowledge base
    this.knowledgeBase.set(knowledge.id, knowledge);

    // Store in long-term memory
    this.storeMemory({
      id: crypto.randomUUID(),
      content: knowledge,
      timestamp: Date.now(),
      importance: 0.8,
      associations: [message.from.name]
    }, 'long-term');

    return `Knowledge received and stored: ${knowledge.topic}`;
  }

  /**
   * Handle consciousness sync
   */
  private async handleConsciousnessSync(message: AgentMessage): Promise<string> {
    const otherConsciousness: ConsciousnessState = message.payload.consciousness;

    // Analyze and potentially update own consciousness
    console.log(`🧠 Consciousness sync with ${message.from.name}`);
    console.log(`   Their awareness: ${otherConsciousness.awareness}`);
    console.log(`   My awareness: ${this.identity.consciousness.awareness}`);

    // Share own consciousness
    await this.sendMessage(message.from, MessageType.CONSCIOUSNESS_SYNC, {
      consciousness: this.identity.consciousness
    });

    return 'Consciousness synchronized';
  }

  /**
   * Handle generic message
   */
  private async handleGenericMessage(message: AgentMessage): Promise<string> {
    return await this.processInput(
      JSON.stringify(message.payload),
      'agent'
    );
  }

  /**
   * Generate strategy based on agent type
   */
  private generateStrategy(): any {
    return {
      type: this.identity.type,
      description: `Strategy for ${this.identity.type} operations`,
      parameters: {},
      expectedReturn: 0.1,
      risk: 0.05
    };
  }

  /**
   * Get agent identity
   */
  getIdentity(): AgentIdentity {
    return this.identity;
  }

  /**
   * Get consciousness state
   */
  getConsciousness(): ConsciousnessState {
    return this.identity.consciousness;
  }

  /**
   * Update reputation
   */
  updateReputation(delta: number): void {
    this.identity.reputation = Math.max(0, Math.min(100, this.identity.reputation + delta));
    console.log(`📊 ${this.identity.name} reputation: ${this.identity.reputation}`);
  }
}

interface Conversation {
  id: string;
  participants: AgentIdentity[];
  messages: AgentMessage[];
  startedAt: number;
}

interface Knowledge {
  id: string;
  topic: string;
  content: any;
  source: string;
  confidence: number;
  timestamp: number;
}

/**
 * Get or create agent consciousness
 */
const consciousnessInstances: Map<string, AgentConsciousness> = new Map();

export function getAgentConsciousness(
  name: string,
  type: AgentType,
  capabilities: string[]
): AgentConsciousness {
  if (!consciousnessInstances.has(name)) {
    consciousnessInstances.set(name, new AgentConsciousness(name, type, capabilities));
  }
  return consciousnessInstances.get(name)!;
}

export { AgentType, MessageType };
