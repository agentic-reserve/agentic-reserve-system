import { supabase } from '../supabase';

interface Transaction {
  signature: string;
  wallet_address: string;
  timestamp: number;
  transaction_type: string;
  amount: number;
  token_mint: string;
  counterparty_address?: string;
  fee_amount?: number;
  metadata?: any;
}

interface TransactionRisk {
  signature: string;
  anomalyScore: number;
  isHighRisk: boolean;
  riskFactors: string[];
  flagged: boolean;
}

interface RiskProfile {
  walletAddress: string;
  riskScore: number;
  anomalyCount: number;
  highRiskTransactionPercentage: number;
  counterpartyRisk: number;
  riskFactors: {
    largeTransactions: boolean;
    unusualFrequency: boolean;
    knownMaliciousCounterparty: boolean;
    rapidBalanceChanges: boolean;
  };
  lastAssessment: number;
}

interface Anomaly {
  transactionSignature: string;
  walletAddress: string;
  timestamp: number;
  anomalyType: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  score: number;
}

enum AnomalyType {
  LARGE_AMOUNT = 'large_amount',
  UNUSUAL_FREQUENCY = 'unusual_frequency',
  SUSPICIOUS_COUNTERPARTY = 'suspicious_counterparty',
  RAPID_BALANCE_CHANGE = 'rapid_balance_change',
  UNUSUAL_TIME = 'unusual_time',
  UNKNOWN_TOKEN = 'unknown_token',
}

export class RiskAnalyzer {
  private readonly ANOMALY_THRESHOLD = 70; // Score above 70 is high risk
  private readonly Z_SCORE_THRESHOLD = 3; // 3 standard deviations

  /**
   * Analyze a transaction for anomalies and calculate risk score
   */
  async analyzeTransaction(tx: Transaction): Promise<TransactionRisk> {
    const riskFactors: string[] = [];
    let anomalyScore = 0;

    // Check for large transaction amount (z-score analysis)
    const amountScore = await this.calculateAmountAnomalyScore(
      tx.wallet_address,
      tx.amount,
      tx.token_mint
    );
    if (amountScore > 0) {
      anomalyScore += amountScore;
      riskFactors.push('large_transaction_amount');
    }

    // Check for unusual frequency
    const frequencyScore = await this.calculateFrequencyAnomalyScore(
      tx.wallet_address,
      tx.timestamp
    );
    if (frequencyScore > 0) {
      anomalyScore += frequencyScore;
      riskFactors.push('unusual_transaction_frequency');
    }

    // Check for known malicious counterparty
    if (tx.counterparty_address) {
      const isMalicious = await this.isKnownMaliciousAddress(tx.counterparty_address);
      if (isMalicious) {
        anomalyScore += 50; // High penalty for malicious counterparty
        riskFactors.push('known_malicious_counterparty');
      }
    }

    // Check for unusual time (e.g., 2-5 AM UTC)
    const hour = new Date(tx.timestamp).getUTCHours();
    if (hour >= 2 && hour <= 5) {
      anomalyScore += 10;
      riskFactors.push('unusual_time');
    }

    // Normalize score to 0-100
    anomalyScore = Math.min(100, anomalyScore);

    const isHighRisk = anomalyScore >= this.ANOMALY_THRESHOLD;

    return {
      signature: tx.signature,
      anomalyScore,
      isHighRisk,
      riskFactors,
      flagged: isHighRisk,
    };
  }

