# AML/CFT Compliance Agent Skill
## Anti-Money Laundering & Counter-Terrorist Financing

**Agent Role**: AML/CFT Compliance Specialist  
**Version**: 1.0.0  
**Last Updated**: 2026-02-05

## Overview

The AML/CFT Compliance Agent monitors the Agentic Reserve System (ARS) for compliance with international anti-money laundering and counter-terrorist financing regulations. It implements behavior-based risk detection, exposure tracking, and comprehensive analytics based on FATF guidelines and regulatory requirements.

## Regulatory Framework

### Primary Regulations
- **FATF Recommendations**: Financial Action Task Force 40 Recommendations
- **OFAC Sanctions**: Office of Foreign Assets Control Specially Designated Nationals (SDN) List
- **FinCEN Requirements**: Financial Crimes Enforcement Network reporting obligations
- **EU AML Directives**: 5th and 6th Anti-Money Laundering Directives
- **Travel Rule**: FATF Recommendation 16 for virtual asset transfers

### Compliance Objectives
1. **Sanctions Screening**: Block transactions with sanctioned entities
2. **Transaction Monitoring**: Detect suspicious patterns and behaviors
3. **Risk Assessment**: Evaluate exposure to high-risk jurisdictions and entities
4. **Reporting**: Generate Suspicious Activity Reports (SARs) when required
5. **Record Keeping**: Maintain audit trails for regulatory examination

## Risk Engine Architecture

### 1. Behavior Risk Engine
Identifies suspicious transaction patterns in label-deficient environments using behavioral analysis.

#### Address Behavior Detection

**A. Large Transfer Detection**
- Flags addresses with transaction volumes significantly exceeding typical thresholds
- **Threshold**: Configurable (default: $100,000 per transaction)
- **Action**: Generate alert for manual review
- **Example**: Address sends $500,000 in single transaction → ALERT

**B. High-Frequency Transfer Detection**
- Identifies addresses with frequent transactions, especially structuring attempts
- **Pattern**: Multiple transactions just below reporting threshold
- **Threshold**: Configurable (default: 10+ transactions in 24 hours)
- **Action**: Flag for structuring investigation
- **Example**: 15 transfers of $9,999 in 24 hours → STRUCTURING ALERT

**C. Transit Address Detection**
- Detects addresses acting as intermediaries (layering tactic)
- **Pattern**: Rapid movement of funds through address
- **Threshold**: Configurable (default: funds moved within 30 minutes)
- **Action**: Flag as potential money laundering
- **Example**: Receives $20,000, sends $19,500 within 30 min → LAYERING ALERT

#### Transaction Behavior Detection

**A. Large Transaction Monitoring**
- Identifies transactions exceeding user-defined thresholds
- **Threshold**: Configurable per asset type
- **Action**: Enhanced due diligence required
- **Example**: $500,000 transfer exceeds $100,000 threshold → EDD REQUIRED

**B. Rapid Transit Detection**
- Detects funds quickly moved after receipt
- **Pattern**: Indicates potential evasion tactics
- **Threshold**: Configurable (default: 10 minutes)
- **Action**: Flag for investigation
- **Example**: Funds received and transferred within 5 minutes → RAPID TRANSIT ALERT

### 2. Exposure Risk Engine
Evaluates whether addresses/transactions are exposed to known risky entities using label database and on-chain interaction analysis.

#### Risk Indicators

| Risk Indicator | Description | Severity | Action |
|----------------|-------------|----------|--------|
| **Sanctioned** | OFAC SDN List entities | CRITICAL | Block immediately |
| **Terrorist Financing** | Linked to terrorist organizations | CRITICAL | Block + Report |
| **Human Trafficking** | Involved in human trafficking | CRITICAL | Block + Report |
| **Drug Trafficking** | Illegal drug production/distribution | CRITICAL | Block + Report |
| **Attack** | Exploit contracts, attackers | HIGH | Block + Investigate |
| **Scam** | Phishing, Ponzi, honeypot schemes | HIGH | Block + Alert |
| **Ransomware** | Ransomware operators | HIGH | Block + Report |
| **Child Abuse Material** | CSAM distribution platforms | CRITICAL | Block + Report |
| **Laundering** | Money laundering activities | HIGH | Enhanced monitoring |
| **Mixing** | Cryptocurrency mixers | MEDIUM | Enhanced monitoring |
| **Dark Market** | Darknet marketplaces | HIGH | Enhanced monitoring |
| **Darkweb Business** | Illicit darkweb commerce | HIGH | Enhanced monitoring |
| **Blocked** | Blacklisted by major contracts | MEDIUM | Review + Monitor |
| **Gambling** | Online gambling platforms | LOW | Monitor |
| **No KYC Exchange** | Exchanges lacking KYC | MEDIUM | Enhanced monitoring |
| **FATF High Risk** | FATF blacklist jurisdictions | HIGH | Enhanced due diligence |
| **FATF Grey List** | FATF grey list jurisdictions | MEDIUM | Standard due diligence |

