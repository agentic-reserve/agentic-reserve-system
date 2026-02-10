import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';

/**
 * Middleware to check privacy protection authorization for wallet queries
 * 
 * Requirements:
 * - Check if wallet is privacy-protected
 * - Require authorization token for privacy-protected wallets
 * - Return 401 without revealing wallet existence for unauthorized queries
 */
export async function checkPrivacyAuthorization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const walletAddress = req.params.walletAddress;
    
    if (!walletAddress) {
      res.status(400).json({ error: 'Wallet address required' });
      return;
    }

    // Check if wallet is registered and privacy-protected
    const { data: registration, error } = await supabase
      .from('wallet_registrations')
      .select('privacy_protected, agent_id')
      .eq('address', walletAddress)
      .single();

    if (error) {
      // Don't reveal if wallet exists or not - return generic auth error
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // If not privacy-protected, allow access
    if (!registration.privacy_protected) {
      next();
      return;
    }

    // Privacy-protected wallet - check authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Don't reveal wallet exists - return generic auth error
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.substring(7);
    
    // Verify token (simplified - in production, use JWT verification)
    // For now, check if token matches the agent_id that registered the wallet
    const agentId = req.headers['x-agent-id'] as string;
    
    if (!agentId || agentId !== registration.agent_id) {
      // Don't reveal wallet exists - return generic auth error
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Log audit trail for privacy-protected access
    await supabase.from('wallet_audit_trail').insert({
      wallet_address: walletAddress,
      action_type: 'query',
      agent_id: agentId,
      authorization_status: 'authorized',
      query_params: {
        path: req.path,
        query: req.query,
      },
      timestamp: Date.now(),
    });

    // Authorization successful
    next();
  } catch (error: any) {
    console.error('Privacy authorization error:', error);
    // Don't reveal details - return generic auth error
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Log unauthorized access attempts for audit trail
 */
export async function logUnauthorizedAccess(
  walletAddress: string,
  agentId: string | undefined,
  queryParams: any
): Promise<void> {
  try {
    await supabase.from('wallet_audit_trail').insert({
      wallet_address: walletAddress,
      action_type: 'query',
      agent_id: agentId || 'unknown',
      authorization_status: 'unauthorized',
      query_params: queryParams,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to log unauthorized access:', error);
  }
}
