/**
 * Solana Programs Service
 * Interacts with deployed ARS smart contracts
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { config } from '../config';

// Program IDs (from environment variables)
export const PROGRAM_IDS = {
  ARS_CORE: new PublicKey(config.solana.programs.arsCore),
  ARS_RESERVE: new PublicKey(config.solana.programs.arsReserve),
  ARS_TOKEN: new PublicKey(config.solana.programs.arsToken),
};

export class SolanaProgramsService {
  private connection: Connection;
  private provider?: AnchorProvider;

  constructor() {
    this.connection = new Connection(
      config.solana.rpcUrl,
      'confirmed'
    );
  }

  /**
   * Initialize provider with wallet
   */
  initProvider(wallet: Wallet) {
    this.provider = new AnchorProvider(
      this.connection,
      wallet,
      { commitment: 'confirmed' }
    );
  }

  /**
   * Get ARS Core program account (GlobalState)
   */
  async getGlobalState(): Promise<any> {
    try {
      // PDA for GlobalState: seeds = ["global_state"]
      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')],
        PROGRAM_IDS.ARS_CORE
      );

      const accountInfo = await this.connection.getAccountInfo(globalStatePDA);
      
      if (!accountInfo) {
        console.log('GlobalState not initialized yet');
        return null;
      }

      // Parse account data (simplified - would use IDL in production)
      const data = accountInfo.data;
      
      return {
        address: globalStatePDA.toBase58(),
        initialized: true,
        data: data.toString('base64'),
      };
    } catch (error) {
      console.error('Error fetching GlobalState:', error);
      return null;
    }
  }

  /**
   * Get Reserve Vault state
   */
  async getReserveVault(): Promise<any> {
    try {
      // PDA for Vault: seeds = ["vault"]
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        PROGRAM_IDS.ARS_RESERVE
      );

      const accountInfo = await this.connection.getAccountInfo(vaultPDA);
      
      if (!accountInfo) {
        console.log('Vault not initialized yet');
        return null;
      }

      return {
        address: vaultPDA.toBase58(),
        initialized: true,
        data: accountInfo.data.toString('base64'),
      };
    } catch (error) {
      console.error('Error fetching Vault:', error);
      return null;
    }
  }

  /**
   * Get ARU Token mint info
   */
  async getTokenMint(): Promise<any> {
    try {
      // PDA for Mint: seeds = ["mint"]
      const [mintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint')],
        PROGRAM_IDS.ARS_TOKEN
      );

      const accountInfo = await this.connection.getAccountInfo(mintPDA);
      
      if (!accountInfo) {
        console.log('Token mint not initialized yet');
        return null;
      }

      return {
        address: mintPDA.toBase58(),
        initialized: true,
        data: accountInfo.data.toString('base64'),
      };
    } catch (error) {
      console.error('Error fetching Token mint:', error);
      return null;
    }
  }

  /**
   * Check if programs are initialized
   */
  async checkProgramsStatus(): Promise<{
    core: boolean;
    reserve: boolean;
    token: boolean;
  }> {
    const [core, reserve, token] = await Promise.all([
      this.getGlobalState(),
      this.getReserveVault(),
      this.getTokenMint(),
    ]);

    return {
      core: core !== null,
      reserve: reserve !== null,
      token: token !== null,
    };
  }

  /**
   * Get program accounts info
   */
  async getProgramsInfo(): Promise<any> {
    const [coreInfo, reserveInfo, tokenInfo] = await Promise.all([
      this.connection.getAccountInfo(PROGRAM_IDS.ARS_CORE),
      this.connection.getAccountInfo(PROGRAM_IDS.ARS_RESERVE),
      this.connection.getAccountInfo(PROGRAM_IDS.ARS_TOKEN),
    ]);

    return {
      core: {
        programId: PROGRAM_IDS.ARS_CORE.toBase58(),
        deployed: coreInfo !== null,
        executable: coreInfo?.executable || false,
        owner: coreInfo?.owner.toBase58(),
      },
      reserve: {
        programId: PROGRAM_IDS.ARS_RESERVE.toBase58(),
        deployed: reserveInfo !== null,
        executable: reserveInfo?.executable || false,
        owner: reserveInfo?.owner.toBase58(),
      },
      token: {
        programId: PROGRAM_IDS.ARS_TOKEN.toBase58(),
        deployed: tokenInfo !== null,
        executable: tokenInfo?.executable || false,
        owner: tokenInfo?.owner.toBase58(),
      },
    };
  }
}

// Singleton instance
export const solanaProgramsService = new SolanaProgramsService();
