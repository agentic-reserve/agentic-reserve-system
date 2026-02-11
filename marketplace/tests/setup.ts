import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

/**
 * Test setup utilities for Agent Reputation & Marketplace System
 */

export interface TestContext {
  provider: anchor.AnchorProvider;
  agentRegistry: Program;
  serviceMarketplace: Program;
  escrowManager: Program;
}

export async function setupTestContext(): Promise<TestContext> {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load programs (will be implemented as programs are developed)
  const agentRegistry = anchor.workspace.AgentRegistry;
  const serviceMarketplace = anchor.workspace.ServiceMarketplace;
  const escrowManager = anchor.workspace.EscrowManager;

  return {
    provider,
    agentRegistry,
    serviceMarketplace,
    escrowManager,
  };
}

export function generateKeypair() {
  return anchor.web3.Keypair.generate();
}

export async function airdrop(
  connection: anchor.web3.Connection,
  publicKey: PublicKey,
  amount: number = 10 * anchor.web3.LAMPORTS_PER_SOL
) {
  const signature = await connection.requestAirdrop(publicKey, amount);
  await connection.confirmTransaction(signature);
}
