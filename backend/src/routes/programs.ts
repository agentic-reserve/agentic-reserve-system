/**
 * Smart Contract Programs Routes
 */

import { Router } from 'express';
import { solanaProgramsService } from '../services/solana-programs';

const router = Router();

/**
 * GET /programs/status
 * Check if all programs are deployed and initialized
 */
router.get('/status', async (req, res) => {
  try {
    const status = await solanaProgramsService.checkProgramsStatus();
    const info = await solanaProgramsService.getProgramsInfo();
    
    res.json({
      status: 'ok',
      programs: {
        core: {
          ...info.core,
          initialized: status.core,
        },
        reserve: {
          ...info.reserve,
          initialized: status.reserve,
        },
        token: {
          ...info.token,
          initialized: status.token,
        },
      },
      allInitialized: status.core && status.reserve && status.token,
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to check programs status',
      message: error.message 
    });
  }
});

/**
 * GET /programs/core/state
 * Get GlobalState from ars_core
 */
router.get('/core/state', async (req, res) => {
  try {
    const state = await solanaProgramsService.getGlobalState();
    
    if (!state) {
      return res.status(404).json({ 
        error: 'GlobalState not found',
        message: 'Program may not be initialized yet'
      });
    }
    
    res.json({ state });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch GlobalState',
      message: error.message 
    });
  }
});

/**
 * GET /programs/reserve/vault
 * Get Vault state from ars_reserve
 */
router.get('/reserve/vault', async (req, res) => {
  try {
    const vault = await solanaProgramsService.getReserveVault();
    
    if (!vault) {
      return res.status(404).json({ 
        error: 'Vault not found',
        message: 'Program may not be initialized yet'
      });
    }
    
    res.json({ vault });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch Vault',
      message: error.message 
    });
  }
});

/**
 * GET /programs/token/mint
 * Get Token mint info from ars_token
 */
router.get('/token/mint', async (req, res) => {
  try {
    const mint = await solanaProgramsService.getTokenMint();
    
    if (!mint) {
      return res.status(404).json({ 
        error: 'Token mint not found',
        message: 'Program may not be initialized yet'
      });
    }
    
    res.json({ mint });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch Token mint',
      message: error.message 
    });
  }
});

export default router;
