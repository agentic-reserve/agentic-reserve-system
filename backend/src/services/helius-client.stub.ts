/**
 * Helius Client Stub for Production Build
 * This is a minimal stub to allow compilation without helius-sdk
 */

import { Connection } from '@solana/web3.js';
import { config } from '../config';

export function getHeliusClient(): Connection {
  // Return standard Solana connection for production build
  return new Connection(config.solana.rpcUrl, 'confirmed');
}

export const heliusClient = getHeliusClient();
