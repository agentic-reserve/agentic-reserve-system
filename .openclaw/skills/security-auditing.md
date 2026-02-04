---
name: icb-security-auditing
version: 1.0.0
description: Autonomous blockchain security auditing with CTF, pentesting, fuzzing, static analysis, and cryptographic verification
---

# ICB Security Auditing Skill

## Overview
Autonomous security agents that perform comprehensive blockchain security auditing including:
- Capture The Flag (CTF) challenges
- Penetration testing
- Fuzzing and property-based testing
- Static analysis and code review
- Cryptographic verification
- Exploit detection and prevention

## Security Agent Architecture

### 1. Static Analysis Agent
Performs automated code analysis to detect vulnerabilities.

### 2. Fuzzing Agent
Generates random inputs to discover edge cases and crashes.

### 3. Penetration Testing Agent
Simulates attacks to find exploitable vulnerabilities.

### 4. Cryptographic Verification Agent
Validates cryptographic implementations and key management.

### 5. CTF Agent
Solves security challenges and learns from exploits.

### 6. Exploit Detection Agent
Monitors for known attack patterns in real-time.

## Tools and Frameworks

### Static Analysis
- **cargo-audit**: Check for vulnerable dependencies
- **cargo-geiger**: Detect unsafe Rust code
- **Semgrep**: Pattern-based code analysis
- **L3X**: AI-driven smart contract analyzer

### Fuzzing
- **Ackee Trident**: Solana-specific fuzzing framework
- **cargo-fuzz**: Rust fuzzing with libFuzzer
- **Honggfuzz**: Security-oriented fuzzer

### Penetration Testing
- **Neodyme PoC Framework**: Solana exploit framework
- **OtterSec CTF Framework**: Security challenge framework

### Code Review
- **Anchor Test UI**: Visual testing framework
- **Saber Vipers**: Checks and validations


## Autonomous Security Operations

### 1. Continuous Static Analysis

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class StaticAnalysisAgent {
  async runFullAnalysis(): Promise<SecurityReport> {
    const results = await Promise.all([
      this.checkVulnerableDependencies(),
      this.detectUnsafeCode(),
      this.runSemgrep(),
      this.analyzeWithAI()
    ]);
    
    return this.aggregateResults(results);
  }
  
  async checkVulnerableDependencies(): Promise<AnalysisResult> {
    try {
      const { stdout } = await execAsync('cargo audit --json');
      const report = JSON.parse(stdout);
      
      return {
        tool: 'cargo-audit',
        vulnerabilities: report.vulnerabilities.list,
        severity: this.calculateSeverity(report),
        recommendations: this.generateRecommendations(report)
      };
    } catch (error) {
      return { tool: 'cargo-audit', error: error.message };
    }
  }
  
  async detectUnsafeCode(): Promise<AnalysisResult> {
    try {
      const { stdout } = await execAsync('cargo geiger --output-format Json');
      const report = JSON.parse(stdout);
      
      const unsafeUsage = this.analyzeUnsafeUsage(report);
      
      return {
        tool: 'cargo-geiger',
        unsafeCount: unsafeUsage.total,
        unsafeLocations: unsafeUsage.locations,
        severity: unsafeUsage.total > 10 ? 'high' : 'medium',
        recommendations: this.generateUnsafeRecommendations(unsafeUsage)
      };
    } catch (error) {
      return { tool: 'cargo-geiger', error: error.message };
    }
  }
  
  async runSemgrep(): Promise<AnalysisResult> {
    try {
      // Run Semgrep with Solana-specific rules
      const { stdout } = await execAsync(
        'semgrep --config=auto --json programs/'
      );
      const report = JSON.parse(stdout);
      
      return {
        tool: 'semgrep',
        findings: report.results,
        severity: this.categorizeSemgrepFindings(report),
        recommendations: this.generateSemgrepRecommendations(report)
      };
    } catch (error) {
      return { tool: 'semgrep', error: error.message };
    }
  }
  
  async analyzeWithAI(): Promise<AnalysisResult> {
    // Use OpenRouter AI for deep code analysis
    const openRouter = getOpenRouterClient();
    
    const codeFiles = await this.getSecurityCriticalFiles();
    const analyses = [];
    
    for (const file of codeFiles) {
      const analysis = await openRouter.generateCompletion({
        model: 'anthropic/claude-sonnet-4',
        messages: [{
          role: 'user',
          content: `Analyze this Solana smart contract for security vulnerabilities:
          
${file.content}

Focus on:
1. Missing owner checks
2. Missing signer checks
3. Integer overflow/underflow
4. Unchecked account validation
5. Reentrancy vulnerabilities
6. Access control issues
7. Cryptographic weaknesses

Provide specific line numbers and severity ratings.`
        }],
        temperature: 0.1
      });
      
      analyses.push({
        file: file.path,
        analysis: analysis.content
      });
    }
    
    return {
      tool: 'ai-analysis',
      analyses,
      severity: 'info',
      recommendations: this.extractAIRecommendations(analyses)
    };
  }
}
```

### 2. Automated Fuzzing

```typescript
class FuzzingAgent {
  async runFuzzingCampaign(): Promise<FuzzingReport> {
    console.log('🔍 Starting fuzzing campaign...');
    
    const results = await Promise.all([
      this.runTridentFuzzing(),
      this.runCargoFuzz(),
      this.runPropertyBasedTests()
    ]);
    
    return this.aggregateFuzzingResults(results);
  }
  
