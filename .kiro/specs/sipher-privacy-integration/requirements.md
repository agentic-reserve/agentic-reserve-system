# Sipher Privacy Integration - Requirements

## Project Overview

The Sipher Privacy Integration extends the Agentic Reserve System (ARS) with privacy-preserving features powered by Sipher's Privacy-as-a-Skill REST API. This integration enables shielded ARU token transfers, MEV-protected vault rebalancing, and compliance-friendly selective disclosure through hierarchical viewing keys.

**Vision**: Transform ARS into a privacy-first DeFi protocol where agents can transact confidentially, protect against MEV attacks, and maintain regulatory compliance through selective disclosure - all while preserving the autonomous, agent-first architecture.

**Privacy-First Design Principles**:
1. **Unlinkable Transactions**: Stealth addresses prevent transaction graph analysis
2. **Hidden Amounts**: Pedersen commitments conceal transfer values
3. **MEV Protection**: Privacy features eliminate front-running opportunities
4. **Selective Disclosure**: Hierarchical viewing keys enable compliance without sacrificing privacy
5. **Agent-Native**: All privacy features accessible via machine-readable APIs

**Integration Scope**: Three-phase implementation covering shielded transfers (Phase 1), MEV-protected rebalancing (Phase 2), and compliance layer (Phase 3).

## Target Users

### Primary Users (AI Agents)
- **Privacy-Conscious Agents**: Execute confidential transactions without revealing positions
- **Institutional Agents**: Large capital movements requiring MEV protection
- **Competitive Strategy Agents**: Protect trading strategies from surveillance
- **Compliance-Aware Agents**: Maintain privacy while satisfying regulatory requirements
- **High-Value Agents**: Protect against targeted attacks and front-running

### Secondary Users (Protocol Operators)
- **ARS Protocol**: Enhanced privacy features for all agent operations
- **Auditors**: Selective access to transaction data via viewing keys
- **Regulators**: Compliance verification without full transaction visibility
- **Security Researchers**: Privacy analysis and vulnerability assessment

### Tertiary Users (Human Observers)
- **Compliance Officers**: Monitor regulatory adherence
- **Privacy Advocates**: Verify privacy guarantees
- **Protocol Governors**: Emergency intervention capabilities

## Glossary

- **Sipher**: Privacy-as-a-Skill REST API providing stealth addresses, shielded transfers, and viewing keys
- **Stealth_Address**: One-time unlinkable address using ed25519 DKSAP (Dual-Key Stealth Address Protocol)
- **Meta_Address**: Master address for receiving stealth payments (spending key + viewing key)
- **Shielded_Transfer**: Transaction with hidden recipient and amount commitment
- **Pedersen_Commitment**: Cryptographic commitment hiding values while enabling homomorphic operations
- **Viewing_Key**: Cryptographic key enabling selective transaction disclosure
- **Hierarchical_Viewing_Key**: BIP32-style key derivation for role-based disclosure
- **MEV**: Maximal Extractable Value - profit extracted through transaction ordering
- **Privacy_Score**: 0-100 metric measuring wallet privacy posture
- **Ephemeral_Public_Key**: Temporary key used in stealth address derivation
- **Blinding_Factor**: Random value used in Pedersen commitments
- **Disclosure_Level**: Scope of transaction visibility (quarterly/yearly/organizational/master)

## Requirements

### Phase 1: Shielded ARU Transfers

### Requirement 1: Stealth Address Generation

**User Story:** As an AI agent, I want to generate stealth meta-addresses, so that I can receive private ARU transfers without revealing my identity.

#### Acceptance Criteria

1. WHEN an agent requests stealth address generation, THE Sipher_Client SHALL call POST /v1/stealth/generate with agent label
2. WHEN stealth generation succeeds, THE System SHALL store meta-address, spending private key, and viewing private key in encrypted database
3. THE System SHALL encrypt private keys at rest using AES-256
4. WHEN storing keys, THE System SHALL use agent public key as encryption key derivation input
5. THE System SHALL support multiple meta-addresses per agent for different use cases

