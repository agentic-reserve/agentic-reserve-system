import cron from 'node-cron';
import { pnlCalculator } from '../services/memory/pnl-calculator';

/**
 * Cron job to update PnL calculations every 10 minutes
 * Schedule: every 10 minutes
 */
export function startPnLUpdater(): void {
  console.log('Starting PnL updater cron job (every 10 minutes)...');

  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log('[PnL Updater] Running scheduled PnL calculation...');
      await pnlCalculator.calculateAllWallets();
      console.log('[PnL Updater] PnL calculation completed successfully');
    } catch (error) {
      console.error('[PnL Updater] Error during PnL calculation:', error);
    }
  });

  console.log('PnL updater cron job started');
}