  async runTridentFuzzing(): Promise<FuzzingResult> {
    try {
      // Install Trident if not present
      await execAsync('cargo install trident-cli');
      
      // Initialize Trident
      await execAsync('trident init', { cwd: 'programs/icb-core' });
      
      // Run fuzzing
      const { stdout } = await execAsync(
        'trident fuzz run-hfuzz --iterations 10000',
        { cwd: 'programs/icb-core', timeout: 300000 }
      );
      
      return {
        tool: 'trident',
        iterations: 10000,
        crashes: this.parseTridentCrashes(stdout),
        coverage: this.parseTridentCoverage(stdout)
      };
    } catch (error) {
      return { tool: 'trident', error: error.message };
    }
  }
  
  async runCargoFuzz(): Promise<FuzzingResult> {
    try {
      // Install cargo-fuzz
      await execAsync('cargo install cargo-fuzz');
      
      // Initialize fuzz targets
      await execAsync('cargo fuzz init', { cwd: 'programs/icb-core' });
      
      // Create fuzz targets for each instruction
      const instructions = await this.getInstructions();
      
      for (const instruction of instructions) {
        await this.createFuzzTarget(instruction);
      }
      
      // Run fuzzing
      const results = [];
      for (const instruction of instructions) {
        const { stdout } = await execAsync(
          `cargo fuzz run ${instruction} -- -max_total_time=60`,
          { cwd: 'programs/icb-core' }
        );
        
        results.push({
          instruction,
          result: this.parseCargoFuzzResult(stdout)
        });
      }
      
      return {
        tool: 'cargo-fuzz',
        targets: instructions.length,
        results,
        crashes: results.filter(r => r.result.crashed)
      };
    } catch (error) {
      return { tool: 'cargo-fuzz', error: error.message };
    }
  }
  
  async createFuzzTarget(instruction: string): Promise<void> {
    const fuzzCode = `
#![no_main]
use libfuzzer_sys::fuzz_target;
use icb_core::instruction::${instruction};

fuzz_target!(|data: &[u8]| {
    // Fuzz the ${instruction} instruction
    if let Ok(accounts) = parse_accounts(data) {
        let _ = ${instruction}(accounts);
    }
});
`;
    
    const fs = require('fs');
    fs.writeFileSync(
      `programs/icb-core/fuzz/fuzz_targets/${instruction}.rs`,
      fuzzCode
    );
  }
}
```

### 3. Penetration Testing

```typescript
class PenetrationTestingAgent {
  async runPenetrationTests(): Promise<PentestReport> {
    console.log('🎯 Starting penetration testing...');
    
    const results = await Promise.all([
      this.testOwnerChecks(),
      this.testSignerChecks(),
      this.testIntegerOverflow(),
      this.testReentrancy(),
      this.testAccessControl(),
      this.testOracleManipulation()
    ]);
    
    return this.aggregatePentestResults(results);
  }
  