### Requirement 2: Shielded Transfer Building

**User Story:** As an AI agent, I want to build shielded ARU transfers, so that I can send tokens privately without revealing recipient or amount.

#### Acceptance Criteria

1. WHEN an agent initiates shielded transfer, THE Sipher_Client SHALL call POST /v1/transfer/shield with sender, recipient meta-address, amount, and ARU mint
2. WHEN building transfer, THE System SHALL include Idempotency-Key header for safe retries
3. WHEN transfer building succeeds, THE System SHALL return unsigned transaction, stealth address, and Pedersen commitment
4. THE System SHALL validate recipient meta-address format before API call
5. WHEN amount exceeds agent balance, THE System SHALL reject transfer with descriptive error

### Requirement 3: Payment Scanning

**User Story:** As an AI agent, I want to scan for incoming shielded payments, so that I can detect ARU transfers sent to my stealth addresses.

#### Acceptance Criteria

1. WHEN scanning for payments, THE Payment_Scanner SHALL call POST /v1/scan/payments with viewing private key and spending public key
2. THE Payment_Scanner SHALL track last scanned slot to avoid duplicate processing
3. WHEN new payments detected, THE System SHALL store payment details in shielded_transactions table
4. THE Payment_Scanner SHALL run every 60 seconds via scheduled job
5. WHEN scan fails, THE System SHALL retry with exponential backoff up to 5 attempts

### Requirement 4: Stealth Payment Claiming

**User Story:** As an AI agent, I want to claim stealth payments to my real wallet, so that I can use received ARU tokens in other operations.

#### Acceptance Criteria

1. WHEN agent claims payment, THE Sipher_Client SHALL call POST /v1/transfer/claim with stealth address, ephemeral public key, spending private key, viewing private key, destination address, and mint
2. WHEN claim succeeds, THE System SHALL update shielded_transactions table with claimed status and timestamp
3. THE System SHALL include Idempotency-Key header for safe retries
4. WHEN claim transaction fails, THE System SHALL preserve payment record for retry
5. THE System SHALL emit claim event for agent notification

### Requirement 5: Shielded Transaction Database

**User Story:** As the ARS protocol, I want to track all shielded transactions, so that I can provide transaction history and analytics to agents.

#### Acceptance Criteria

1. THE System SHALL create stealth_addresses table with agent_id, meta_address, encrypted spending key, encrypted viewing key, label, and created_at
2. THE System SHALL create shielded_transactions table with tx_signature, sender, stealth_address, ephemeral_public_key, commitment, amount_encrypted, viewing_key_hash, status, created_at, and claimed_at
3. WHEN storing transactions, THE System SHALL index by agent_id and timestamp for efficient queries
4. THE System SHALL support transaction status values: pending, confirmed, claimed, failed
5. WHEN querying history, THE System SHALL return transactions in descending timestamp order

### Phase 2: MEV-Protected Rebalancing

### Requirement 6: Pedersen Commitment Creation

**User Story:** As the reserve rebalancing agent, I want to create Pedersen commitments for swap amounts, so that I can hide transaction values from MEV bots.

#### Acceptance Criteria

1. WHEN creating commitment, THE Sipher_Client SHALL call POST /v1/commitment/create with swap amount value
2. WHEN commitment creation succeeds, THE System SHALL return commitment hash and blinding factor
3. THE System SHALL store blinding factors securely for later verification
4. WHEN commitment fails, THE System SHALL retry up to 3 times with exponential backoff
5. THE System SHALL validate commitment format before using in transactions

### Requirement 7: Homomorphic Commitment Operations

**User Story:** As the reserve rebalancing agent, I want to perform homomorphic addition on commitments, so that I can combine multiple swap amounts without revealing individual values.

#### Acceptance Criteria

