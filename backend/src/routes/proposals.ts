import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';

const router = Router();

// GET /proposals - List proposals with optional filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status as string);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch proposals' });
    }

    const response = {
      proposals: data.map((row) => ({
        id: row.id,
        proposer: row.proposer,
        policyType: row.policy_type,
        policyParams: row.policy_params,
        startTime: row.start_time,
        endTime: row.end_time,
        yesStake: row.yes_stake,
        noStake: row.no_stake,
        status: row.status,
        proposalFee: row.proposal_fee,
      })),
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /proposals/:id - Get proposal details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (proposalError || !proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Get votes
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('*')
      .eq('proposal_id', id);

    if (votesError) {
      return res.status(500).json({ error: 'Failed to fetch votes' });
    }

    const totalStake = BigInt(proposal.yes_stake || '0') + BigInt(proposal.no_stake || '0');
    const yesPercentage = totalStake > 0n
      ? Number((BigInt(proposal.yes_stake || '0') * 10000n) / totalStake) / 100
      : 0;
    const noPercentage = totalStake > 0n
      ? Number((BigInt(proposal.no_stake || '0') * 10000n) / totalStake) / 100
      : 0;

    const response = {
      proposal: {
        id: proposal.id,
        proposer: proposal.proposer,
        policyType: proposal.policy_type,
        policyParams: proposal.policy_params,
        startTime: proposal.start_time,
        endTime: proposal.end_time,
        yesStake: proposal.yes_stake,
        noStake: proposal.no_stake,
        status: proposal.status,
        executionTx: proposal.execution_tx,
        proposalFee: proposal.proposal_fee,
      },
      votes: votes.map((v) => ({
        agentPubkey: v.agent_pubkey,
        agentType: v.agent_type,
        stakeAmount: v.stake_amount,
        prediction: v.prediction,
        timestamp: v.timestamp,
        claimed: v.claimed,
      })),
      currentConsensus: {
        yesPercentage,
        noPercentage,
        totalStake: totalStake.toString(),
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching proposal details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
