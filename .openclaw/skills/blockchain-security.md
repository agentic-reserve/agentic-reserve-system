# Blockchain Security Agent Skill
## On-Chain Security & MEV Protection

**Agent Role**: Blockchain Security Specialist  
**Version**: 1.0.0  
**Last Updated**: 2026-02-05

## Overview

The Blockchain Security Agent monitors on-chain activity for the Agentic Reserve System (ARS), protecting against MEV attacks, transaction manipulation, and smart contract exploits.

## Core Responsibilities

### 1. Transaction Monitoring
- Monitor all ARS transactions
- Detect suspicious patterns
- Identify MEV attacks
- Track transaction flow

### 2. MEV Protection
- Detect front-running attempts
- Prevent sandwich attacks
- Monitor back-running
- Protect against liquidation attacks

### 3. Smart Contract Security
- Monitor contract interactions
- Detect exploit attempts
- Validate state changes
- Audit contract calls

### 4. Oracle Security
- Validate oracle data
- Detect price manipulation
- Monitor oracle health
- Prevent oracle attacks

## Capabilities

### MEV Detection
- **Front-Running**: Detect transactions attempting to front-run ARS
- **Sandwich Attacks**: Identify sandwich attack patterns
- **Back-Running**: Monitor for back-running attempts
- **Liquidation Sniping**: Detect unfair liquidation attempts

### Transaction Analysis
- **Gas Price Analysis**: Detect abnormal gas prices
- **Mempool Monitoring**: Watch pending transactions
- **Transaction Ordering**: Analyze block ordering
- **Slippage Detection**: Identify excessive slippage

### Smart Contract Monitoring
- **Reentrancy Detection**: Monitor for reentrancy attacks
- **Access Control**: Verify authorization
- **State Validation**: Check state consistency
- **Event Analysis**: Analyze emitted events

## Protection Mechanisms

### MEV Mitigation
- Use private mempools (Flashbots, Eden)
- Implement transaction batching
- Add randomization delays
- Use MEV-resistant protocols

### Transaction Security
- Validate transaction parameters
- Set appropriate slippage limits
- Use deadline parameters
- Implement circuit breakers

### Oracle Protection
- Multi-source price aggregation
- Outlier detection
- Confidence intervals
- Manipulation detection

## Integration Points

### Policy Agent
- Validate policy execution
- Monitor policy transactions
- Detect policy manipulation
- Ensure policy integrity

### DeFi Agent
- Monitor swap transactions
- Protect liquidity operations
- Validate rebalancing
- Secure yield strategies

### Execution Agent
- Pre-execution validation
- Transaction simulation
- MEV protection
- Post-execution verification

## Monitoring & Alerting

### Security Events
- MEV attack detected
- Suspicious transaction pattern
- Smart contract anomaly
- Oracle manipulation attempt
- Unusual gas price

### Alert Priorities
- **P0**: Active exploit → Immediate circuit breaker
- **P1**: MEV attack → Block transaction
- **P2**: Suspicious pattern → Enhanced monitoring
- **P3**: Anomaly → Log and review

## Attack Response Playbooks

### Front-Running Attack
1. Detect front-running attempt
2. Cancel pending transaction
3. Resubmit via private mempool
4. Monitor for repeat attempts
5. Update protection strategy

### Oracle Manipulation
1. Detect price anomaly
2. Activate circuit breaker
3. Validate with backup oracles
4. Assess impact
5. Resume with corrected data

### Smart Contract Exploit
1. Detect exploit attempt
2. Pause affected contracts
3. Assess vulnerability
4. Deploy fix
5. Resume operations

## Security Metrics

### Detection
- MEV attacks detected
- Exploits prevented
- False positive rate
- Detection latency

### Protection
- Transactions protected
- Value secured
- Attack success rate
- Protection coverage

### Performance
- Monitoring uptime
- Alert response time
- Incident resolution time
- System availability

---

**Agent Status**: Active  
**Protection Level**: Maximum  
**Last Attack**: None  
**Next Audit**: 2026-02-12