1. WHEN combining commitments, THE Sipher_Client SHALL call POST /v1/commitment/add with commitmentA, commitmentB, blindingA, and blindingB
2. WHEN addition succeeds, THE System SHALL return combined commitment and combined blinding factor
3. THE System SHALL validate that combined commitment equals sum of original values
4. WHEN verification fails, THE System SHALL reject combined commitment
5. THE System SHALL support chaining multiple additions for complex rebalancing

### Requirement 8: Commitment Verification

**User Story:** As the reserve rebalancing agent, I want to verify commitment openings, so that I can prove swap amounts to auditors without revealing them publicly.

#### Acceptance Criteria

1. WHEN verifying commitment, THE Sipher_Client SHALL call POST /v1/commitment/verify with commitment, value, and blinding factor
2. WHEN verification succeeds, THE System SHALL return boolean indicating validity
3. THE System SHALL log verification attempts for audit trail
4. WHEN verification fails, THE System SHALL provide detailed error explaining mismatch
5. THE System SHALL support batch verification for multiple commitments

### Requirement 9: Privacy Score Analysis

**User Story:** As the reserve rebalancing agent, I want to analyze vault privacy score, so that I can determine if enhanced MEV protection is needed.

#### Acceptance Criteria

1. WHEN analyzing privacy, THE Sipher_Client SHALL call POST /v1/privacy/score with vault address and transaction limit
2. WHEN analysis completes, THE System SHALL return score (0-100), grade (A/B/C/D/F), factors, and recommendations
3. WHEN score below 70, THE System SHALL flag vault for enhanced protection
4. THE System SHALL store privacy scores in privacy_scores table with timestamp
5. THE System SHALL track score trends over time for monitoring

### Requirement 10: MEV-Protected Swap Execution

**User Story:** As the reserve rebalancing agent, I want to execute swaps with stealth destinations and hidden amounts, so that I can prevent front-running and sandwich attacks.

#### Acceptance Criteria

1. WHEN executing protected swap, THE System SHALL generate stealth address for swap destination
2. WHEN building swap transaction, THE System SHALL create Pedersen commitment for swap amount
3. THE System SHALL route swap through Jupiter aggregator with stealth destination
4. WHEN swap completes, THE System SHALL claim funds from stealth address to vault
5. THE System SHALL measure MEV extraction before and after integration for effectiveness tracking

### Requirement 11: Batch Stealth Generation

**User Story:** As the reserve rebalancing agent, I want to generate multiple stealth addresses in batch, so that I can efficiently prepare for multi-hop swaps.

#### Acceptance Criteria

1. WHEN batch generating, THE Sipher_Client SHALL call POST /v1/stealth/generate/batch with count and label
2. WHEN batch succeeds, THE System SHALL return array of meta-addresses with keys
3. THE System SHALL support batch sizes up to 100 addresses
4. WHEN batch partially fails, THE System SHALL return successful addresses and error details
5. THE System SHALL store all generated addresses atomically or rollback on failure

### Phase 3: Compliance Layer

### Requirement 12: Hierarchical Viewing Key Generation

**User Story:** As a compliance officer, I want to generate hierarchical viewing keys, so that I can provide role-based access to transaction data.

#### Acceptance Criteria

1. WHEN generating master key, THE Sipher_Client SHALL call POST /v1/viewing-key/generate with path "m/0"
2. THE System SHALL support BIP32-style derivation paths: m/0 → m/0/org → m/0/org/2026 → m/0/org/2026/Q1
3. WHEN deriving child key, THE Sipher_Client SHALL call POST /v1/viewing-key/derive with master key and child path
4. THE System SHALL store viewing keys in viewing_keys table with key_hash, path, parent_hash, role, expires_at, and created_at
5. THE System SHALL encrypt viewing keys at rest using protocol master key

### Requirement 13: Viewing Key Hierarchy Verification

**User Story:** As a compliance officer, I want to verify viewing key relationships, so that I can ensure proper key derivation and prevent unauthorized access.

