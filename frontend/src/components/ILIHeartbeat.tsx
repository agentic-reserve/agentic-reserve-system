import { useEffect, useState } from 'react';
import { useAPI } from '../hooks/useAPI';

interface ILIData {
  value: number;
  timestamp: number;
  avgYield: number;
  volatility: number;
  tvl: number;
}

interface Props {
  data: ILIData | null;
  loading: boolean;
}

export function ILIHeartbeat({ data, loading }: Props) {
  const { data: historyData } = useAPI<{ history: Array<{ timestamp: number; ili_value: number }> }>('/ili/history', {
    interval: 60000, // Refresh every minute
  });
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    // Animate heartbeat every 2 seconds
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 300);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-16 bg-gray-200 rounded mb-4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="text-center py-8">
          <p className="text-gray-500">No ILI data available</p>
        </div>
      </div>
    );
  }

  const iliValue = data.value;
  const iliColor = iliValue > 600 ? 'text-green-600' : iliValue > 500 ? 'text-yellow-600' : 'text-red-600';
  const iliBgColor = iliValue > 600 ? 'bg-green-50' : iliValue > 500 ? 'bg-yellow-50' : 'bg-red-50';

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Internet Liquidity Index (ILI)
        </h2>
        <div className={`w-3 h-3 rounded-full ${pulse ? 'scale-150' : 'scale-100'} transition-transform duration-300 ${iliValue > 500 ? 'bg-green-500' : 'bg-red-500'}`}></div>
      </div>

      {/* ILI Value */}
      <div className={`${iliBgColor} rounded-lg p-6 mb-4`}>
        <div className="text-center">
          <div className={`text-5xl font-bold ${iliColor} mb-2`}>
            {iliValue.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">
            Last updated: {new Date(data.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Avg Yield</div>
          <div className="text-lg font-semibold text-gray-900">
            {data.avgYield.toFixed(2)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Volatility</div>
          <div className="text-lg font-semibold text-gray-900">
            {data.volatility.toFixed(2)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">TVL</div>
          <div className="text-lg font-semibold text-gray-900">
            ${(data.tvl / 1e9).toFixed(2)}B
          </div>
        </div>
      </div>

      {/* Mini Chart */}
      {historyData && historyData.history && historyData.history.length > 0 && (
        <div className="border-t pt-4">
          <div className="text-xs text-gray-500 mb-2">24h Trend</div>
          <div className="flex items-end justify-between h-16 gap-1">
            {historyData.history.slice(-24).map((point: any, i: number) => {
              const height = (point.ili_value / Math.max(...historyData.history.map((p: any) => p.ili_value))) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                  style={{ height: `${height}%` }}
                  title={`${point.ili_value.toFixed(2)} at ${new Date(point.timestamp).toLocaleTimeString()}`}
                ></div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
