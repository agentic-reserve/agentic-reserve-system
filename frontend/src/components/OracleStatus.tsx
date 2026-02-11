import { useState, useEffect } from 'react';

interface OracleHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastUpdate: Date;
  uptime: number;
}

export function OracleStatus() {
  const [oracles, setOracles] = useState<OracleHealth[]>([
    { name: 'Pyth', status: 'healthy', lastUpdate: new Date(), uptime: 99.9 },
    { name: 'Switchboard', status: 'healthy', lastUpdate: new Date(), uptime: 99.5 },
    { name: 'Birdeye', status: 'healthy', lastUpdate: new Date(), uptime: 98.8 },
  ]);

  useEffect(() => {
    // Simulate oracle health updates
    const interval = setInterval(() => {
      setOracles(prev => prev.map(oracle => ({
        ...oracle,
        lastUpdate: new Date(),
      })));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'down':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const allHealthy = oracles.every(o => o.status === 'healthy');

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Oracle Status
        </h2>
        <div className={`w-3 h-3 rounded-full ${allHealthy ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
      </div>

      {/* Overall Status */}
      <div className={`p-4 rounded-lg mb-6 ${allHealthy ? 'bg-green-50' : 'bg-yellow-50'}`}>
        <div className="text-center">
          <div className={`text-2xl font-bold ${allHealthy ? 'text-green-600' : 'text-yellow-600'} mb-1`}>
            {allHealthy ? 'All Systems Operational' : 'Degraded Performance'}
          </div>
          <div className="text-xs text-gray-600">
            {oracles.filter(o => o.status === 'healthy').length}/{oracles.length} oracles healthy
          </div>
        </div>
      </div>

      {/* Oracle List */}
      <div className="space-y-3">
        {oracles.map((oracle, i) => (
          <div key={i} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(oracle.status)}`}></div>
                <span className="font-medium text-gray-900">{oracle.name}</span>
              </div>
              <span className={`text-xs font-medium ${getStatusText(oracle.status)} capitalize`}>
                {oracle.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Updated {Math.floor((Date.now() - oracle.lastUpdate.getTime()) / 1000)}s ago
              </span>
              <span>
                {oracle.uptime}% uptime
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Health Check Info */}
      <div className="mt-6 pt-4 border-t">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center justify-between">
            <span>Median Calculation</span>
            <span className="font-medium text-green-600">Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Outlier Detection</span>
            <span className="font-medium text-green-600">Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Confidence Interval</span>
            <span className="font-medium text-gray-900">±2σ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
