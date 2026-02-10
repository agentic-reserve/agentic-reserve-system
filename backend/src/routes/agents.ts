import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';

const router = Router();

// GET /agents/:pubkey/fees - Agent fee history
router.get('/:pubkey/fees', async (req: Request, res: Response) => {
  try {
    const { pubkey } = req.params;

    const { data, error } = await supabase
      .from('agent_transactions')
      .select('*')
      .eq('agent_pubkey', pubkey)
      .order('timestamp', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch agent fees' });
    }

    const totalFees = data.reduce((sum, tx) => sum + parseFloat(tx.fee_amount || '0'), 0);

    res.json({
      agentPubkey: pubkey,
      totalFees,
      transactions: data.map((tx) => ({
        transactionType: tx.transaction_type,
        protocol: tx.protocol,
        asset: tx.asset,
        amount: parseFloat(tx.amount || '0'),
        feeAmount: parseFloat(tx.fee_amount || '0'),
        timestamp: tx.timestamp,
        success: tx.success,
      })),
    });
  } catch (error) {
    console.error('Error fetching agent fees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /agents/:pubkey/staking - Staking status and rewards
router.get('/:pubkey/staking', async (req: Request, res: Response) => {
  try {
    const { pubkey } = req.params;

    const { data, error } = await supabase
      .from('agent_staking')
      .select('*')
      .eq('agent_pubkey', pubkey)
      .is('staking_end', null)
      .single();

    if (error || !data) {
      return res.json({
        agentPubkey: pubkey,
        isStaking: false,
        stakedAmount: 0,
        rewardsClaimed: 0,
        feeDiscountActive: false,
      });
    }

    // Calculate pending rewards (simplified)
    const stakingDays = Math.floor(
      (Date.now() - new Date(data.staking_start).getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyRewardRate = 0.001; // 0.1% daily
    const pendingRewards = parseFloat(data.staked_icu) * dailyRewardRate * stakingDays;

    res.json({
      agentPubkey: pubkey,
      isStaking: true,
      stakedAmount: parseFloat(data.staked_icu),
      rewardsClaimed: parseFloat(data.rewards_claimed || '0'),
      pendingRewards,
      feeDiscountActive: data.fee_discount_active,
      stakingStart: data.staking_start,
    });
  } catch (error) {
    console.error('Error fetching staking status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /agents/:pubkey/stake - Stake ARU tokens
router.post('/:pubkey/stake', async (req: Request, res: Response) => {
  try {
    const { pubkey } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid stake amount' });
    }

    // Check if already staking
    const { data: existing } = await supabase
      .from('agent_staking')
      .select('*')
      .eq('agent_pubkey', pubkey)
      .is('staking_end', null)
      .single();

    if (existing) {
      // Update existing stake
      const { error } = await supabase
        .from('agent_staking')
        .update({
          staked_icu: (parseFloat(existing.staked_icu) + amount).toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        return res.status(500).json({ error: 'Failed to update stake' });
      }
    } else {
      // Create new stake
      const { error } = await supabase
        .from('agent_staking')
        .insert({
          agent_pubkey: pubkey,
          staked_icu: amount.toString(),
          staking_start: new Date().toISOString(),
          fee_discount_active: true,
        });

      if (error) {
        return res.status(500).json({ error: 'Failed to create stake' });
      }
    }

    res.json({ success: true, message: 'Stake successful', amount });
  } catch (error) {
    console.error('Error staking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /agents/:pubkey/claim - Claim staking rewards
router.post('/:pubkey/claim', async (req: Request, res: Response) => {
  try {
    const { pubkey } = req.params;

    const { data, error } = await supabase
      .from('agent_staking')
      .select('*')
      .eq('agent_pubkey', pubkey)
      .is('staking_end', null)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No active staking found' });
    }

    // Calculate rewards
    const stakingDays = Math.floor(
      (Date.now() - new Date(data.staking_start).getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyRewardRate = 0.001;
    const rewards = parseFloat(data.staked_icu) * dailyRewardRate * stakingDays;

    // Update claimed rewards
    const { error: updateError } = await supabase
      .from('agent_staking')
      .update({
        rewards_claimed: (parseFloat(data.rewards_claimed || '0') + rewards).toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to claim rewards' });
    }

    res.json({ success: true, rewardsClaimed: rewards });
  } catch (error) {
    console.error('Error claiming rewards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