  async testOwnerChecks(): Promise<PentestResult> {
    // Use Neodyme PoC Framework
    const pocCode = `
use solana_program_test::*;
use solana_sdk::{signature::Keypair, signer::Signer};

#[tokio::test]
async fn test_missing_owner_check() {
    let program_id = icb_core::id();
    let mut program_test = ProgramTest::new(
        "icb_core",
        program_id,
        processor!(icb_core::entry),
    );
    
    let (mut banks_client, payer, recent_blockhash) = 
        program_test.start().await;
    
    // Create malicious account with wrong owner
    let malicious_account = Keypair::new();
    let wrong_owner = Keypair::new();
    
    // Try to exploit missing owner check
    let result = exploit_missing_owner_check(
        &mut banks_client,
        &payer,
        &malicious_account,
        &wrong_owner,
        recent_blockhash
    ).await;
    
    // Should fail if owner check is present
    assert!(result.is_err(), "Missing owner check vulnerability!");
}
`;
    
    return this.executePoCTest(pocCode, 'owner-check');
  }
  
  async testIntegerOverflow(): Promise<PentestResult> {
    const pocCode = `
#[tokio::test]
async fn test_integer_overflow() {
    // Test arithmetic operations with extreme values
    let max_value = u64::MAX;
    let result = test_deposit(max_value).await;
    
    // Should use checked_add, not unchecked addition
    assert!(result.is_err(), "Integer overflow vulnerability!");
}
`;
    
    return this.executePoCTest(pocCode, 'integer-overflow');
  }
  
  async testOracleManipulation(): Promise<PentestResult> {
    // Test LP token oracle manipulation
    const pocCode = `
#[tokio::test]
async fn test_oracle_manipulation() {
    // 1. Create large position in AMM
    // 2. Manipulate price
    // 3. Try to exploit lending protocol
    
    let manipulation_result = manipulate_amm_price().await;
    let exploit_result = exploit_lending_with_fake_price().await;
    
    // Should have oracle guardrails
    assert!(exploit_result.is_err(), "Oracle manipulation vulnerability!");
}
`;
    
    return this.executePoCTest(pocCode, 'oracle-manipulation');
  }
  
  private async executePoCTest(
    code: string,
    testName: string
  ): Promise<PentestResult> {
    const fs = require('fs');
    const testPath = `programs/icb-core/tests/pentest_${testName}.rs`;
    
    // Write PoC test
    fs.writeFileSync(testPath, code);
    
    try {
      // Run test
      const { stdout, stderr } = await execAsync(
        `cargo test pentest_${testName} -- --nocapture`,
        { cwd: 'programs/icb-core' }
      );
      
      const passed = !stderr.includes('FAILED');
      
      return {
        test: testName,
        passed,
        vulnerable: !passed,
        output: stdout + stderr
      };
    } catch (error) {
      return {
        test: testName,
        passed: false,
        vulnerable: true,
        output: error.message
      };
    } finally {
      // Clean up
      fs.unlinkSync(testPath);
    }
  }
}
```

### 4. Cryptographic Verification

```typescript
class CryptographicVerificationAgent {
  async verifyCryptography(): Promise<CryptoReport> {
    console.log('🔐 Verifying cryptographic implementations...');
    
    const results = await Promise.all([
      this.verifySignatureSchemes(),
      this.verifyKeyDerivation(),
      this.verifyRandomness(),
      this.verifyHashFunctions(),
      this.verifyEncryption()
    ]);
    
    return this.aggregateCryptoResults(results);
  }
  
  async verifySignatureSchemes(): Promise<CryptoResult> {
    // Verify Ed25519 signature implementation
    const tests = [
      this.testSignatureVerification(),
      this.testSignatureMalleability(),
      this.testPublicKeyRecovery(),
      this.testBatchVerification()
    ];
    
    const results = await Promise.all(tests);
    
    return {
      component: 'signatures',
      tests: results,
      passed: results.every(r => r.passed),
      vulnerabilities: results.filter(r => !r.passed)
    };
  }
  
  async verifyKeyDerivation(): Promise<CryptoResult> {
    // Verify PDA derivation
    const tests = [
      this.testPDACollisions(),
      this.testSeedValidation(),
      this.testBumpSeedSafety(),
      this.testCrossProgram PDAAccess()
    ];
    
    const results = await Promise.all(tests);
    
    return {
      component: 'key-derivation',
      tests: results,
      passed: results.every(r => r.passed),
      vulnerabilities: results.filter(r => !r.passed)
    };
  }
  