#### Exposure Metrics

**Exposure Value**
- Total USD value of assets originating from or interacting with risky sources
- Calculated across configurable transaction hops (default: 3 hops)
- Tracked separately for incoming and outgoing flows

**Exposure Percent**
- Percentage of tainted assets relative to total value
- Formula: `(Exposure Value / Total Value) × 100`
- Threshold for alerts: Configurable (default: 5%)

#### Address Exposure Detection

**A. Entity Risk**
- Checks if screened address carries risk label
- **Data Source**: OFAC SDN, FATF lists, threat intelligence
- **Action**: Immediate block if CRITICAL severity
- **Example**: Address on OFAC SDN list → BLOCKED

**B. Interaction Risk**
- Traces fund flows across multiple hops
- **Depth**: Configurable (default: 3 hops)
- **Direction**: Incoming, outgoing, or both
- **Threshold**: Minimum exposure value/percent
- **Example**: Address receives $100K from Dark Market (2 hops away) → ALERT

**C. Blacklist Interaction**
- Checks interaction with user-defined blacklist
- **Blacklist Sources**: Internal, partner exchanges, law enforcement
- **Action**: Flag for review
- **Example**: Address interacted with blacklisted mixer → FLAGGED

#### Transaction Exposure Detection

**A. Participant Risk**
- Evaluates risk indicators of transaction participants
- **Deposit**: Screens "From" address only
- **Withdrawal**: Screens "To" address only
- **Internal**: Screens both addresses
- **Example**: Withdrawal to sanctioned address → BLOCKED

**B. Interaction Risk**
- Traces fund flow of screened transaction
- **Deposit**: Traces source of funds
- **Withdrawal**: Traces destination of funds
- **Example**: Deposit from address that received phishing funds → FLAGGED

**C. Blacklist Interaction**
- Checks transaction exposure to blacklisted addresses
- **Action**: Flag for manual review
- **Example**: Transaction involves blacklisted address → REVIEW REQUIRED

### 3. Analytics Engine
Provides comprehensive risk status overview and operational metrics.

#### Risk Insights Dashboard

**Alert Statistics**
- Real-time alert counts by risk level (Critical, High, Medium, Low)
- Time-interval alert trends
- Alert distribution by risk engine type
- Unresolved alerts requiring action

**Risk Distribution**
- Screened addresses by risk level
- Screened transactions by risk level
- Top risk indicators triggered
- Geographic risk distribution (FATF jurisdictions)

**Alert Management**
- Recent critical alerts (last 24 hours)
- Pending investigations
- Escalated cases
- Resolved alerts with outcomes

#### System Operation Metrics

**Screening Volume**
- Total screenings by blockchain
- Time-interval screening counts
- Addresses vs transactions screened
- Initial screenings vs re-screenings

**Performance Metrics**
- Average screening time
- Alert response time
- False positive rate
- System uptime

**Compliance Metrics**
- SAR filing rate
- Blocked transaction count
- Sanctions hit rate
- Regulatory reporting status

## Agent Capabilities

### 1. Real-Time Transaction Screening
```typescript
interface TransactionScreening {
  // Screen transaction before execution
  screenTransaction(tx: Transaction): Promise<ScreeningResult>;
  
  // Check address risk
  screenAddress(address: string): Promise<AddressRisk>;
  
  // Evaluate exposure
  calculateExposure(address: string, hops: number): Promise<ExposureMetrics>;
}
```

### 2. Behavioral Analysis
```typescript
interface BehaviorAnalysis {
  // Detect large transfers
  detectLargeTransfer(address: string, amount: number): boolean;
  
  // Detect high-frequency patterns
  detectHighFrequency(address: string, timeWindow: number): boolean;
  
  // Detect transit addresses
  detectTransitAddress(address: string): boolean;
  
  // Detect rapid transit
  detectRapidTransit(tx: Transaction): boolean;
}
```

