/**
 * Sipher API Client Usage Example
 * 
 * This file demonstrates how to use the SipherClient for various privacy operations.
 * 
 * @module sipher-example
 */

import { SipherClient } from './sipher-client';
import { SipherErrorHandler } from './sipher-error-handler';
import { SipherConfig } from '../types';

/**
 * Example: Initialize Sipher Client
 */
async function initializeClient(): Promise<SipherClient> {
  const config: SipherConfig = {
    baseUrl: process.env.SIPHER_API_URL || 'https://sipher.sip-protocol.org',
    apiKey: process.env.SIPHER_API_KEY || 'your_api_key_here',
    timeout: 30000,
    retries: 3
  };

  const client = new SipherClient(config);
  console.log('✓ Sipher client initialized');
  
  return client;
}

/**
 * Example: Generate Stealth Meta-Address
 */
async function exampleGenerateMetaAddress(client: SipherClient): Promise<void> {
  console.log('\n--- Example: Generate Stealth Meta-Address ---');
  
  try {
    const metaAddress = await client.generateMetaAddress('agent-wallet-1');
    
    console.log('✓ Meta-address generated:');
    console.log('  Spending Public Key:', metaAddress.metaAddress.spendingPublicKey);
    console.log('  Viewing Public Key:', metaAddress.metaAddress.viewingPublicKey);
    console.log('  Label:', metaAddress.label);
    console.log('  ⚠️  Private keys should be encrypted before storage!');
  } catch (error) {
    console.error('✗ Failed to generate meta-address:', error);
  }
}

/**
 * Example: Build Shielded Transfer
 */
async function exampleBuildShieldedTransfer(client: SipherClient): Promise<void> {
  console.log('\n--- Example: Build Shielded Transfer ---');
  
  try {
    // First, generate a recipient meta-address
    const recipientMeta = await client.generateMetaAddress('recipient-agent');
    
    // Build a shielded transfer
    const transfer = await client.buildShieldedTransfer({
      sender: 'SenderWalletAddress111111111111111111111111111',
      recipientMetaAddress: recipientMeta,
      amount: '1000000', // 1 ARU (assuming 6 decimals)
      mint: 'ARUTokenMintAddress11111111111111111111111111'
    });
    
    console.log('✓ Shielded transfer built:');
    console.log('  Stealth Address:', transfer.stealthAddress.address);
    console.log('  Ephemeral Public Key:', transfer.stealthAddress.ephemeralPublicKey);
    console.log('  Commitment:', transfer.commitment);
    console.log('  ⚠️  Transaction needs to be signed and submitted!');
  } catch (error) {
    console.error('✗ Failed to build shielded transfer:', error);
  }
}

/**
 * Example: Create Pedersen Commitment
 */
async function exampleCreateCommitment(client: SipherClient): Promise<void> {
  console.log('\n--- Example: Create Pedersen Commitment ---');
  
  try {
    const commitment = await client.createCommitment('5000000'); // 5 ARU
    
    console.log('✓ Commitment created:');
    console.log('  Commitment:', commitment.commitment);
    console.log('  Value:', commitment.value);
    console.log('  ⚠️  Blinding factor should be encrypted before storage!');
    
    // Verify the commitment
    const verification = await client.verifyCommitment({
      commitment: commitment.commitment,
      value: commitment.value,
      blindingFactor: commitment.blindingFactor
    });
    
    console.log('✓ Commitment verified:', verification.valid);
  } catch (error) {
    console.error('✗ Failed to create commitment:', error);
  }
}

/**
 * Example: Homomorphic Commitment Addition
 */
async function exampleAddCommitments(client: SipherClient): Promise<void> {
  console.log('\n--- Example: Homomorphic Commitment Addition ---');
  
  try {
    // Create two commitments
    const commitmentA = await client.createCommitment('1000000'); // 1 ARU
    const commitmentB = await client.createCommitment('2000000'); // 2 ARU
    
    console.log('✓ Created commitment A (1 ARU)');
    console.log('✓ Created commitment B (2 ARU)');
    
    // Add them homomorphically
    const sumCommitment = await client.addCommitments({
      commitmentA: commitmentA.commitment,
      commitmentB: commitmentB.commitment,
      blindingA: commitmentA.blindingFactor,
      blindingB: commitmentB.blindingFactor
    });
    
    console.log('✓ Commitments added homomorphically:');
    console.log('  Sum Commitment:', sumCommitment.commitment);
    console.log('  ℹ️  This commitment represents 3 ARU without revealing individual amounts');
  } catch (error) {
    console.error('✗ Failed to add commitments:', error);
  }
}

/**
 * Example: Analyze Privacy Score
 */