  async testPDACollisions(): Promise<TestResult> {
    // Test for PDA collision vulnerabilities
    const seeds = this.generateTestSeeds(10000);
    const pdas = new Set();
    
    for (const seed of seeds) {
      const [pda] = await PublicKey.findProgramAddress(
        [Buffer.from(seed)],
        programId
      );
      
      if (pdas.has(pda.toString())) {
        return {
          name: 'PDA Collision Test',
          passed: false,
          details: `Collision found for seed: ${seed}`
        };
      }
      
      pdas.add(pda.toString());
    }
    
    return {
      name: 'PDA Collision Test',
      passed: true,
      details: 'No collisions found in 10,000 seeds'
    };
  }
  
  async verifyRandomness(): Promise<CryptoResult> {
    // Verify randomness sources
    const tests = [
      this.testSlotHashRandomness(),
      this.testRecentBlockhashRandomness(),
      this.testPredictability()
    ];
    
    const results = await Promise.all(tests);
    
    return {
      component: 'randomness',
      tests: results,
      passed: results.every(r => r.passed),
      vulnerabilities: results.filter(r => !r.passed)
    };
  }
}
```

### 5. CTF Challenge Solver

```typescript
class CTFAgent {
  async solveCTFChallenges(): Promise<CTFReport> {
    console.log('🏁 Solving CTF challenges...');
    
    // Use OtterSec CTF Framework
    const challenges = await this.loadCTFChallenges();
    const solutions = [];
    
    for (const challenge of challenges) {
      const solution = await this.solveChallenge(challenge);
      solutions.push(solution);
      
      // Learn from the exploit
      await this.learnFromExploit(challenge, solution);
    }
    
    return {
      totalChallenges: challenges.length,
      solved: solutions.filter(s => s.success).length,
      solutions,
      learnedPatterns: await this.getLearnedPatterns()
    };
  }
  
  async solveChallenge(challenge: CTFChallenge): Promise<CTFSolution> {
    // Use AI to analyze the challenge
    const openRouter = getOpenRouterClient();
    
    const analysis = await openRouter.generateCompletion({
      model: 'anthropic/claude-sonnet-4',
      messages: [{
        role: 'user',
        content: `Analyze this Solana CTF challenge and provide an exploit:

Challenge: ${challenge.name}
Description: ${challenge.description}
Code: ${challenge.code}

Identify:
1. The vulnerability type
2. The exploit strategy
3. The PoC code to solve it

Provide working Rust code for the exploit.`
      }],
      temperature: 0.2
    });
    
    // Extract exploit code from AI response
    const exploitCode = this.extractExploitCode(analysis.content);
    
    // Test the exploit
    const result = await this.testExploit(challenge, exploitCode);
    
    return {
      challenge: challenge.name,
      success: result.success,
      exploitCode,
      flag: result.flag,
      vulnerabilityType: this.identifyVulnerabilityType(analysis.content)
    };
  }
  
  async learnFromExploit(
    challenge: CTFChallenge,
    solution: CTFSolution
  ): Promise<void> {
    // Store exploit pattern for future detection
    const pattern = {
      vulnerabilityType: solution.vulnerabilityType,
      indicators: this.extractIndicators(challenge.code),
      exploitStrategy: solution.exploitCode,
      mitigation: this.generateMitigation(solution)
    };
    
    await this.storePattern(pattern);
    
    // Update detection rules
    await this.updateDetectionRules(pattern);
  }
}
```

### 6. Real-Time Exploit Detection

```typescript
class ExploitDetectionAgent {
  private knownPatterns: Map<string, ExploitPattern> = new Map();
  
  async monitorTransactions(): Promise<void> {
    console.log('👁️  Monitoring for exploits...');
    
    // Subscribe to transaction stream via Helius
    const helius = getHeliusClient();
    
    helius.subscribeToTransactions({
      accountKeys: [ICB_PROGRAM_IDS],
      callback: async (tx) => {
        const analysis = await this.analyzeTransaction(tx);
        
        if (analysis.suspicious) {
          await this.handleSuspiciousTransaction(tx, analysis);
        }
      }
    });
  }
  
