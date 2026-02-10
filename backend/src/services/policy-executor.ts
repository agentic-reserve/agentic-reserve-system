import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { supabase } from './supabase';
import { config } from '../config';

export class PolicyExecutor {
  private connection: Connection;
  private executorKeypair: Keypair;
  private isRunning: boolean = false;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    // In production, load from secure key storage
    this.executorKeypair = Keypair.generate();
  }

  public start() {
    if (this.isRunning) {
      console.log('Policy executor already running');
      return;
    }

    this.isRunning = true;
    console.log('🏛️ Policy executor started');

    // Check proposals every minute
    setInterval(() => {
      this.checkAndExecuteProposals();
    }, 60000);

    // Initial check
    this.checkAndExecuteProposals();
  }

  public stop() {
    this.isRunning = false;
    console.log('Policy executor stopped');
  }

  private async checkAndExecuteProposals() {
    try {
      const now = new Date().toISOString();

      // Get proposals that have ended but not executed
      const { data: proposals, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('status', 'active')
        .lt('end_time', now);

      if (error) {
        console.error('Error fetching proposals:', error);
        return;
      }

      if (!proposals || proposals.length === 0) {
        return;
      }

      console.log(`Found ${proposals.length} proposals to process`);

      for (const proposal of proposals) {
        await this.executeProposal(proposal);
      }
    } catch (error) {
      console.error('Error checking proposals:', error);
    }
  }

  private async executeProposal(proposal: any) {
    try {
      const yesStake = BigInt(proposal.yes_stake || '0');
      const noStake = BigInt(proposal.no_stake || '0');
      const totalStake = yesStake + noStake;

      if (totalStake === 0n) {
        // No votes, mark as failed
        await this.updateProposalStatus(proposal.id, 'failed', null);
        return;
      }

      const yesPercentage = Number((yesStake * 10000n) / totalStake) / 100;

      if (yesPercentage > 50) {
        // Proposal passed, execute policy
        console.log(`Executing proposal ${proposal.id}: ${proposal.policy_type}`);
        
        const txSignature = await this.executePolicyAction(proposal);
        
        await this.updateProposalStatus(proposal.id, 'executed', txSignature);
        
        // Collect proposal fee (10 ARU burned)
        await this.recordProposalFee(proposal.id, proposal.proposer);
        
        console.log(`✅ Proposal ${proposal.id} executed successfully`);
      } else {
        // Proposal failed
        await this.updateProposalStatus(proposal.id, 'failed', null);
        
        // Slash NO voters (10% penalty)
        await this.slashVoters(proposal.id, false);
        
        console.log(`❌ Proposal ${proposal.id} failed`);
      }
    } catch (error) {
      console.error(`Error executing proposal ${proposal.id}:`, error);
      
      // Retry logic with exponential backoff
      await this.retryProposalExecution(proposal);
    }
  }

  private async executePolicyAction(proposal: any): Promise<string> {
    const policyType = proposal.policy_type;
    const params = proposal.policy_params;

    switch (policyType) {
      case 'MintICU':
        return await this.executeMint(params);
      
      case 'BurnICU':
        return await this.executeBurn(params);
      
      case 'UpdateICR':
        return await this.executeICRUpdate(params);
      
      case 'RebalanceVault':
        return await this.executeRebalance(params);
      
      default:
        throw new Error(`Unknown policy type: ${policyType}`);
    }
  }

  private async executeMint(params: any): Promise<string> {
    // Simulate mint transaction
    // In production, this would interact with the ARU token program
    console.log(`Minting ${params.amount} ARU tokens`);
    
    // Mock transaction signature
    const txSignature = `mint_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Record mint event
    await supabase.from('reserve_events').insert({
      event_type: 'mint',
      amount: params.amount,
      transaction_signature: txSignature,
      timestamp: new Date().toISOString(),
    });
    
    return txSignature;
  }

  private async executeBurn(params: any): Promise<string> {
    // Simulate burn transaction
    console.log(`Burning ${params.amount} ARU tokens`);
    
    const txSignature = `burn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    await supabase.from('reserve_events').insert({
      event_type: 'burn',
      amount: params.amount,
      transaction_signature: txSignature,
      timestamp: new Date().toISOString(),
    });
    
    return txSignature;
  }

  private async executeICRUpdate(params: any): Promise<string> {
    // Simulate ICR update
    console.log(`Updating ICR to ${params.newRate} bps`);
    
    const txSignature = `icr_update_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    await supabase.from('oracle_data').insert({
      source: 'policy_executor',
      data_type: 'icr',
      value: params.newRate,
      timestamp: new Date().toISOString(),
    });
    
    return txSignature;
  }

  private async executeRebalance(params: any): Promise<string> {
    // Simulate vault rebalance
    console.log(`Rebalancing vault: ${params.fromAsset} -> ${params.toAsset}`);
    
    const txSignature = `rebalance_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    await supabase.from('reserve_events').insert({
      event_type: 'rebalance',
      from_asset: params.fromAsset,
      to_asset: params.toAsset,
      amount: params.amount,
      transaction_signature: txSignature,
      timestamp: new Date().toISOString(),
    });
    
    return txSignature;
  }

  private async updateProposalStatus(
    proposalId: number,
    status: string,
    txSignature: string | null
  ) {
    await supabase
      .from('proposals')
      .update({
        status,
        execution_tx: txSignature,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);
  }

  private async recordProposalFee(proposalId: number, proposer: string) {
    await supabase.from('revenue_events').insert({
      revenue_type: 'proposal_fee',
      agent_pubkey: proposer,
      amount_usd: 10, // 10 ARU burned
      amount_icu: 10,
      timestamp: new Date().toISOString(),
      metadata: { proposal_id: proposalId },
    });
  }

  private async slashVoters(proposalId: number, prediction: boolean) {
    // Get voters who voted incorrectly
    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('proposal_id', proposalId)
      .eq('prediction', prediction);

    if (!votes) return;

    // Slash 10% of their stake
    for (const vote of votes) {
      const slashAmount = parseFloat(vote.stake_amount) * 0.1;
      
      await supabase.from('revenue_events').insert({
        revenue_type: 'slashing_penalty',
        agent_pubkey: vote.agent_pubkey,
        amount_usd: slashAmount,
        timestamp: new Date().toISOString(),
        metadata: { proposal_id: proposalId, vote_id: vote.id },
      });
    }
  }

  private async retryProposalExecution(proposal: any, attempt: number = 1) {
    const maxAttempts = 3;
    const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff

    if (attempt >= maxAttempts) {
      console.error(`Failed to execute proposal ${proposal.id} after ${maxAttempts} attempts`);
      
      // Mark as failed
      await this.updateProposalStatus(proposal.id, 'failed', null);
      
      // Send notification (in production, use email/Discord/Slack)
      console.error(`⚠️ ALERT: Proposal ${proposal.id} execution failed permanently`);
      return;
    }

    console.log(`Retrying proposal ${proposal.id} execution in ${backoffMs}ms (attempt ${attempt + 1})`);
    
    setTimeout(async () => {
      try {
        await this.executeProposal(proposal);
      } catch (error) {
        await this.retryProposalExecution(proposal, attempt + 1);
      }
    }, backoffMs);
  }
}