async function exampleAnalyzePrivacy(client: SipherClient): Promise<void> {
  console.log('\n--- Example: Analyze Privacy Score ---');
  
  try {
    const score = await client.analyzePrivacy(
      'VaultWalletAddress111111111111111111111111111',
      100 // Analyze last 100 transactions
    );
    
    console.log('✓ Privacy score analyzed:');
    console.log('  Address:', score.address);
    console.log('  Score:', score.score, '/100');
    console.log('  Grade:', score.grade);
    console.log('  Factors:', score.factors.join(', '));
    console.log('  Recommendations:');
    score.recommendations.forEach((rec, i) => {
      console.log(`    ${i + 1}. ${rec}`);
    });
  } catch (error) {
    console.error('✗ Failed to analyze privacy:', error);
  }
}

/**
 * Example: Generate Hierarchical Viewing Keys
 */
async function exampleViewingKeys(client: SipherClient): Promise<void> {
  console.log('\n--- Example: Hierarchical Viewing Keys ---');
  
  try {
    // Generate master viewing key
    const masterKey = await client.generateViewingKey('m/0');
    console.log('✓ Master viewing key generated:', masterKey.path);
    
    // Derive organizational key
    const orgKey = await client.deriveViewingKey(masterKey, 'm/0/org');
    console.log('✓ Organizational key derived:', orgKey.path);
    
    // Derive yearly key
    const yearKey = await client.deriveViewingKey(orgKey, 'm/0/org/2026');
    console.log('✓ Yearly key derived:', yearKey.path);
    
    // Derive quarterly key
    const quarterKey = await client.deriveViewingKey(yearKey, 'm/0/org/2026/Q1');
    console.log('✓ Quarterly key derived:', quarterKey.path);
    
    // Verify hierarchy
    const verification = await client.verifyHierarchy(masterKey, quarterKey);
    console.log('✓ Hierarchy verified:', verification.valid);
    
    console.log('\nℹ️  Viewing Key Hierarchy:');
    console.log('  m/0 (master) → m/0/org → m/0/org/2026 → m/0/org/2026/Q1');
    console.log('  Each level can decrypt transactions within its scope');
  } catch (error) {
    console.error('✗ Failed to work with viewing keys:', error);
  }
}

/**
 * Example: Error Handling with Retry
 */
async function exampleErrorHandling(): Promise<void> {
  console.log('\n--- Example: Error Handling with Retry ---');
  
  const errorHandler = new SipherErrorHandler();
  
  let attemptCount = 0;
  const unreliableOperation = async () => {
    attemptCount++;
    console.log(`  Attempt ${attemptCount}...`);
    
    if (attemptCount < 3) {
      throw new Error('Simulated transient failure');
    }
    
    return 'Success!';
  };
  
  try {
    const result = await errorHandler.retryWithBackoff(
      unreliableOperation,
      3, // max retries
      500 // base delay (ms)
    );
    
    console.log('✓ Operation succeeded after retries:', result);
  } catch (error) {
    console.error('✗ Operation failed after all retries:', error);
  }
}

/**
 * Example: Check API Health
 */
async function exampleHealthCheck(client: SipherClient): Promise<void> {
  console.log('\n--- Example: API Health Check ---');
  
  try {
    const health = await client.checkHealth();
    
    console.log('✓ API is healthy:');
    console.log('  Status:', health.status);
    console.log('  Version:', health.version);
  } catch (error) {
    console.error('✗ API health check failed:', error);
  }
}

/**
 * Run all examples
 */
async function runExamples(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Sipher API Client Examples');
  console.log('='.repeat(60));
  
  try {
    const client = await initializeClient();
    
    // Note: These examples will fail without a valid API key
    // Uncomment the examples you want to run:
    
    // await exampleHealthCheck(client);
    // await exampleGenerateMetaAddress(client);
    // await exampleBuildShieldedTransfer(client);
    // await exampleCreateCommitment(client);
    // await exampleAddCommitments(client);
    // await exampleAnalyzePrivacy(client);
    // await exampleViewingKeys(client);
    // await exampleErrorHandling();
    
    console.log('\n' + '='.repeat(60));
    console.log('ℹ️  To run these examples:');
    console.log('  1. Set SIPHER_API_KEY environment variable');
    console.log('  2. Uncomment the example functions above');
    console.log('  3. Run: ts-node backend/src/services/privacy/sipher/example.ts');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Failed to run examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  initializeClient,
  exampleGenerateMetaAddress,
  exampleBuildShieldedTransfer,
  exampleCreateCommitment,
  exampleAddCommitments,
  exampleAnalyzePrivacy,
  exampleViewingKeys,
  exampleErrorHandling,
  exampleHealthCheck
};