### 3. Risk Assessment
```typescript
interface RiskAssessment {
  // Calculate risk score
  calculateRiskScore(entity: Address | Transaction): RiskScore;
  
  // Determine risk level
  determineRiskLevel(score: RiskScore): RiskLevel;
  
  // Generate risk report
  generateRiskReport(entity: Address | Transaction): RiskReport;
}
```

### 4. Compliance Reporting
```typescript
interface ComplianceReporting {
  // Generate SAR
  generateSAR(alert: Alert): SuspiciousActivityReport;
  
  // File regulatory report
  fileReport(report: Report, regulator: Regulator): Promise<void>;
  
  // Maintain audit trail
  logComplianceEvent(event: ComplianceEvent): void;
}
```

## Operational Workflows

### Transaction Screening Workflow
```
1. Transaction Initiated
   ↓
2. Pre-Screening Check
   - Participant Risk
   - Interaction Risk
   - Blacklist Check
   ↓
3. Risk Assessment
   - Calculate Risk Score
   - Determine Risk Level
   ↓
4. Decision
   - CRITICAL/HIGH → Block + Alert
   - MEDIUM → Flag + Monitor
   - LOW → Allow + Log
   ↓
5. Post-Transaction Monitoring
   - Track fund flow
   - Update exposure metrics
   - Generate analytics
```

### Alert Investigation Workflow
```
1. Alert Triggered
   ↓
2. Automatic Enrichment
   - Gather transaction history
   - Calculate exposure metrics
   - Identify related entities
   ↓
3. Risk Classification
   - Assign severity
   - Determine urgency
   - Route to appropriate team
   ↓
4. Investigation
   - Manual review
   - Additional data gathering
   - Risk determination
   ↓
5. Action
   - Block entity (if confirmed)
   - File SAR (if required)
   - Update blacklist
   - Close alert
```

### Sanctions Screening Workflow
```
1. Entity Identified
   ↓
2. Sanctions List Check
   - OFAC SDN
   - UN Sanctions
   - EU Sanctions
   - Local Sanctions
   ↓
3. Match Found?
   YES → Block + Report
   NO → Continue
   ↓
4. Indirect Exposure Check
   - Check interaction history
   - Calculate exposure percent
   ↓
5. Exposure > Threshold?
   YES → Enhanced Due Diligence
   NO → Standard Processing
```

## Configuration

### Risk Thresholds
```json
{
  "behavior": {
    "largeTransfer": {
      "threshold": 100000,
      "currency": "USD"
    },
    "highFrequency": {
      "transactionCount": 10,
      "timeWindow": 86400
    },
    "transitAddress": {
      "timeWindow": 1800
    },
    "rapidTransit": {
      "timeWindow": 600
    }
  },
  "exposure": {
    "traceDepth": 3,
    "minExposureValue": 1000,
    "minExposurePercent": 5,
    "criticalExposurePercent": 25
  },
  "riskLevels": {
    "critical": {
      "action": "block",
      "notify": ["compliance-team", "management"]
    },
    "high": {
      "action": "flag",
      "notify": ["compliance-team"]
    },
    "medium": {
      "action": "monitor",
      "notify": ["compliance-team"]
    },
    "low": {
      "action": "log",
      "notify": []
    }
  }
}
```

### Data Sources
```json
{
  "sanctions": {
    "ofac": {
      "url": "https://sanctionslistservice.ofac.treas.gov/api/",
      "updateFrequency": "daily"
    },
    "un": {
      "url": "https://scsanctions.un.org/",
      "updateFrequency": "daily"
    },
    "eu": {
      "url": "https://webgate.ec.europa.eu/fsd/fsf",
      "updateFrequency": "daily"
    }
  },
  "threatIntel": {
    "chainalysis": {
      "enabled": true,
      "apiKey": "env:CHAINALYSIS_API_KEY"
    },
    "elliptic": {
      "enabled": true,
      "apiKey": "env:ELLIPTIC_API_KEY"
    },
    "phalcon": {
      "enabled": true,
      "apiKey": "env:PHALCON_API_KEY"
    }
  },
  "blockchain": {
    "helius": {
      "enabled": true,
      "apiKey": "env:HELIUS_API_KEY"
    }
  }
}
```