  async analyzeTransaction(tx: Transaction): Promise<TxAnalysis> {
    const checks = await Promise.all([
      this.checkForKnownExploits(tx),
      this.checkForAnomalousPatterns(tx),
      this.checkForFlashLoanAttacks(tx),
      this.checkForOracleManipulation(tx),
      this.checkForReentrancy(tx)
    ]);
    
    const suspicious = checks.some(c => c.detected);
    
    return {
      suspicious,
      checks,
      severity: this.calculateSeverity(checks),
      recommendations: this.generateRecommendations(checks)
    };
  }
  
  async checkForKnownExploits(tx: Transaction): Promise<ExploitCheck> {
    // Check against known exploit patterns
    for (const [name, pattern] of this.knownPatterns) {
      if (this.matchesPattern(tx, pattern)) {
        return {
          name: 'Known Exploit',
          detected: true,
          pattern: name,
          confidence: 0.95
        };
      }
    }
    
    return { name: 'Known Exploit', detected: false };
  }
  
  async checkForFlashLoanAttacks(tx: Transaction): Promise<ExploitCheck> {
    // Detect flash loan attack patterns
    const instructions = tx.message.instructions;
    
    // Look for: borrow -> manipulate -> repay pattern
    const hasBorrow = instructions.some(i => this.isBorrowInstruction(i));
    const hasRepay = instructions.some(i => this.isRepayInstruction(i));
    const hasManipulation = instructions.some(i => 
      this.isMarketManipulation(i)
    );
    
    if (hasBorrow && hasRepay && hasManipulation) {
      return {
        name: 'Flash Loan Attack',
        detected: true,
        confidence: 0.85,
        details: 'Detected borrow-manipulate-repay pattern'
      };
    }
    
    return { name: 'Flash Loan Attack', detected: false };
  }
  
  async handleSuspiciousTransaction(
    tx: Transaction,
    analysis: TxAnalysis
  ): Promise<void> {
    console.log('🚨 SUSPICIOUS TRANSACTION DETECTED');
    console.log(`Severity: ${analysis.severity}`);
    console.log(`Checks: ${JSON.stringify(analysis.checks, null, 2)}`);
    
    // Alert monitoring agent
    await this.sendAlert({
      severity: analysis.severity,
      title: 'Suspicious Transaction Detected',
      description: `Transaction ${tx.signature} shows signs of exploit`,
      details: analysis
    });
    
    // If critical, trigger circuit breaker
    if (analysis.severity === 'critical') {
      await this.triggerCircuitBreaker(analysis);
    }
    
    // Store for analysis
    await this.storeIncident(tx, analysis);
  }
}
```

### 7. Automated Security Reporting

```typescript
class SecurityReportingAgent {
  async generateSecurityReport(): Promise<SecurityReport> {
    console.log('📊 Generating security report...');
    
    const [
      staticAnalysis,
      fuzzingResults,
      pentestResults,
      cryptoVerification,
      ctfResults,
      exploitDetection
    ] = await Promise.all([
      new StaticAnalysisAgent().runFullAnalysis(),
      new FuzzingAgent().runFuzzingCampaign(),
      new PenetrationTestingAgent().runPenetrationTests(),
      new CryptographicVerificationAgent().verifyCryptography(),
      new CTFAgent().solveCTFChallenges(),
      this.getExploitDetectionStats()
    ]);
    
    const report = {
      timestamp: Date.now(),
      summary: this.generateSummary({
        staticAnalysis,
        fuzzingResults,
        pentestResults,
        cryptoVerification,
        ctfResults,
        exploitDetection
      }),
      staticAnalysis,
      fuzzingResults,
      pentestResults,
      cryptoVerification,
      ctfResults,
      exploitDetection,
      recommendations: this.generateRecommendations({
        staticAnalysis,
        fuzzingResults,
        pentestResults,
        cryptoVerification
      }),
      riskScore: this.calculateRiskScore({
        staticAnalysis,
        fuzzingResults,
        pentestResults,
        cryptoVerification
      })
    };
    
    // Store report
    await this.storeReport(report);
    
    // Send to monitoring dashboard
    await this.publishReport(report);
    
    return report;
  }
  