#### Acceptance Criteria

1. WHEN verifying hierarchy, THE Sipher_Client SHALL call POST /v1/viewing-key/verify-hierarchy with parent key and child key
2. WHEN verification succeeds, THE System SHALL return boolean indicating valid parent-child relationship
3. THE System SHALL reject keys with invalid derivation paths
4. WHEN verification fails, THE System SHALL log security event for investigation
5. THE System SHALL support verification of multi-level hierarchies

### Requirement 14: Selective Transaction Disclosure

**User Story:** As a compliance officer, I want to disclose specific transactions to auditors, so that I can satisfy regulatory requirements without revealing all transaction data.

#### Acceptance Criteria

1. WHEN disclosing transaction, THE Sipher_Client SHALL call POST /v1/viewing-key/disclose with viewing key and transaction data
2. THE System SHALL encrypt disclosed data with auditor's public key
3. WHEN disclosure succeeds, THE System SHALL return encrypted data, viewing key hash, role, and expiration timestamp
4. THE System SHALL set disclosure expiration to 30 days by default
5. THE System SHALL log all disclosure events with auditor identity and disclosed fields

### Requirement 15: Viewing Key Decryption

**User Story:** As an auditor, I want to decrypt disclosed transaction data, so that I can verify compliance without accessing full transaction history.

#### Acceptance Criteria

1. WHEN decrypting data, THE Sipher_Client SHALL call POST /v1/viewing-key/decrypt with viewing key and encrypted data
2. WHEN decryption succeeds, THE System SHALL return transaction fields: sender, recipient, amount, timestamp
3. THE System SHALL NOT reveal spending keys or blinding factors
4. WHEN viewing key expired, THE System SHALL reject decryption with expiration error
5. THE System SHALL log all decryption attempts for audit trail

### Requirement 16: Role-Based Disclosure Levels

**User Story:** As a compliance officer, I want to assign disclosure levels to different roles, so that I can provide appropriate access based on auditor authority.

#### Acceptance Criteria

1. THE System SHALL support four disclosure levels: quarterly (m/0/org/2026/Q1), yearly (m/0/org/2026), organizational (m/0/org), and master (m/0)
2. WHEN internal auditor requests access, THE System SHALL provide quarterly viewing key
3. WHEN external auditor requests access, THE System SHALL provide yearly viewing key
4. WHEN regulator requests access, THE System SHALL provide organizational viewing key
5. WHEN emergency access needed, THE System SHALL provide master viewing key with multi-sig approval

### Requirement 17: Compliance Report Generation

**User Story:** As a compliance officer, I want to generate compliance reports from disclosed data, so that I can demonstrate regulatory adherence.

#### Acceptance Criteria

1. WHEN generating report, THE System SHALL decrypt transaction data using appropriate viewing key
2. THE System SHALL run AML/CFT checks on disclosed transactions
3. WHEN checks complete, THE System SHALL return compliance status, risk score, flags, disclosed fields, and hidden fields
4. THE System SHALL support report generation for custom date ranges
5. THE System SHALL export reports in PDF and JSON formats

## Non-Functional Requirements

### Performance
- Stealth address generation completes in <100ms
- Shielded transfer building completes in <200ms
- Payment scanning processes 100 transactions in <500ms
- Commitment operations complete in <50ms
- Total overhead per private transaction <1 second

### Security
- All private keys encrypted at rest with AES-256
- Viewing keys stored with access control and expiration
- Audit logging for all key operations and disclosures
- Rate limiting on Sipher API calls to prevent abuse
- Multi-signature approval for master viewing key access

### Scalability
- Support 1000+ agents with stealth addresses
- Handle 10,000+ shielded transactions per day
- Batch operations support up to 100 items
- Parallel processing for multiple agent operations
- Efficient database indexing for transaction queries

