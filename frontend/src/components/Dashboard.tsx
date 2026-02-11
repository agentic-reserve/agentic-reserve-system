import { useEffect, useState } from 'react';
import { ILIHeartbeat } from './ILIHeartbeat';
import { ICRDisplay } from './ICRDisplay';
import { ReserveChart } from './ReserveChart';
import { RevenueMetrics } from './RevenueMetrics';
import { StakingMetrics } from './StakingMetrics';
import { OracleStatus } from './OracleStatus';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAPI } from '../hooks/useAPI';

export function Dashboard() {
  const { data: iliData, loading: iliLoading } = useAPI('/ili/current');
  const { data: icrData, loading: icrLoading } = useAPI('/icr/current');
  const { data: reserveData, loading: reserveLoading } = useAPI('/reserve/state');
  const { data: revenueData, loading: revenueLoading } = useAPI('/revenue/current');
  
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    // Subscribe to real-time updates
    subscribe('ili');
    subscribe('reserve');
    subscribe('revenue');

    return () => {
      unsubscribe('ili');
      unsubscribe('reserve');
      unsubscribe('revenue');
    };
  }, [subscribe, unsubscribe]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Agentic Reserve System Dashboard
        </h1>
        <p className="text-gray-600">
          Real-time monitoring of the Internet of Agents macro layer
        </p>
      </div>

      {/* Top Row - ILI and ICR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ILIHeartbeat data={iliData} loading={iliLoading} />
        <ICRDisplay data={icrData} loading={icrLoading} />
      </div>

      {/* Middle Row - Reserve and Oracle Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ReserveChart data={reserveData} loading={reserveLoading} />
        </div>
        <OracleStatus />
      </div>

      {/* Bottom Row - Revenue and Staking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueMetrics data={revenueData} loading={revenueLoading} />
        <StakingMetrics />
      </div>
    </div>
  );
}
