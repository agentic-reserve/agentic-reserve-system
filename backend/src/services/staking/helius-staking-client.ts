import { Helius } from 'helius-sdk';
import { Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../../config';

interface StakeResult {
  signature: string;
  stakeAccount: string;
  amount: number;
}

interface StakeAccount {
  pubkey: string;
  amount: number;
  activationEpoch: string;
  status: 'active' | 'activating' | 'deactivating' | 'inactive';
  rewards: number;
}

/**
 * Helius Staking Client
 * Programmatic SOL staking with 0% commission Helius validator
 */
export class HeliusStakingClient {
  private helius: Helius;
  private validatorVoteAccount = 'EKgWgpJY5BtX7TeJfhKbqcJT7gzLKFFtj7cjX1XY6CxA'; // Helius validator

  constructor() {
    this.helius = new Helius(config.helius.apiKey);
    console.log('✅ Helius Staking Client initialized');
  }

  /**
   * Stake SOL to Helius validator (0% commission)
   */
  async stakeSOL(payer: Keypair, amountInSol: number): Promise<StakeResult> {
    try {
      console.log(`🔒 Staking ${amountInSol} SOL to Helius validator...`);

      // Create staking transaction
      const { serializedTx, stakeAccountPubkey } = 
        await this.helius.rpc.createStakeTransaction(
          payer.publicKey,
          amountInSol
        );

      // Deserialize and sign transaction
      const transaction = Transaction.from(bs58.decode(serializedTx));
      transaction.partialSign(payer);

      // Send transaction
      const signature = await this.helius.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        }
      );

      // Wait for confirmation
      await this.helius.connection.confirmTransaction(signature, 'confirmed');

      console.log(`✅ Staked ${amountInSol} SOL`);
      console.log(`   Stake Account: ${stakeAccountPubkey}`);
      console.log(`   Transaction: ${signature}`);

      return {
        signature,
        stakeAccount: stakeAccountPubkey,
        amount: amountInSol
      };
    } catch (error) {
      console.error('Staking failed:', error);
      throw error;
    }
  }

  /**
   * Get all stake accounts for a wallet
   */
  async getStakeAccounts(wallet: PublicKey): Promise<StakeAccount[]> {
    try {
      const accounts = await this.helius.rpc.getHeliusStakeAccounts(
        wallet.toBase58()
      );

      return accounts.map(account => {
        const info = account.account.data.parsed.info;
        const delegation = info.stake?.delegation;

        return {
          pubkey: account.pubkey,
          amount: delegation ? delegation.stake / LAMPORTS_PER_SOL : 0,
          activationEpoch: delegation?.activationEpoch || 'N/A',
          status: this.getStakeStatus(info),
          rewards: this.calculateRewards(delegation)
        };
      });
    } catch (error) {
      console.error('Failed to get stake accounts:', error);
      return [];
    }
  }

  /**
   * Deactivate (start unstaking) a stake account
   */
  async unstakeSOL(
    payer: Keypair,
    stakeAccount: string
  ): Promise<string> {
    try {
      console.log(`🔓 Deactivating stake account: ${stakeAccount}`);

      const unstakeTx = await this.helius.rpc.createUnstakeTransaction(
        payer.publicKey,
        stakeAccount
      );

      const transaction = Transaction.from(bs58.decode(unstakeTx));
      transaction.partialSign(payer);

      const signature = await this.helius.connection.sendRawTransaction(
        transaction.serialize()
      );

      await this.helius.connection.confirmTransaction(signature, 'confirmed');

      console.log(`✅ Deactivation started: ${signature}`);
      console.log('   Will be withdrawable next epoch (~2 days)');

      return signature;
    } catch (error) {
      console.error('Unstaking failed:', error);
      throw error;
    }
  }

  /**
   * Check withdrawable amount from deactivated stake
   */
  async getWithdrawableAmount(
    stakeAccount: string,
    includeRent: boolean = true
  ): Promise<number> {
    try {
      const lamports = await this.helius.rpc.getWithdrawableAmount(
        stakeAccount,
        includeRent
      );

      return lamports / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Failed to get withdrawable amount:', error);
      return 0;
    }
  }

  /**
   * Withdraw SOL from deactivated stake account
   */
  async withdrawSOL(
    payer: Keypair,
    stakeAccount: string,
    destination: PublicKey,
    amountInLamports: number
  ): Promise<string> {
    try {
      console.log(`💰 Withdrawing from stake account: ${stakeAccount}`);

      const withdrawTx = await this.helius.rpc.createWithdrawTransaction(
        payer.publicKey,
        stakeAccount,
        destination,
        amountInLamports
      );

      const transaction = Transaction.from(bs58.decode(withdrawTx));
      transaction.partialSign(payer);

      const signature = await this.helius.connection.sendRawTransaction(
        transaction.serialize()
      );

      await this.helius.connection.confirmTransaction(signature, 'confirmed');

      console.log(`✅ Withdrawn ${amountInLamports / LAMPORTS_PER_SOL} SOL`);
      console.log(`   Transaction: ${signature}`);

      return signature;
    } catch (error) {
      console.error('Withdrawal failed:', error);
      throw error;
    }
  }

  /**
   * Get stake instructions for custom transaction building
   */
  async getStakeInstructions(owner: PublicKey, amountInSol: number) {
    return await this.helius.rpc.getStakeInstructions(owner, amountInSol);
  }

  /**
   * Stake using Smart Transactions for better reliability
   */
  async stakeWithSmartTransaction(
    payer: Keypair,
    amountInSol: number
  ): Promise<string> {
    try {
      const { instructions } = await this.getStakeInstructions(
        payer.publicKey,
        amountInSol
      );

      const signature = await this.helius.rpc.sendSmartTransaction(
        instructions,
        [payer],
        {
          skipPreflight: false,
          maxRetries: 3
        }
      );

      console.log(`✅ Smart transaction staked: ${signature}`);
      return signature;
    } catch (error) {
      console.error('Smart transaction staking failed:', error);
      throw error;
    }
  }

  /**
   * Get current epoch info
   */
  async getEpochInfo() {
    return await this.helius.connection.getEpochInfo();
  }

  /**
   * Calculate estimated APY (Solana average ~7%)
   */
  calculateEstimatedAPY(): number {
    return 7.0; // 7% average APY on Solana
  }

  /**
   * Calculate estimated rewards
   */
  calculateEstimatedRewards(stakeAmount: number, days: number): number {
    const apy = this.calculateEstimatedAPY() / 100;
    const dailyRate = apy / 365;
    return stakeAmount * dailyRate * days;
  }

  /**
   * Get stake status
   */
  private getStakeStatus(info: any): 'active' | 'activating' | 'deactivating' | 'inactive' {
    if (!info.stake?.delegation) return 'inactive';
    
    const delegation = info.stake.delegation;
    
    if (delegation.deactivationEpoch !== '18446744073709551615') {
      return 'deactivating';
    }
    
    // Check if activation is complete
    const currentEpoch = Date.now(); // Simplified
    if (delegation.activationEpoch > currentEpoch) {
      return 'activating';
    }
    
    return 'active';
  }

  /**
   * Calculate rewards (simplified)
   */
  private calculateRewards(delegation: any): number {
    if (!delegation) return 0;
    
    // In production, calculate based on epochs and validator performance
    // For now, return 0 as rewards are auto-compounded
    return 0;
  }

  /**
   * Batch stake for multiple agents
   */
  async batchStake(
    wallets: Keypair[],
    amount: number
  ): Promise<StakeResult[]> {
    const results: StakeResult[] = [];

    for (const wallet of wallets) {
      try {
        const result = await this.stakeSOL(wallet, amount);
        results.push(result);
      } catch (error) {
        console.error(`Failed to stake for ${wallet.publicKey.toBase58()}:`, error);
      }
    }

    return results;
  }
}

/**
 * Get Helius staking client instance
 */
let stakingClientInstance: HeliusStakingClient | null = null;

export function getHeliusStakingClient(): HeliusStakingClient {
  if (!stakingClientInstance) {
    stakingClientInstance = new HeliusStakingClient();
  }
  return stakingClientInstance;
}