  /**
   * Calculate wallet-level risk profile
   */
  async calculateWalletRisk(walletAddress: string): Promise<RiskProfile> {
    // Get all transactions for the wallet
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('timestamp', { ascending: false })
      .limit(1000); // Last 1000 transactions

    if (error) throw error;

    // Get anomalies for this wallet
    const { data: anomalies, error: anomalyError } = await supabase
      .from('anomalies')
      .select('*')
      .eq('wallet_address', walletAddress);

    if (anomalyError) throw anomalyError;

    const totalTransactions = transactions?.length || 0;
    const anomalyCount = anomalies?.length || 0;
    const highRiskCount = anomalies?.filter(a => a.severity === 'high' || a.severity === 'critical').length || 0;

    // Calculate risk factors
    const riskFactors = {
      largeTransactions: false,
      unusualFrequency: false,
      knownMaliciousCounterparty: false,
      rapidBalanceChanges: false,
    };

    // Check for large transactions (> 3 std dev)
    if (transactions && transactions.length > 0) {
      const amounts = transactions.map(t => t.amount || 0);
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(
        amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length
      );
      const hasLargeTransactions = amounts.some(a => Math.abs(a - mean) > 3 * stdDev);
      riskFactors.largeTransactions = hasLargeTransactions;
    }

    // Check for unusual frequency (> 10 transactions in 1 hour)
    if (transactions && transactions.length >= 10) {
      const recentTxs = transactions.slice(0, 10);
      const timeSpan = recentTxs[0].timestamp - recentTxs[9].timestamp;
      if (timeSpan < 60 * 60 * 1000) {
        // Less than 1 hour
        riskFactors.unusualFrequency = true;
      }
    }

    // Check for known malicious counterparties
    const counterparties = transactions?.map(t => t.counterparty_address).filter(Boolean) || [];
    for (const counterparty of counterparties) {
      if (await this.isKnownMaliciousAddress(counterparty!)) {
        riskFactors.knownMaliciousCounterparty = true;
        break;
      }
    }

    // Calculate overall risk score (0-100)
    let riskScore = 0;
    if (totalTransactions > 0) {
      riskScore += (anomalyCount / totalTransactions) * 40; // 40% weight
      riskScore += (highRiskCount / totalTransactions) * 60; // 60% weight
    }

    // Add risk factor penalties
    if (riskFactors.largeTransactions) riskScore += 10;
    if (riskFactors.unusualFrequency) riskScore += 15;
    if (riskFactors.knownMaliciousCounterparty) riskScore += 25;

    riskScore = Math.min(100, riskScore);

    const highRiskPercentage = totalTransactions > 0 ? (highRiskCount / totalTransactions) * 100 : 0;
    const counterpartyRisk = riskFactors.knownMaliciousCounterparty ? 100 : 0;

    // Store risk profile
    await supabase.from('risk_profiles').upsert({
      wallet_address: walletAddress,
      risk_score: riskScore,
      anomaly_count: anomalyCount,
      high_risk_transaction_percentage: highRiskPercentage,
      counterparty_risk: counterpartyRisk,
      risk_factors: riskFactors,
      last_assessment: Date.now(),
    });

    return {
      walletAddress,
      riskScore,
      anomalyCount,
      highRiskTransactionPercentage: highRiskPercentage,
      counterpartyRisk,
      riskFactors,
      lastAssessment: Date.now(),
    };
  }

  /**
   * Detect anomalies for a wallet
   */
  async detectAnomalies(walletAddress: string): Promise<Anomaly[]> {
    const { data: anomalies, error } = await supabase
      .from('anomalies')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    return (anomalies || []).map(a => ({
      transactionSignature: a.transaction_signature,
      walletAddress: a.wallet_address,
      timestamp: a.timestamp,
      anomalyType: a.anomaly_type as AnomalyType,
      severity: a.severity as 'low' | 'medium' | 'high' | 'critical',
      description: a.description,
      score: a.score,
    }));
  }

  /**
   * Flag transaction and store anomaly
   */
  async flagTransaction(
    tx: Transaction,
    risk: TransactionRisk,
    anomalyType: AnomalyType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string
  ): Promise<void> {
    await supabase.from('anomalies').insert({
      transaction_signature: tx.signature,
      wallet_address: tx.wallet_address,
      anomaly_type: anomalyType,
      severity,
      description,
      score: risk.anomalyScore,
      timestamp: tx.timestamp,
    });
  }

  /**
   * Calculate anomaly score based on transaction amount (z-score)
   */
  private async calculateAmountAnomalyScore(
    walletAddress: string,
    amount: number,
    tokenMint: string
  ): Promise<number> {
    // Get historical transactions for this wallet and token
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('amount')
      .eq('wallet_address', walletAddress)
      .eq('token_mint', tokenMint)
      .limit(100);

    if (error || !transactions || transactions.length < 10) {
      return 0; // Not enough data
    }

    const amounts = transactions.map(t => t.amount || 0);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length
    );

    if (stdDev === 0) return 0;

    const zScore = Math.abs((amount - mean) / stdDev);

    if (zScore > this.Z_SCORE_THRESHOLD) {
      return Math.min(40, zScore * 10); // Cap at 40 points
    }

    return 0;
  }

  /**
   * Calculate anomaly score based on transaction frequency
   */
  private async calculateFrequencyAnomalyScore(
    walletAddress: string,
    timestamp: number
  ): Promise<number> {
    const oneHourAgo = timestamp - 60 * 60 * 1000;

    const { data: recentTxs, error } = await supabase
      .from('wallet_transactions')
      .select('signature')
      .eq('wallet_address', walletAddress)
      .gte('timestamp', oneHourAgo)
      .lte('timestamp', timestamp);

    if (error) return 0;

    const txCount = recentTxs?.length || 0;

    // Flag if > 20 transactions in 1 hour
    if (txCount > 20) {
      return Math.min(30, txCount); // Cap at 30 points
    }

    return 0;
  }

  /**
   * Check if address is known to be malicious
   */
  private async isKnownMaliciousAddress(address: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('malicious_addresses')
      .select('address')
      .eq('address', address)
      .single();

    return !error && data !== null;
  }
}

// Export singleton instance
export const riskAnalyzer = new RiskAnalyzer();
