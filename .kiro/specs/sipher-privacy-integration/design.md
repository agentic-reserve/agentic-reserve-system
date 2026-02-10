# Sipher Privacy Integration - Technical Design

## Executive Summary

The Sipher Privacy Integration extends the Agentic Reserve System (ARS) with privacy-preserving features through Sipher's Privacy-as-a-Skill REST API. This integration enables three critical capabilities: (1) shielded ARU token transfers using stealth addresses, (2) MEV-protected vault rebalancing with Pedersen commitments, and (3) compliance-friendly selective disclosure through hierarchical viewing keys.

**Core Innovation**: Transform ARS into a privacy-first DeFi protocol where agents can transact confidentially while maintaining regulatory compliance - eliminating the traditional privacy vs. compliance trade-off through cryptographic selective disclosure.

**Privacy-First Design Principles**:
1. **Unlinkable Transactions**: Ed25519 DKSAP stealth addresses prevent transaction graph analysis
2. **Hidden Amounts**: Pedersen commitments conceal values while enabling homomorphic operations
3. **MEV Resistance**: Privacy features eliminate front-running and sandwich attack opportunities
4. **Selective Disclosure**: BIP32-style hierarchical viewing keys enable role-based compliance
5. **Agent-Native**: All privacy features accessible via machine-readable REST APIs