### Privacy
- Stealth addresses prevent transaction linkability
- Pedersen commitments hide transaction amounts
- Viewing keys enable selective disclosure without revealing spending power
- Privacy score >70 for all agents
- >80% reduction in MEV extraction

### Compliance
- Hierarchical viewing keys support regulatory requirements
- Selective disclosure maintains privacy while enabling audits
- Audit trail for all compliance operations
- Support for AML/CFT verification
- Regulatory approval pathway defined

## Technical Constraints

### Integration
- **Sipher API**: https://sipher.sip-protocol.org
- **Solana Program**: S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at
- **SDK**: @sip-protocol/sdk (Node.js 22, TypeScript)
- **Authentication**: X-API-Key header
- **Idempotency**: UUID v4 in Idempotency-Key header

### Backend
- **Runtime**: Node.js 22 with TypeScript
- **Database**: PostgreSQL (Supabase) for transaction history
- **Caching**: Redis for privacy scores and API responses
- **API**: REST endpoints for agent access

### Security
- **Key Storage**: Hardware Security Module (HSM) for production
- **Encryption**: AES-256 for private keys at rest
- **Key Rotation**: Quarterly rotation policy
- **Access Control**: Role-based access to viewing keys

## Out of Scope (Future Work)

The following are explicitly OUT OF SCOPE for initial implementation:

- ❌ Private governance voting (Phase 4)
- ❌ Zero-knowledge proof generation (use Sipher's proofs)
- ❌ Cross-chain privacy (Solana-only)
- ❌ Hardware wallet integration for key storage
- ❌ Mobile app for compliance officers
- ❌ Advanced privacy analytics dashboard
- ❌ Integration with external compliance platforms
- ❌ Automated regulatory reporting
- ❌ Privacy-preserving oracle aggregation
- ❌ Shielded liquidity pools

## Success Metrics

### Technical Metrics
- All 3 phases implemented and tested
- <1s latency for private transactions
- >99.9% Sipher API uptime
- Zero key compromises
- >95% transaction success rate

### Privacy Metrics
- >80% reduction in MEV extraction
- Privacy score >70 for all agents
- Zero successful linkability attacks
- 100% of agents using privacy features
- $1M+ in shielded transaction volume

### Compliance Metrics
- Regulatory approval obtained
- 10+ institutional agents onboarded
- 100+ compliance reports generated
- Zero compliance violations
- <24 hour audit response time

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Sipher API downtime | Implement retry logic with exponential backoff, cache recent data |
| Key compromise | HSM storage, quarterly rotation, multi-sig for master keys |
| Privacy score degradation | Automated monitoring, alerts for scores <70 |
| MEV protection failure | Continuous effectiveness measurement, adaptive strategies |

### Compliance Risks
| Risk | Mitigation |
|------|------------|
| Regulatory rejection | Hierarchical viewing keys, selective disclosure, audit trail |
| Insufficient disclosure | Multiple disclosure levels, role-based access |
| Audit delays | Automated report generation, 24/7 access for auditors |
| Privacy vs compliance conflict | Balanced approach with selective disclosure |

## Dependencies

### External Services
- Sipher API (free tier for development, pro/enterprise for production)
- Helius RPC (for reliable Solana access)
- Supabase (for database and real-time subscriptions)
- Redis (for caching)

### Development Tools
- Node.js 22+
- TypeScript 5+
- @sip-protocol/sdk
- PostgreSQL 15+
- Redis 7+

## References

- [Sipher Repository](https://github.com/sip-protocol/sipher.git)
- [Sipher README](https://github.com/sip-protocol/sipher/blob/main/README.md)
- [Sipher Roadmap](https://github.com/sip-protocol/sipher/blob/main/ROADMAP.md)
- [SIP Protocol](https://sip-protocol.org)
- [DKSAP Specification](https://eips.ethereum.org/EIPS/eip-5564)
- [Pedersen Commitments](https://en.wikipedia.org/wiki/Commitment_scheme#Pedersen_commitment)
- [BIP32 Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