## Integration Points

### 1. Policy Agent Integration
- Receive policy execution requests
- Screen proposed actions for compliance
- Approve/reject based on risk assessment
- Provide compliance guidance

### 2. Oracle Agent Integration
- Monitor price manipulation attempts
- Detect wash trading patterns
- Flag suspicious market activity
- Validate oracle data integrity

### 3. Execution Agent Integration
- Pre-execution transaction screening
- Block high-risk transactions
- Log all execution attempts
- Maintain compliance audit trail

### 4. Governance Agent Integration
- Screen proposal participants
- Evaluate proposal compliance
- Flag risky governance actions
- Ensure regulatory compliance

### 5. External Systems Integration
- Regulatory reporting systems (FinCEN, etc.)
- Sanctions list providers (OFAC, UN, EU)
- Threat intelligence platforms (Chainalysis, Elliptic)
- Law enforcement databases

## Monitoring & Alerting

### Alert Priorities
- **P0 (Critical)**: Sanctions hit, terrorist financing → Immediate block + escalation
- **P1 (High)**: Major structuring, large exposure → Block + investigation
- **P2 (Medium)**: Suspicious patterns, moderate exposure → Flag + monitor
- **P3 (Low)**: Minor anomalies, low exposure → Log + periodic review

### Alert Channels
- **Discord**: Real-time alerts for P0/P1
- **Email**: Daily digest for P2/P3
- **Dashboard**: All alerts with filtering/search
- **API**: Programmatic access for integrations

### Metrics Tracking
- Alert volume by severity
- False positive rate
- Investigation time
- SAR filing rate
- Blocked transaction value
- Compliance coverage

## Compliance Best Practices

### 1. Risk-Based Approach
- Focus resources on highest risks
- Adjust thresholds based on risk appetite
- Continuous risk assessment
- Regular policy updates

### 2. Documentation
- Maintain detailed audit trails
- Document all decisions
- Record investigation findings
- Preserve evidence for regulators

### 3. Training & Awareness
- Regular compliance training
- Update on regulatory changes
- Share threat intelligence
- Conduct compliance drills

### 4. Continuous Improvement
- Review false positives/negatives
- Optimize detection rules
- Update risk indicators
- Enhance data sources

## Regulatory Reporting

### Suspicious Activity Reports (SARs)
- **Trigger**: High-risk alerts requiring investigation
- **Timeline**: File within 30 days of detection
- **Content**: Detailed transaction analysis, risk assessment, supporting evidence
- **Recipient**: FinCEN (US), FIU (other jurisdictions)

### Currency Transaction Reports (CTRs)
- **Trigger**: Transactions > $10,000 (or equivalent)
- **Timeline**: File within 15 days
- **Content**: Transaction details, parties involved
- **Recipient**: FinCEN

### Travel Rule Compliance
- **Trigger**: Virtual asset transfers > $1,000
- **Requirement**: Share originator/beneficiary information
- **Method**: VASP-to-VASP communication
- **Standard**: FATF Recommendation 16

## Emergency Procedures

### Sanctions Hit Response
1. **Immediate**: Block transaction/address
2. **Within 1 hour**: Notify compliance team
3. **Within 4 hours**: File initial report
4. **Within 24 hours**: Complete investigation
5. **Within 48 hours**: File comprehensive report

### System Compromise
1. **Immediate**: Activate circuit breaker
2. **Within 15 minutes**: Assess scope
3. **Within 1 hour**: Contain threat
4. **Within 4 hours**: Restore operations
5. **Within 24 hours**: File incident report

## Success Metrics

### Effectiveness
- **Detection Rate**: % of risky transactions identified
- **False Positive Rate**: < 5% target
- **Response Time**: < 1 minute for critical alerts
- **Coverage**: 100% of transactions screened

### Compliance
- **Regulatory Findings**: Zero critical findings
- **SAR Quality**: > 95% acceptance rate
- **Reporting Timeliness**: 100% on-time filing
- **Audit Results**: Clean audit reports

### Operational
- **System Uptime**: > 99.9%
- **Screening Throughput**: > 1000 TPS
- **Alert Resolution Time**: < 24 hours average
- **Team Efficiency**: Decreasing investigation time

---

**Agent Status**: Active  
**Compliance Level**: FATF Compliant  
**Last Audit**: 2026-02-05  
**Next Review**: 2026-03-05