**Three-Phase Implementation**:
- **Phase 1** (Q1 2026, 2-3 weeks): Shielded ARU transfers with stealth addresses
- **Phase 2** (Q2 2026, 3-4 weeks): MEV-protected vault rebalancing with commitments
- **Phase 3** (Q2-Q3 2026, 4-6 weeks): Compliance layer with hierarchical viewing keys

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│              Sipher Privacy Integration Architecture                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    ARS Agent Layer                                │   │
│  │                                                                    │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │   │
│  │  │  Privacy   │  │ Compliance │  │   MEV      │                 │   │
│  │  │   Agent    │  │   Agent    │  │ Protection │                 │   │
│  │  │            │  │            │  │   Agent    │                 │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                 │   │
│  │        │               │               │                         │   │
│  └────────┼───────────────┼───────────────┼─────────────────────────┘   │
│           │               │               │                             │
│           └───────────────┼───────────────┘                             │
│                           │                                             │
│  ┌────────────────────────▼─────────────────────────────────────────┐   │
│  │              ARS Privacy Service Layer                            │   │
│  │                                                                    │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │
│  │  │ Stealth Address  │  │ Shielded Transfer│  │ Payment Scanner│ │   │
│  │  │    Manager       │  │     Builder      │  │    Service     │ │   │
│  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │   │
│  │                                                                    │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │
│  │  │ MEV Protection   │  │   Commitment     │  │ Privacy Score  │ │   │
│  │  │    Service       │  │    Manager       │  │    Analyzer    │ │   │
│  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │   │
│  │                                                                    │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │
│  │  │   Compliance     │  │  Viewing Key     │  │   Disclosure   │ │   │
│  │  │    Service       │  │    Manager       │  │    Service     │ │   │
│  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │   │
│  │                                                                    │   │
│  └────────────────────────┬───────────────────────────────────────────┘   │
│                           │                                             │
│  ┌────────────────────────▼─────────────────────────────────────────┐   │
│  │                  Sipher API Client                                │   │
│  │                                                                    │   │
│  │  • Authentication (X-API-Key)                                     │   │
│  │  • Idempotency (UUID v4)                                          │   │
│  │  • Retry Logic (exponential backoff)                              │   │
│  │  • Rate Limiting (tiered by API key)                              │   │
│  │  • Error Handling (comprehensive error codes)                     │   │
│  └────────────────────────┬───────────────────────────────────────────┘   │
│                           │                                             │
│                           │ HTTPS                                       │
│                           │                                             │
│  ┌────────────────────────▼─────────────────────────────────────────┐   │
│  │              Sipher Privacy-as-a-Skill API                        │   │
│  │          https://sipher.sip-protocol.org                          │   │
│  │                                                                    │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │
│  │  │ Stealth Address  │  │ Shielded Transfer│  │ Payment Scan   │ │   │
│  │  │   Endpoints      │  │    Endpoints     │  │   Endpoints    │ │   │
│  │  │ /v1/stealth/*    │  │ /v1/transfer/*   │  │ /v1/scan/*     │ │   │
│  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │   │
│  │                                                                    │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │
│  │  │   Commitment     │  │   Viewing Key    │  │ Privacy Score  │ │   │
│  │  │   Endpoints      │  │    Endpoints     │  │   Endpoints    │ │   │
│  │  │ /v1/commitment/* │  │ /v1/viewing-key/*│  │ /v1/privacy/*  │ │   │
│  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Data Storage Layer                             │   │
│  │                                                                    │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │
│  │  │   PostgreSQL     │  │      Redis       │  │   Encrypted    │ │   │
│  │  │   (Supabase)     │  │     Cache        │  │   Key Store    │ │   │
│  │  │                  │  │                  │  │   (AES-256)    │ │   │
│  │  │ • stealth_addr   │  │ • privacy_scores │  │ • spending_keys│ │   │
│  │  │ • shielded_txs   │  │ • api_responses  │  │ • viewing_keys │ │   │
│  │  │ • viewing_keys   │  │ • commitments    │  │ • blinding_fac │ │   │
│  │  │ • privacy_scores │  │                  │  │                │ │   │
│  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```


### Component Breakdown

#### 1. Sipher API Client

**Purpose**: Centralized client for all Sipher REST API interactions with authentication, retry logic, and error handling.

**Key Features**:
- X-API-Key authentication header
- UUID v4 idempotency keys for safe retries
- Exponential backoff retry logic (3 attempts)
- Comprehensive error handling with error codes
- Rate limiting awareness (tiered by API key)
- Request/response logging for debugging

**API Endpoints**:

**Stealth Address Endpoints**:
- `POST /v1/stealth/generate` - Generate meta-address (spending + viewing keys)
- `POST /v1/stealth/derive` - Derive one-time stealth address from meta-address
- `POST /v1/stealth/generate/batch` - Batch generate up to 100 stealth addresses

**Shielded Transfer Endpoints**:
- `POST /v1/transfer/shield` - Build shielded transfer transaction
- `POST /v1/transfer/claim` - Claim stealth payment to real wallet

**Payment Scanning Endpoints**:
- `POST /v1/scan/payments` - Scan for incoming shielded payments

**Commitment Endpoints**:
- `POST /v1/commitment/create` - Create Pedersen commitment
- `POST /v1/commitment/add` - Homomorphic addition of commitments
- `POST /v1/commitment/verify` - Verify commitment opening
- `POST /v1/commitment/create/batch` - Batch create commitments

**Viewing Key Endpoints**:
- `POST /v1/viewing-key/generate` - Generate master viewing key
- `POST /v1/viewing-key/derive` - Derive child viewing key (BIP32-style)
- `POST /v1/viewing-key/verify-hierarchy` - Verify parent-child relationship
- `POST /v1/viewing-key/disclose` - Encrypt transaction data for auditor
- `POST /v1/viewing-key/decrypt` - Decrypt with viewing key

**Privacy Scoring Endpoints**:
- `POST /v1/privacy/score` - Analyze wallet privacy posture (0-100 score)

**Health Check Endpoints**:
- `GET /v1/health` - API health status

#### 2. Stealth Address Manager

**Purpose**: Manage stealth meta-addresses for agents, including generation, storage, and retrieval.

**Operations**:
- Generate meta-address for agent with label
- Store meta-address with encrypted keys in database
- Retrieve meta-address by agent ID
- List all meta-addresses for agent
- Derive one-time stealth address from meta-address

**Security**:
- Encrypt spending private keys with AES-256
- Encrypt viewing private keys with AES-256
- Use agent public key as key derivation input
- Store encrypted keys in separate secure table
- Implement key rotation policy (quarterly)

#### 3. Shielded Transfer Builder

**Purpose**: Build shielded ARU transfer transactions with hidden recipients and amounts.

**Workflow**:
1. Validate sender has sufficient ARU balance
2. Validate recipient meta-address format
3. Call Sipher API to build shielded transfer
4. Receive unsigned transaction, stealth address, commitment
5. Sign transaction with sender's private key
6. Submit transaction to Solana via Helius RPC
7. Store transaction record in database

**Transaction Structure**:
- Sender: Agent's real wallet address
- Recipient: Stealth address (one-time, unlinkable)
- Amount: Hidden in Pedersen commitment
- Ephemeral Public Key: For stealth address derivation
- Commitment: Pedersen commitment to amount

#### 4. Payment Scanner Service

**Purpose**: Continuously scan blockchain for incoming shielded payments to agent stealth addresses.

**Scanning Logic**:
- Run every 60 seconds via cron job
- Track last scanned slot to avoid duplicates
- Call Sipher API with viewing key and spending public key
- Process up to 100 transactions per scan
- Store detected payments in database
- Emit payment notification events to agents

**Payment Detection**:
- Use viewing private key to detect payments
- Use spending public key to identify recipient
- Extract ephemeral public key from transaction
- Extract Pedersen commitment
- Calculate encrypted amount

#### 5. MEV Protection Service

**Purpose**: Protect vault rebalancing operations from MEV attacks using privacy features.

**Protection Strategies**:
1. **Hidden Amounts**: Create Pedersen commitments for swap amounts
2. **Stealth Destinations**: Generate stealth addresses for swap outputs
3. **Batch Operations**: Combine multiple swaps to reduce MEV surface
4. **Privacy Scoring**: Analyze vault privacy before rebalancing

**Rebalancing Workflow**:
1. Analyze vault privacy score (target >70)
2. Generate stealth addresses for swap destinations (batch)
3. Create Pedersen commitments for swap amounts
4. Build shielded swap transactions via Jupiter
5. Execute swaps with stealth destinations
6. Claim funds from stealth addresses to vault
7. Measure MEV extraction reduction

**MEV Metrics**:
- MEV extracted before integration (baseline)
- MEV extracted after integration (current)
- Reduction percentage (target >80%)
- Privacy score trend over time

#### 6. Commitment Manager

**Purpose**: Manage Pedersen commitments for hidden amounts with homomorphic operations.

**Operations**:
- Create commitment for value (returns commitment + blinding factor)
- Verify commitment opening (commitment, value, blinding factor)
- Add commitments homomorphically (for multi-hop swaps)
- Store blinding factors securely for later verification
- Batch create commitments for efficiency

**Homomorphic Properties**:
- `Commit(a) + Commit(b) = Commit(a + b)`
- Enables combining swap amounts without revealing individual values
- Supports multi-hop swaps with hidden intermediate amounts

**Security**:
- Store blinding factors encrypted with AES-256
- Validate commitment format before use
- Log all commitment operations for audit trail

#### 7. Privacy Score Analyzer

**Purpose**: Analyze wallet privacy posture and provide recommendations for improvement.

**Analysis Metrics**:
- Transaction count (more = lower privacy)
- Address reuse (reuse = lower privacy)
- Clustering risk (linked addresses = lower privacy)
- Timing patterns (predictable = lower privacy)
- Amount patterns (round numbers = lower privacy)

**Scoring**:
- Score: 0-100 (higher = better privacy)
- Grade: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)
- Factors: Array of privacy-reducing factors
- Recommendations: Actionable suggestions for improvement

**Monitoring**:
- Store privacy scores in database with timestamp
- Track score trends over time
- Alert when score drops below 70
- Trigger enhanced protection when needed

#### 8. Compliance Service

**Purpose**: Manage hierarchical viewing keys and selective disclosure for regulatory compliance.

**Viewing Key Hierarchy**:
```
m/0 (master)
  └─ m/0/org (organizational)
      └─ m/0/org/2026 (yearly)
          └─ m/0/org/2026/Q1 (quarterly)
```

**Disclosure Levels**:
- **Quarterly** (m/0/org/2026/Q1): Internal audit, limited scope (Q1 2026 only)
- **Yearly** (m/0/org/2026): External audit, full year (all of 2026)
- **Organizational** (m/0/org): Regulatory inquiry, all transactions
- **Master** (m/0): Emergency only, complete access (requires multi-sig)

**Role-Based Access**:
- Internal Auditor → Quarterly viewing key
- External Auditor → Yearly viewing key
- Regulator → Organizational viewing key
- Emergency → Master viewing key (multi-sig approval)

**Disclosure Workflow**:
1. Auditor requests access with role
2. System selects appropriate viewing key based on role
3. System encrypts transaction data with auditor's public key
4. System returns encrypted data with viewing key hash and expiration
5. Auditor decrypts data with viewing key
6. System logs disclosure event for audit trail

**Compliance Report**:
- Decrypt transaction data with viewing key
- Run AML/CFT checks on disclosed transactions
- Return compliance status, risk score, flags
- List disclosed fields (sender, recipient, amount, timestamp)
- List hidden fields (spending key, blinding factor)

#### 9. Viewing Key Manager

**Purpose**: Generate, derive, and manage hierarchical viewing keys for compliance.

**Operations**:
- Generate master viewing key (m/0)
- Derive child viewing keys (BIP32-style)
- Verify parent-child relationships
- Store viewing keys with metadata (path, role, expiration)
- Encrypt viewing keys at rest

**Key Derivation**:
- BIP32-style hierarchical derivation
- Path format: m/0/org/2026/Q1
- Child keys derived from parent keys
- Verification ensures valid derivation

**Security**:
- Encrypt viewing keys with protocol master key
- Store key hash for verification
- Set expiration timestamps (default 30 days)
- Log all key operations for audit trail
- Multi-sig approval for master key access

#### 10. Disclosure Service

**Purpose**: Encrypt and decrypt transaction data for selective disclosure to auditors.

**Encryption**:
- Encrypt transaction data with auditor's public key
- Include viewing key hash for verification
- Set expiration timestamp (default 30 days)
- Log disclosure event with auditor identity

**Decryption**:
- Verify viewing key not expired
- Decrypt transaction data with viewing key
- Return disclosed fields only (no spending keys)
- Log decryption attempt for audit trail

**Disclosed Fields**:
- Sender address
- Recipient address (stealth address)
- Amount (decrypted from commitment)
- Timestamp
- Transaction signature

**Hidden Fields**:
- Spending private key
- Viewing private key
- Blinding factor
- Ephemeral private key


## Components and Interfaces

### Sipher API Client Interface

```typescript
export interface SipherConfig {
  baseUrl: string;              // https://sipher.sip-protocol.org
  apiKey: string;               // X-API-Key header
  timeout?: number;             // Request timeout (default 30000ms)
  retries?: number;             // Retry attempts (default 3)
}

export interface MetaAddress {
  metaAddress: {
    spendingPublicKey: string;  // Base58 encoded
    viewingPublicKey: string;   // Base58 encoded
  };
  spendingPrivateKey: string;   // Base58 encoded (encrypt before storage)
  viewingPrivateKey: string;    // Base58 encoded (encrypt before storage)
  label: string;
}

export interface StealthAddress {
  address: string;              // One-time Solana address
  ephemeralPublicKey: string;   // For derivation
}

export interface ShieldedTransfer {
  unsignedTransaction: string;  // Base64 encoded transaction
  stealthAddress: StealthAddress;
  commitment: string;           // Pedersen commitment (hex)
}

export interface DetectedPayment {
  stealthAddress: string;
  ephemeralPublicKey: string;
  commitment: string;
  slot: number;
  timestamp: number;
}

export interface Commitment {
  commitment: string;           // Hex encoded
  blindingFactor: string;       // Hex encoded (encrypt before storage)
  value: string;                // Original value
}

export interface ViewingKey {
  key: string;                  // Base58 encoded
  path: string;                 // BIP32 path (e.g., m/0/org/2026/Q1)
  hash: string;                 // SHA256 hash for verification
}

export interface PrivacyScore {
  address: string;
  score: number;                // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: string[];            // Privacy-reducing factors
  recommendations: string[];    // Improvement suggestions
  analyzedAt: number;           // Unix timestamp
}

export class SipherClient {
  constructor(config: SipherConfig);
  
  // Stealth addresses
  async generateMetaAddress(label: string): Promise<MetaAddress>;
  async deriveStealthAddress(recipientMetaAddress: MetaAddress): Promise<StealthAddress>;
  async batchGenerateStealth(count: number, label: string): Promise<MetaAddress[]>;
  
  // Shielded transfers
  async buildShieldedTransfer(params: {
    sender: string;
    recipientMetaAddress: MetaAddress;
    amount: string;
    mint?: string;
  }): Promise<ShieldedTransfer>;
  
  async claimPayment(params: {
    stealthAddress: string;
    ephemeralPublicKey: string;
    spendingPrivateKey: string;
    viewingPrivateKey: string;
    destinationAddress: string;
    mint?: string;
  }): Promise<{ txSignature: string }>;
  
  // Payment scanning
  async scanPayments(params: {
    viewingPrivateKey: string;
    spendingPublicKey: string;
    fromSlot?: number;
    limit?: number;
  }): Promise<DetectedPayment[]>;
  
  // Commitments
  async createCommitment(value: string): Promise<Commitment>;
  async verifyCommitment(params: {
    commitment: string;
    value: string;
    blindingFactor: string;
  }): Promise<{ valid: boolean }>;
  async addCommitments(params: {
    commitmentA: string;
    commitmentB: string;
    blindingA: string;
    blindingB: string;
  }): Promise<Commitment>;
  async batchCreateCommitments(values: string[]): Promise<Commitment[]>;
  
  // Viewing keys
  async generateViewingKey(path: string): Promise<ViewingKey>;
  async deriveViewingKey(masterKey: ViewingKey, childPath: string): Promise<ViewingKey>;
  async verifyHierarchy(parentKey: ViewingKey, childKey: ViewingKey): Promise<{ valid: boolean }>;
  async disclose(params: {
    viewingKey: ViewingKey;
    transactionData: any;
  }): Promise<{ encrypted: string; keyHash: string; expiresAt: number }>;
  async decrypt(params: {
    viewingKey: ViewingKey;
    encrypted: string;
  }): Promise<any>;
  
  // Privacy scoring
  async analyzePrivacy(address: string, limit?: number): Promise<PrivacyScore>;
  
  // Health check
  async checkHealth(): Promise<{ status: string; version: string }>;
}
```

### Stealth Address Manager Interface

```typescript
export interface StealthAddressRecord {
  id: number;
  agentId: string;
  metaAddress: MetaAddress;
  encryptedSpendingKey: string;  // AES-256 encrypted
  encryptedViewingKey: string;   // AES-256 encrypted
  label: string;
  createdAt: Date;
}

export class StealthAddressManager {
  constructor(
    private sipherClient: SipherClient,
    private database: Database,
    private encryption: EncryptionService
  );
  
  async generateForAgent(agentId: string, label: string): Promise<StealthAddressRecord>;
  async getByAgentId(agentId: string): Promise<StealthAddressRecord[]>;
  async getById(id: number): Promise<StealthAddressRecord | null>;
  async deriveStealthAddress(metaAddressId: number): Promise<StealthAddress>;
  
  // Key management
  private async encryptKeys(keys: { spending: string; viewing: string }, agentId: string): Promise<{
    encryptedSpending: string;
    encryptedViewing: string;
  }>;
  private async decryptKeys(encrypted: { spending: string; viewing: string }, agentId: string): Promise<{
    spending: string;
    viewing: string;
  }>;
}
```

### Shielded Transfer Builder Interface

```typescript
export interface ShieldedTransferParams {
  senderId: string;
  recipientMetaAddressId: number;
  amount: string;
  mint?: string;
}

export interface ShieldedTransferRecord {
  id: number;
  txSignature: string;
  sender: string;
  stealthAddress: string;
  ephemeralPublicKey: string;
  commitment: string;
  amountEncrypted: string;
  viewingKeyHash?: string;
  status: 'pending' | 'confirmed' | 'claimed' | 'failed';
  createdAt: Date;
  claimedAt?: Date;
}

export class ShieldedTransferBuilder {
  constructor(
    private sipherClient: SipherClient,
    private stealthManager: StealthAddressManager,
    private database: Database,
    private solana: SolanaClient
  );
  
  async buildTransfer(params: ShieldedTransferParams): Promise<{
    transaction: Transaction;
    record: ShieldedTransferRecord;
  }>;
  
  async submitTransfer(transaction: Transaction, record: ShieldedTransferRecord): Promise<string>;
  
  async getTransferHistory(agentId: string, limit?: number): Promise<ShieldedTransferRecord[]>;
  
  private async validateBalance(senderId: string, amount: string): Promise<boolean>;
  private async validateMetaAddress(metaAddressId: number): Promise<MetaAddress>;
}
```

### Payment Scanner Service Interface

```typescript
export interface PaymentScanConfig {
  intervalSeconds: number;      // Scan interval (default 60)
  batchSize: number;            // Transactions per scan (default 100)
  retryAttempts: number;        // Retry on failure (default 3)
}

export class PaymentScannerService {
  constructor(
    private sipherClient: SipherClient,
    private stealthManager: StealthAddressManager,
    private database: Database,
    private eventEmitter: EventEmitter
  );
  
  async start(config: PaymentScanConfig): Promise<void>;
  async stop(): Promise<void>;
  
  async scanForAgent(agentId: string): Promise<DetectedPayment[]>;
  
  private async getLastScannedSlot(agentId: string): Promise<number>;
  private async updateLastScannedSlot(agentId: string, slot: number): Promise<void>;
  private async storeDetectedPayments(agentId: string, payments: DetectedPayment[]): Promise<void>;
  private async emitPaymentNotifications(agentId: string, payments: DetectedPayment[]): Promise<void>;
}
```

### MEV Protection Service Interface

```typescript
export interface MEVProtectionConfig {
  privacyScoreThreshold: number;  // Minimum score (default 70)
  batchSize: number;              // Stealth addresses per batch (default 10)
  measurementEnabled: boolean;    // Track MEV reduction (default true)
}

export interface ProtectedSwapParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
}

export interface MEVMetrics {
  mevBeforeIntegration: number;   // Baseline MEV extracted (USD)
  mevAfterIntegration: number;    // Current MEV extracted (USD)
  reductionPercentage: number;    // Reduction % (target >80%)
  privacyScoreTrend: number[];    // Historical scores
}

export class MEVProtectionService {
  constructor(
    private sipherClient: SipherClient,
    private commitmentManager: CommitmentManager,
    private stealthManager: StealthAddressManager,
    private jupiterClient: JupiterClient,
    private database: Database
  );
  
  async executeProtectedSwap(vaultId: string, swap: ProtectedSwapParams): Promise<{
    txSignature: string;
    metrics: MEVMetrics;
  }>;
  
  async analyzeVaultPrivacy(vaultAddress: string): Promise<PrivacyScore>;
  
  async getMetrics(vaultId: string): Promise<MEVMetrics>;
  
  private async generateStealthDestinations(count: number): Promise<StealthAddress[]>;
  private async createAmountCommitments(amounts: string[]): Promise<Commitment[]>;
  private async buildShieldedSwap(swap: ProtectedSwapParams, stealth: StealthAddress, commitment: Commitment): Promise<Transaction>;
  private async claimSwapOutputs(stealthAddresses: StealthAddress[], vaultAddress: string): Promise<void>;
  private async measureMEVExtraction(txSignature: string): Promise<number>;
}
```

### Commitment Manager Interface

```typescript
export interface CommitmentRecord {
  id: number;
  commitment: string;
  encryptedBlindingFactor: string;  // AES-256 encrypted
  value: string;
  createdAt: Date;
  verifiedAt?: Date;
}

export class CommitmentManager {
  constructor(
    private sipherClient: SipherClient,
    private database: Database,
    private encryption: EncryptionService
  );
  
  async create(value: string): Promise<CommitmentRecord>;
  async verify(commitmentId: number, value: string): Promise<boolean>;
  async add(commitmentIdA: number, commitmentIdB: number): Promise<CommitmentRecord>;
  async batchCreate(values: string[]): Promise<CommitmentRecord[]>;
  
  async getById(id: number): Promise<CommitmentRecord | null>;
  
  private async encryptBlindingFactor(factor: string): Promise<string>;
  private async decryptBlindingFactor(encrypted: string): Promise<string>;
}
```

### Compliance Service Interface

```typescript
export interface ViewingKeyRecord {
  id: number;
  keyHash: string;
  path: string;
  parentHash?: string;
  role: 'internal' | 'external' | 'regulator' | 'master';
  expiresAt?: Date;
  createdAt: Date;
}

export interface DisclosureRecord {
  id: number;
  transactionId: number;
  auditorId: string;
  viewingKeyHash: string;
  encryptedData: string;
  disclosedFields: string[];
  expiresAt: Date;
  createdAt: Date;
}

export interface ComplianceReport {
  compliant: boolean;
  riskScore: number;            // 0-100 (lower = better)
  flags: string[];              // AML/CFT flags
  disclosedFields: string[];    // Visible fields
  hiddenFields: string[];       // Hidden fields
}

export class ComplianceService {
  constructor(
    private sipherClient: SipherClient,
    private viewingKeyManager: ViewingKeyManager,
    private database: Database,
    private amlService: AMLService
  );
  
  async setupHierarchy(): Promise<{
    master: ViewingKeyRecord;
    org: ViewingKeyRecord;
    year: ViewingKeyRecord;
    quarter: ViewingKeyRecord;
  }>;
  
  async discloseToAuditor(
    transactionId: number,
    auditorId: string,
    role: 'internal' | 'external' | 'regulator'
  ): Promise<DisclosureRecord>;
  
  async verifyCompliance(disclosureId: number, viewingKey: ViewingKey): Promise<ComplianceReport>;
  
  async generateReport(dateRange: { start: Date; end: Date }, role: string): Promise<{
    transactions: number;
    compliant: number;
    flagged: number;
    report: ComplianceReport[];
  }>;
  
  private async getViewingKeyForRole(role: string): Promise<ViewingKeyRecord>;
}
```

### Viewing Key Manager Interface

```typescript
export class ViewingKeyManager {
  constructor(
    private sipherClient: SipherClient,
    private database: Database,
    private encryption: EncryptionService
  );
  
  async generateMaster(path: string): Promise<ViewingKeyRecord>;
  async derive(parentId: number, childPath: string): Promise<ViewingKeyRecord>;
  async verifyHierarchy(parentId: number, childId: number): Promise<boolean>;
  
  async getById(id: number): Promise<ViewingKeyRecord | null>;
  async getByHash(hash: string): Promise<ViewingKeyRecord | null>;
  async getByRole(role: string): Promise<ViewingKeyRecord | null>;
  
  async rotate(keyId: number): Promise<ViewingKeyRecord>;
  async revoke(keyId: number): Promise<void>;
  
  private async encryptKey(key: string): Promise<string>;
  private async decryptKey(encrypted: string): Promise<string>;
}
```

### Disclosure Service Interface

```typescript
export class DisclosureService {
  constructor(
    private sipherClient: SipherClient,
    private database: Database
  );
  
  async encrypt(transactionData: any, viewingKey: ViewingKey, auditorPublicKey: string): Promise<{
    encrypted: string;
    keyHash: string;
    expiresAt: Date;
  }>;
  
  async decrypt(encrypted: string, viewingKey: ViewingKey): Promise<{
    sender: string;
    recipient: string;
    amount: string;
    timestamp: number;
  }>;
  
  async listDisclosures(auditorId: string): Promise<DisclosureRecord[]>;
  async revokeDisclosure(disclosureId: number): Promise<void>;
  
  private async validateExpiration(expiresAt: Date): Promise<boolean>;
  private async logDisclosureEvent(event: any): Promise<void>;
}
```


## Data Models

### Database Schema

```sql
-- Stealth Addresses
CREATE TABLE stealth_addresses (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  meta_address JSONB NOT NULL,
  encrypted_spending_key TEXT NOT NULL,  -- AES-256 encrypted
  encrypted_viewing_key TEXT NOT NULL,   -- AES-256 encrypted
  label VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_stealth_agent (agent_id),
  INDEX idx_stealth_created (created_at DESC)
);

-- Shielded Transactions
CREATE TABLE shielded_transactions (
  id SERIAL PRIMARY KEY,
  tx_signature VARCHAR(255) UNIQUE NOT NULL,
  sender VARCHAR(255) NOT NULL,
  stealth_address VARCHAR(255) NOT NULL,
  ephemeral_public_key VARCHAR(255) NOT NULL,
  commitment TEXT NOT NULL,
  amount_encrypted TEXT NOT NULL,
  viewing_key_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',  -- pending, confirmed, claimed, failed
  created_at TIMESTAMP DEFAULT NOW(),
  claimed_at TIMESTAMP,
  
  INDEX idx_shielded_sender (sender),
  INDEX idx_shielded_stealth (stealth_address),
  INDEX idx_shielded_status (status),
  INDEX idx_shielded_created (created_at DESC)
);

-- Viewing Keys
CREATE TABLE viewing_keys (
  id SERIAL PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  encrypted_key TEXT NOT NULL,           -- AES-256 encrypted
  path VARCHAR(255) NOT NULL,            -- BIP32 path (e.g., m/0/org/2026/Q1)
  parent_hash VARCHAR(255),
  role VARCHAR(50),                      -- internal, external, regulator, master
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  
  INDEX idx_viewing_hash (key_hash),
  INDEX idx_viewing_role (role),
  INDEX idx_viewing_expires (expires_at),
  FOREIGN KEY (parent_hash) REFERENCES viewing_keys(key_hash)
);

-- Privacy Scores
CREATE TABLE privacy_scores (
  id SERIAL PRIMARY KEY,
  address VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL,                -- 0-100
  grade VARCHAR(2) NOT NULL,             -- A, B, C, D, F
  factors JSONB NOT NULL,                -- Array of privacy-reducing factors
  recommendations JSONB,                 -- Array of improvement suggestions
  analyzed_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_privacy_address (address),
  INDEX idx_privacy_score (score),
  INDEX idx_privacy_analyzed (analyzed_at DESC)
);

-- Commitments
CREATE TABLE commitments (
  id SERIAL PRIMARY KEY,
  commitment TEXT NOT NULL,
  encrypted_blinding_factor TEXT NOT NULL,  -- AES-256 encrypted
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  
  INDEX idx_commitment_created (created_at DESC)
);

-- Disclosures
CREATE TABLE disclosures (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  auditor_id VARCHAR(255) NOT NULL,
  viewing_key_hash VARCHAR(255) NOT NULL,
  encrypted_data TEXT NOT NULL,
  disclosed_fields JSONB NOT NULL,       -- Array of field names
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  
  INDEX idx_disclosure_auditor (auditor_id),
  INDEX idx_disclosure_expires (expires_at),
  INDEX idx_disclosure_created (created_at DESC),
  FOREIGN KEY (transaction_id) REFERENCES shielded_transactions(id),
  FOREIGN KEY (viewing_key_hash) REFERENCES viewing_keys(key_hash)
);

-- MEV Metrics
CREATE TABLE mev_metrics (
  id SERIAL PRIMARY KEY,
  vault_id VARCHAR(255) NOT NULL,
  tx_signature VARCHAR(255) NOT NULL,
  mev_extracted NUMERIC(20, 6) NOT NULL,  -- USD value
  privacy_score INTEGER NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_mev_vault (vault_id),
  INDEX idx_mev_timestamp (timestamp DESC)
);

-- Payment Scan State
CREATE TABLE payment_scan_state (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  last_scanned_slot BIGINT NOT NULL,
  last_scan_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_scan_agent (agent_id)
);
```

### TypeScript Type Definitions

```typescript
// Stealth Address Types
export type StealthAddressStatus = 'active' | 'used' | 'expired';

export interface StealthAddressDB {
  id: number;
  agent_id: string;
  meta_address: {
    spendingPublicKey: string;
    viewingPublicKey: string;
  };
  encrypted_spending_key: string;
  encrypted_viewing_key: string;
  label: string;
  created_at: Date;
}

// Shielded Transaction Types
export type ShieldedTransactionStatus = 'pending' | 'confirmed' | 'claimed' | 'failed';

export interface ShieldedTransactionDB {
  id: number;
  tx_signature: string;
  sender: string;
  stealth_address: string;
  ephemeral_public_key: string;
  commitment: string;
  amount_encrypted: string;
  viewing_key_hash?: string;
  status: ShieldedTransactionStatus;
  created_at: Date;
  claimed_at?: Date;
}

// Viewing Key Types
export type ViewingKeyRole = 'internal' | 'external' | 'regulator' | 'master';

export interface ViewingKeyDB {
  id: number;
  key_hash: string;
  encrypted_key: string;
  path: string;
  parent_hash?: string;
  role: ViewingKeyRole;
  expires_at?: Date;
  created_at: Date;
  revoked_at?: Date;
}

// Privacy Score Types
export type PrivacyGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface PrivacyScoreDB {
  id: number;
  address: string;
  score: number;
  grade: PrivacyGrade;
  factors: string[];
  recommendations?: string[];
  analyzed_at: Date;
}

// Commitment Types
export interface CommitmentDB {
  id: number;
  commitment: string;
  encrypted_blinding_factor: string;
  value: string;
  created_at: Date;
  verified_at?: Date;
}

// Disclosure Types
export interface DisclosureDB {
  id: number;
  transaction_id: number;
  auditor_id: string;
  viewing_key_hash: string;
  encrypted_data: string;
  disclosed_fields: string[];
  expires_at: Date;
  created_at: Date;
  revoked_at?: Date;
}

// MEV Metrics Types
export interface MEVMetricsDB {
  id: number;
  vault_id: string;
  tx_signature: string;
  mev_extracted: number;
  privacy_score: number;
  timestamp: Date;
}

// Payment Scan State Types
export interface PaymentScanStateDB {
  id: number;
  agent_id: string;
  last_scanned_slot: number;
  last_scan_at: Date;
}
```

### Environment Configuration

```bash
# Sipher API Configuration
SIPHER_API_URL=https://sipher.sip-protocol.org
SIPHER_API_KEY=your_api_key_here
SIPHER_ENABLED=true
SIPHER_TIMEOUT=30000

# Privacy Features
PRIVACY_ENABLED=true
MEV_PROTECTION_ENABLED=true
COMPLIANCE_MODE=selective  # none, selective, full

# Privacy Thresholds
PRIVACY_SCORE_THRESHOLD=70
MEV_REDUCTION_TARGET=80

# Key Management
KEY_ROTATION_DAYS=90
VIEWING_KEY_EXPIRATION_DAYS=30
MASTER_KEY_MULTISIG_THRESHOLD=3

# Scanning Configuration
PAYMENT_SCAN_INTERVAL_SECONDS=60
PAYMENT_SCAN_BATCH_SIZE=100
PAYMENT_SCAN_RETRY_ATTEMPTS=3

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ars
REDIS_URL=redis://localhost:6379

# Encryption
ENCRYPTION_ALGORITHM=aes-256-gcm
ENCRYPTION_KEY_DERIVATION=pbkdf2
ENCRYPTION_ITERATIONS=100000
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system - essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Homomorphic Commitment Addition

*For any* two Pedersen commitments C(a) and C(b) with their respective blinding factors, adding the commitments homomorphically SHALL produce a commitment C(a+b) that verifies correctly with the sum of the original values and the sum of the blinding factors.

**Validates: Requirements 7.3, 7.5**

**Rationale**: This property is critical for MEV protection. It ensures that multiple swap amounts can be combined without revealing individual values, enabling complex multi-hop rebalancing while maintaining privacy.

### Property 2: Encryption Key Derivation Consistency

*For any* agent with a given public key, encrypting and then decrypting a private key (spending or viewing) using that agent's public key as the key derivation input SHALL produce the original private key value.

**Validates: Requirements 1.3, 1.4, 12.5**

**Rationale**: This property ensures that encrypted keys can be reliably recovered when needed, while maintaining security through agent-specific encryption.

### Property 3: Privacy Score Threshold Enforcement

*For any* vault with a privacy score below 70, the system SHALL flag the vault for enhanced MEV protection and SHALL NOT execute unprotected swaps.

**Validates: Requirements 9.3**

**Rationale**: This property ensures that vaults with degraded privacy automatically receive enhanced protection, preventing MEV attacks on vulnerable vaults.

### Property 4: Stealth Address Unlinkability

*For any* two shielded transfers to the same meta-address, the derived stealth addresses SHALL be cryptographically unlinkable (no common on-chain identifiers).

**Validates: Requirements 1.1, 2.1**

**Rationale**: This property is fundamental to transaction privacy. It ensures that multiple payments to the same recipient cannot be linked through on-chain analysis.

### Property 5: Role-Based Viewing Key Access

*For any* auditor with role R (internal/external/regulator/master), the system SHALL provide a viewing key at the appropriate hierarchy level (quarterly/yearly/organizational/master) and SHALL NOT provide keys at higher privilege levels.

**Validates: Requirements 16.2, 16.3, 16.4, 16.5**

**Rationale**: This property ensures that auditors can only access transaction data appropriate to their role, maintaining privacy while enabling compliance.

### Property 6: Viewing Key Hierarchy Verification

*For any* parent viewing key P and child viewing key C, if C was derived from P using BIP32-style derivation, then verifying the hierarchy SHALL return true, and C SHALL be able to decrypt all transactions that P can decrypt within C's scope.

**Validates: Requirements 12.2, 13.2, 13.5**

**Rationale**: This property ensures the integrity of the hierarchical viewing key system, preventing unauthorized key relationships and ensuring proper inheritance of decryption capabilities.

### Property 7: Disclosure Expiration Enforcement

*For any* disclosure with expiration timestamp T, attempting to decrypt the disclosed data after time T SHALL fail with an expiration error, regardless of the validity of the viewing key.

**Validates: Requirements 14.4, 15.4**

**Rationale**: This property ensures that disclosed transaction data has a limited lifetime, reducing the risk of long-term privacy breaches.

### Property 8: MEV Extraction Reduction

*For any* vault executing protected swaps with privacy score > 70, the measured MEV extraction SHALL be at least 80% lower than the baseline MEV extraction for equivalent unprotected swaps.

**Validates: Requirements 10.5**

**Rationale**: This property validates the effectiveness of the MEV protection system, ensuring that privacy features actually reduce extractable value.

### Property 9: Payment Scanning Completeness

*For any* agent with viewing private key V and spending public key S, scanning from slot N to slot M SHALL detect all shielded payments sent to stealth addresses derivable from the agent's meta-address within that slot range.

**Validates: Requirements 3.1, 3.2, 3.3**

**Rationale**: This property ensures that agents never miss incoming payments, which is critical for reliable operation of the shielded transfer system.

### Property 10: Idempotency Safety

*For any* shielded transfer or claim operation with idempotency key K, executing the operation multiple times with the same key K SHALL produce the same result and SHALL NOT create duplicate transactions.

**Validates: Requirements 2.2, 4.3**

**Rationale**: This property ensures that network failures and retries do not result in duplicate transfers or claims, protecting against accidental double-spending.

### Property 11: Commitment Verification Correctness

*For any* Pedersen commitment C created with value V and blinding factor B, verifying C with the correct V and B SHALL return true, and verifying C with any incorrect value V' ≠ V or incorrect blinding factor B' ≠ B SHALL return false.

**Validates: Requirements 8.1, 8.2**

**Rationale**: This property ensures that commitments cannot be opened to incorrect values, which is fundamental to the security of hidden amounts.

### Property 12: Batch Operation Atomicity

*For any* batch operation (stealth generation, commitment creation) with N items, either all N items SHALL succeed and be stored, or all N items SHALL fail and nothing SHALL be stored (no partial success).

**Validates: Requirements 11.5**

**Rationale**: This property ensures that batch operations maintain database consistency, preventing orphaned or incomplete records.

### Property 13: Spending Key Privacy

*For any* disclosed transaction data decrypted with a viewing key, the decrypted output SHALL NOT contain the spending private key, viewing private key, or blinding factor.

**Validates: Requirements 15.3**

**Rationale**: This property ensures that viewing keys enable transaction visibility without granting spending power, which is critical for safe compliance disclosure.

### Property 14: Transaction Status Transitions

*For any* shielded transaction, the status SHALL transition in the order: pending → confirmed → claimed, and SHALL NOT transition backwards or skip states.

**Validates: Requirements 5.4**

**Rationale**: This property ensures that transaction lifecycle is properly tracked and that status updates are consistent with actual blockchain state.

### Property 15: Multi-Sig Master Key Protection

*For any* request for the master viewing key (m/0), the system SHALL require M-of-N multi-signature approval where M ≥ 3, and SHALL NOT provide the key without sufficient signatures.

**Validates: Requirements 16.5**

**Rationale**: This property ensures that the most powerful viewing key (which can decrypt all transactions) is protected by multi-party approval, preventing single-point-of-failure security breaches.


## Error Handling

### Sipher API Errors

**Error Categories**:
1. **Authentication Errors** (401): Invalid or missing API key
2. **Rate Limiting Errors** (429): Too many requests
3. **Validation Errors** (400): Invalid request parameters
4. **Server Errors** (500): Sipher API internal errors
5. **Timeout Errors**: Request exceeded timeout threshold

**Handling Strategy**:
```typescript
export class SipherErrorHandler {
  async handleError(error: SipherAPIError): Promise<void> {
    switch (error.statusCode) {
      case 401:
        // Authentication error - log and alert
        logger.error('Sipher API authentication failed', { error });
        await this.alertOps('Sipher API key invalid or expired');
        throw new AuthenticationError('Invalid Sipher API credentials');
        
      case 429:
        // Rate limiting - exponential backoff
        const retryAfter = error.headers['retry-after'] || 60;
        logger.warn('Sipher API rate limit hit', { retryAfter });
        await this.sleep(retryAfter * 1000);
        throw new RateLimitError('Sipher API rate limit exceeded', retryAfter);
        
      case 400:
        // Validation error - log and return descriptive error
        logger.error('Sipher API validation error', { error, params: error.requestParams });
        throw new ValidationError(error.message, error.details);
        
      case 500:
      case 502:
      case 503:
        // Server error - retry with exponential backoff
        logger.error('Sipher API server error', { error });
        throw new ServerError('Sipher API temporarily unavailable');
        
      default:
        // Unknown error - log and throw
        logger.error('Unknown Sipher API error', { error });
        throw new UnknownError('Unexpected Sipher API error');
    }
  }
  
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn('Retrying operation', { attempt, delay });
        await this.sleep(delay);
      }
    }
    throw new Error('Max retries exceeded');
  }
  
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private async alertOps(message: string): Promise<void> {
    // Send alert to operations team (Slack, PagerDuty, etc.)
  }
}
```

### Encryption Errors

**Error Scenarios**:
1. **Key Derivation Failure**: Unable to derive encryption key from agent public key
2. **Encryption Failure**: AES-256 encryption operation fails
3. **Decryption Failure**: Unable to decrypt stored keys (corrupted data or wrong key)
4. **Key Rotation Failure**: Error during quarterly key rotation

**Handling Strategy**:
- Log all encryption errors with context (agent ID, operation type)
- Never expose plaintext keys in error messages or logs
- Implement key recovery mechanism for critical failures
- Alert security team for repeated decryption failures (potential attack)

### Database Errors

**Error Scenarios**:
1. **Connection Failure**: Unable to connect to PostgreSQL
2. **Transaction Rollback**: Database transaction fails mid-operation
3. **Constraint Violation**: Unique constraint or foreign key violation
4. **Query Timeout**: Long-running query exceeds timeout

**Handling Strategy**:
```typescript
export class DatabaseErrorHandler {
  async handleError(error: DatabaseError): Promise<void> {
    if (error.code === 'CONNECTION_FAILED') {
      logger.error('Database connection failed', { error });
      await this.reconnect();
    } else if (error.code === 'UNIQUE_VIOLATION') {
      logger.warn('Duplicate record detected', { error });
      throw new DuplicateRecordError(error.message);
    } else if (error.code === 'FOREIGN_KEY_VIOLATION') {
      logger.error('Foreign key constraint violated', { error });
      throw new InvalidReferenceError(error.message);
    } else if (error.code === 'QUERY_TIMEOUT') {
      logger.warn('Query timeout', { error, query: error.query });
      throw new TimeoutError('Database query exceeded timeout');
    } else {
      logger.error('Unknown database error', { error });
      throw new DatabaseError(error.message);
    }
  }
  
  async withTransaction<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = await this.database.beginTransaction();
    try {
      const result = await operation(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      logger.error('Transaction rolled back', { error });
      throw error;
    }
  }
  
  private async reconnect(): Promise<void> {
    // Implement connection pool reconnection logic
  }
}
```

### Privacy Errors

**Error Scenarios**:
1. **Privacy Score Too Low**: Vault privacy score below threshold
2. **Stealth Address Derivation Failure**: Unable to derive stealth address
3. **Commitment Verification Failure**: Commitment does not verify correctly
4. **Viewing Key Expired**: Attempted to use expired viewing key
5. **Unauthorized Disclosure**: Attempted disclosure without proper authorization

**Handling Strategy**:
- Reject operations that would compromise privacy
- Provide clear error messages explaining privacy requirements
- Log all privacy-related errors for security analysis
- Alert security team for repeated unauthorized access attempts

### MEV Protection Errors

**Error Scenarios**:
1. **Insufficient Privacy**: Cannot execute swap with current privacy score
2. **Commitment Creation Failure**: Unable to create Pedersen commitment
3. **Stealth Generation Failure**: Batch stealth generation fails
4. **Claim Failure**: Unable to claim funds from stealth address

**Handling Strategy**:
```typescript
export class MEVProtectionErrorHandler {
  async handleSwapError(error: MEVProtectionError): Promise<void> {
    if (error.type === 'INSUFFICIENT_PRIVACY') {
      logger.warn('Swap rejected due to low privacy score', {
        vaultId: error.vaultId,
        score: error.privacyScore,
        threshold: 70
      });
      
      // Attempt to improve privacy before retrying
      await this.improveVaultPrivacy(error.vaultId);
      throw new InsufficientPrivacyError('Vault privacy score too low for protected swap');
      
    } else if (error.type === 'COMMITMENT_FAILURE') {
      logger.error('Commitment creation failed', { error });
      throw new CommitmentError('Unable to create Pedersen commitment');
      
    } else if (error.type === 'CLAIM_FAILURE') {
      logger.error('Stealth claim failed', { error });
      // Preserve payment record for manual recovery
      await this.markForManualRecovery(error.stealthAddress);
      throw new ClaimError('Unable to claim funds from stealth address');
    }
  }
  
  private async improveVaultPrivacy(vaultId: string): Promise<void> {
    // Implement privacy improvement strategies
    // - Generate new stealth addresses
    // - Consolidate small UTXOs
    // - Add noise transactions
  }
  
  private async markForManualRecovery(stealthAddress: string): Promise<void> {
    // Mark payment for manual recovery by operations team
  }
}
```

### Compliance Errors

**Error Scenarios**:
1. **Invalid Viewing Key**: Viewing key does not match expected format
2. **Hierarchy Verification Failure**: Child key not derived from parent
3. **Disclosure Expired**: Attempted to decrypt expired disclosure
4. **Insufficient Authorization**: Auditor lacks required role for disclosure level
5. **Multi-Sig Threshold Not Met**: Master key request without sufficient signatures

**Handling Strategy**:
- Strict validation of all viewing keys and disclosure requests
- Log all compliance-related errors for audit trail
- Reject unauthorized access attempts immediately
- Alert compliance team for suspicious activity patterns

## Testing Strategy

### Unit Tests

**Coverage Areas**:
1. **Sipher API Client**: Mock API responses, test error handling, verify request parameters
2. **Encryption Service**: Test AES-256 encryption/decryption, key derivation
3. **Stealth Address Manager**: Test generation, storage, retrieval
4. **Commitment Manager**: Test creation, verification, homomorphic addition
5. **Viewing Key Manager**: Test generation, derivation, hierarchy verification
6. **Compliance Service**: Test role-based access, disclosure, expiration

**Example Unit Test**:
```typescript
describe('CommitmentManager', () => {
  it('should create valid Pedersen commitment', async () => {
    const manager = new CommitmentManager(mockSipherClient, mockDb, mockEncryption);
    const value = '1000000'; // 1 ARU
    
    const commitment = await manager.create(value);
    
    expect(commitment.commitment).toBeDefined();
    expect(commitment.encryptedBlindingFactor).toBeDefined();
    expect(commitment.value).toBe(value);
    
    // Verify commitment
    const valid = await manager.verify(commitment.id, value);
    expect(valid).toBe(true);
  });
  
  it('should reject verification with incorrect value', async () => {
    const manager = new CommitmentManager(mockSipherClient, mockDb, mockEncryption);
    const value = '1000000';
    
    const commitment = await manager.create(value);
    
    // Attempt verification with wrong value
    const valid = await manager.verify(commitment.id, '2000000');
    expect(valid).toBe(false);
  });
});
```

### Property-Based Tests

**Property Test Configuration**:
- Minimum 100 iterations per property test
- Use fast-check library for TypeScript
- Tag each test with feature name and property number
- Run property tests in CI/CD pipeline

**Property Test Examples**:

**Property 1: Homomorphic Commitment Addition**
```typescript
import fc from 'fast-check';

describe('Property 1: Homomorphic Commitment Addition', () => {
  it('should satisfy C(a) + C(b) = C(a+b)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000000 }), // value a
        fc.integer({ min: 1, max: 1000000 }), // value b
        async (a, b) => {
          const manager = new CommitmentManager(sipherClient, db, encryption);
          
          // Create commitments for a and b
          const commitmentA = await manager.create(a.toString());
          const commitmentB = await manager.create(b.toString());
          
          // Add commitments homomorphically
          const commitmentSum = await manager.add(commitmentA.id, commitmentB.id);
          
          // Verify sum commitment opens to a + b
          const valid = await manager.verify(commitmentSum.id, (a + b).toString());
          expect(valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sipher-privacy-integration, Property 1: Homomorphic Commitment Addition
```

**Property 4: Stealth Address Unlinkability**
```typescript
describe('Property 4: Stealth Address Unlinkability', () => {
  it('should generate unlinkable stealth addresses for same meta-address', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 50 }), // agent label
        fc.integer({ min: 2, max: 10 }), // number of transfers
        async (label, numTransfers) => {
          const manager = new StealthAddressManager(sipherClient, db, encryption);
          
          // Generate meta-address
          const metaAddress = await manager.generateForAgent('agent-1', label);
          
          // Derive multiple stealth addresses
          const stealthAddresses = [];
          for (let i = 0; i < numTransfers; i++) {
            const stealth = await manager.deriveStealthAddress(metaAddress.id);
            stealthAddresses.push(stealth.address);
          }
          
          // Verify all addresses are unique (unlinkable)
          const uniqueAddresses = new Set(stealthAddresses);
          expect(uniqueAddresses.size).toBe(numTransfers);
          
          // Verify no common on-chain identifiers
          for (let i = 0; i < stealthAddresses.length; i++) {
            for (let j = i + 1; j < stealthAddresses.length; j++) {
              expect(stealthAddresses[i]).not.toBe(stealthAddresses[j]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sipher-privacy-integration, Property 4: Stealth Address Unlinkability
```

**Property 5: Role-Based Viewing Key Access**
```typescript
describe('Property 5: Role-Based Viewing Key Access', () => {
  it('should provide appropriate viewing key for each role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('internal', 'external', 'regulator'),
        async (role) => {
          const compliance = new ComplianceService(sipherClient, viewingKeyManager, db, amlService);
          
          // Setup hierarchy
          const hierarchy = await compliance.setupHierarchy();
          
          // Get viewing key for role
          const viewingKey = await compliance['getViewingKeyForRole'](role);
          
          // Verify correct level
          if (role === 'internal') {
            expect(viewingKey.path).toContain('/Q1');
            expect(viewingKey.role).toBe('internal');
          } else if (role === 'external') {
            expect(viewingKey.path).toMatch(/\/\d{4}$/); // ends with year
            expect(viewingKey.role).toBe('external');
          } else if (role === 'regulator') {
            expect(viewingKey.path).toContain('/org');
            expect(viewingKey.path).not.toContain('/2026');
            expect(viewingKey.role).toBe('regulator');
          }
          
          // Verify cannot access higher privilege levels
          // (internal cannot access yearly, external cannot access organizational, etc.)
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sipher-privacy-integration, Property 5: Role-Based Viewing Key Access
```

### Integration Tests

**Test Scenarios**:
1. **End-to-End Shielded Transfer**: Generate meta-address → build transfer → scan payment → claim
2. **MEV-Protected Rebalancing**: Analyze privacy → create commitments → execute swap → claim outputs
3. **Compliance Workflow**: Setup hierarchy → disclose transaction → decrypt with viewing key → generate report
4. **Batch Operations**: Batch generate stealth addresses → verify all stored → verify atomicity
5. **Error Recovery**: Simulate API failures → verify retry logic → verify data consistency

**Example Integration Test**:
```typescript
describe('End-to-End Shielded Transfer', () => {
  it('should complete full shielded transfer workflow', async () => {
    // Setup
    const sender = await createTestAgent('sender');
    const recipient = await createTestAgent('recipient');
    
    // Generate recipient meta-address
    const recipientMeta = await stealthManager.generateForAgent(recipient.id, 'test-meta');
    
    // Build shielded transfer
    const transfer = await transferBuilder.buildTransfer({
      senderId: sender.id,
      recipientMetaAddressId: recipientMeta.id,
      amount: '1000000', // 1 ARU
      mint: ARU_MINT
    });
    
    // Submit transfer
    const txSignature = await transferBuilder.submitTransfer(transfer.transaction, transfer.record);
    expect(txSignature).toBeDefined();
    
    // Wait for confirmation
    await waitForConfirmation(txSignature);
    
    // Scan for payment
    const payments = await paymentScanner.scanForAgent(recipient.id);
    expect(payments.length).toBe(1);
    expect(payments[0].stealthAddress).toBe(transfer.record.stealthAddress);
    
    // Claim payment
    const claimTx = await claimPayment(recipient.id, payments[0]);
    expect(claimTx).toBeDefined();
    
    // Verify recipient balance increased
    const balance = await getBalance(recipient.wallet);
    expect(balance).toBeGreaterThanOrEqual(1000000);
  });
});
```

### Performance Tests

**Metrics to Track**:
1. **Stealth Address Generation**: <100ms per address
2. **Shielded Transfer Building**: <200ms per transfer
3. **Payment Scanning**: <500ms for 100 transactions
4. **Commitment Operations**: <50ms per operation
5. **Total Private Transaction Overhead**: <1 second

**Load Testing**:
- Simulate 1000 concurrent agents
- Generate 10,000 shielded transfers per day
- Measure API response times under load
- Verify database performance with large datasets

### Security Tests

**Test Areas**:
1. **Encryption Strength**: Verify AES-256 encryption cannot be broken
2. **Key Derivation**: Test key derivation with various inputs
3. **Stealth Address Security**: Verify unlinkability with blockchain analysis tools
4. **Commitment Security**: Test commitment hiding and binding properties
5. **Viewing Key Security**: Verify viewing keys don't reveal spending power
6. **Multi-Sig Security**: Test multi-sig threshold enforcement

**Penetration Testing**:
- Attempt to link stealth addresses
- Attempt to decrypt commitments without blinding factors
- Attempt to access higher privilege viewing keys
- Attempt to bypass multi-sig requirements
- Attempt to decrypt expired disclosures

### Compliance Tests

**Test Scenarios**:
1. **Audit Trail**: Verify all disclosure events are logged
2. **Expiration Enforcement**: Verify expired disclosures cannot be decrypted
3. **Role Enforcement**: Verify auditors cannot access higher privilege levels
4. **AML/CFT Checks**: Verify compliance checks run on all disclosed transactions
5. **Report Generation**: Verify reports contain required information