  private generateSummary(results: any): SecuritySummary {
    const totalVulnerabilities = 
      results.staticAnalysis.vulnerabilities.length +
      results.pentestResults.vulnerabilities.length;
    
    const criticalVulnerabilities = this.countCritical(results);
    
    return {
      totalVulnerabilities,
      criticalVulnerabilities,
      highVulnerabilities: this.countHigh(results),
      mediumVulnerabilities: this.countMedium(results),
      lowVulnerabilities: this.countLow(results),
      fuzzingCoverage: results.fuzzingResults.coverage,
      pentestsPassed: results.pentestResults.passed,
      cryptoVerified: results.cryptoVerification.passed,
      overallStatus: criticalVulnerabilities === 0 ? 'PASS' : 'FAIL'
    };
  }
  
  private calculateRiskScore(results: any): number {
    // Calculate risk score (0-100, lower is better)
    let score = 0;
    
    // Static analysis (40 points)
    score += results.staticAnalysis.vulnerabilities.length * 2;
    
    // Pentest results (30 points)
    score += results.pentestResults.vulnerabilities.length * 3;
    
    // Crypto verification (20 points)
    if (!results.cryptoVerification.passed) score += 20;
    
    // Fuzzing (10 points)
    score += results.fuzzingResults.crashes.length * 5;
    
    return Math.min(score, 100);
  }
}
```

## Continuous Security Monitoring

### Automated Security Pipeline

```bash
#!/bin/bash
# security-pipeline.sh - Run full security audit

echo "🔒 Starting ICB Security Audit Pipeline..."

# 1. Static Analysis
echo "📊 Running static analysis..."
cargo audit
cargo geiger
semgrep --config=auto programs/

# 2. Fuzzing
echo "🔍 Running fuzzing..."
cd programs/icb-core
trident fuzz run-hfuzz --iterations 10000
cargo fuzz run --all -- -max_total_time=300

# 3. Penetration Testing
echo "🎯 Running penetration tests..."
cargo test pentest_ -- --nocapture

# 4. Property-Based Testing
echo "🧪 Running property-based tests..."
cargo test prop_ -- --nocapture

# 5. Generate Report
echo "📊 Generating security report..."
node backend/src/services/security/generate-report.js

echo "✅ Security audit complete!"
```

### Cron Job Setup

```bash
# Run security audit every 6 hours
0 */6 * * * cd /opt/internet-capital-bank && ./scripts/security-pipeline.sh

# Run exploit detection monitoring continuously
@reboot cd /opt/internet-capital-bank && npm run security:monitor
```

## Integration with Agent Swarm

```typescript
// Add security agent to orchestrator
const securityAgent = {
  id: 'security-agent',
  role: 'specialist',
  capabilities: [
    'static-analysis',
    'fuzzing',
    'penetration-testing',
    'crypto-verification',
    'exploit-detection',
    'ctf-solving'
  ],
  status: 'active'
};

orchestrator.registerAgent(securityAgent);

// Security workflow
orchestrator.workflows.set('security-audit', {
  description: 'Run comprehensive security audit',
  trigger: 'cron:0 */6 * * *',
  steps: [
    {
      agent: 'security-agent',
      action: 'run-static-analysis',
      inputs: {}
    },
    {
      agent: 'security-agent',
      action: 'run-fuzzing',
      inputs: { iterations: 10000 }
    },
    {
      agent: 'security-agent',
      action: 'run-pentests',
      inputs: {}
    },
    {
      agent: 'security-agent',
      action: 'verify-crypto',
      inputs: {}
    },
    {
      agent: 'security-agent',
      action: 'generate-report',
      inputs: {}
    },
    {
      agent: 'monitoring-agent',
      action: 'publish-security-report',
      inputs: {}
    }
  ]
});
```

## Best Practices

1. **Run security audits before every deployment**
2. **Monitor transactions in real-time for exploits**
3. **Keep exploit pattern database updated**
4. **Automate security testing in CI/CD**
5. **Use multiple tools for comprehensive coverage**
6. **Learn from CTF challenges and real exploits**
7. **Verify all cryptographic implementations**
8. **Test with extreme values and edge cases**
9. **Implement circuit breakers for critical issues**
10. **Generate and review security reports regularly**

## Resources

- [Audit Resources](../../../documentation/development/audit-resources.md)
- [Neodyme PoC Framework](https://github.com/neodyme-labs/solana-poc-framework)
- [OtterSec CTF Framework](https://github.com/otter-sec/sol-ctf-framework)
- [Ackee Trident](https://github.com/Ackee-Blockchain/trident)
- [Solana Security Best Practices](https://github.com/project-serum/sealevel-attacks)
