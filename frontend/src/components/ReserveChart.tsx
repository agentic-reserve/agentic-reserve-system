interface Asset {
  symbol: string;
  amount: number;
  valueUsd: number;
  percentage: number;
}

interface ReserveData {
  vault: {
    vhr: number;
    totalValue: number;
    liabilities: number;
    assets: Asset[];
    lastRebalance: number;
    circuitBreakerActive: boolean;
  };
}

interface Props {
  data: ReserveData | null;
  loading: boolean;
}

export function ReserveChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-48 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!data || !data.vault || data.vault.assets.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Reserve Vault
        </h2>
        <div className="text-center py-8">
          <p className="text-gray-500">No reserve data available</p>
        </div>
      </div>
    );
  }

  const { vault } = data;
  const vhrColor = vault.vhr >= 150 ? 'text-green-600' : vault.vhr >= 130 ? 'text-yellow-600' : 'text-red-600';
  const vhrBgColor = vault.vhr >= 150 ? 'bg-green-50' : vault.vhr >= 130 ? 'bg-yellow-50' : 'bg-red-50';

  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500'];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Reserve Vault
        </h2>
        <div className={`px-3 py-1 rounded-full ${vhrBgColor}`}>
          <span className={`text-sm font-semibold ${vhrColor}`}>
            VHR: {vault.vhr.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Circuit Breaker Warning */}
      {vault.circuitBreakerActive && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm font-medium text-red-800">
            ⚠️ Circuit Breaker Active
          </div>
          <div className="text-xs text-red-600 mt-1">
            VHR below 150% - minting and withdrawals paused
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Total Value</div>
          <div className="text-2xl font-bold text-gray-900">
            ${(vault.totalValue / 1e6).toFixed(2)}M
          </div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Liabilities</div>
          <div className="text-2xl font-bold text-gray-900">
            ${(vault.liabilities / 1e6).toFixed(2)}M
          </div>
        </div>
      </div>

      {/* Composition Bar */}
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Asset Composition
        </div>
        <div className="flex h-8 rounded-lg overflow-hidden">
          {vault.assets.map((asset, i) => (
            <div
              key={i}
              className={`${colors[i % colors.length]} flex items-center justify-center text-white text-xs font-medium`}
              style={{ width: `${asset.percentage}%` }}
              title={`${asset.symbol}: ${asset.percentage.toFixed(2)}%`}
            >
              {asset.percentage > 10 && asset.symbol}
            </div>
          ))}
        </div>
      </div>

      {/* Asset List */}
      <div className="space-y-2">
        {vault.assets.map((asset, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`}></div>
              <span className="font-medium text-gray-900">{asset.symbol}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                ${(asset.valueUsd / 1e6).toFixed(2)}M
              </div>
              <div className="text-xs text-gray-500">
                {asset.percentage.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Last Rebalance */}
      <div className="mt-4 pt-4 border-t text-xs text-gray-500">
        Last rebalance: {new Date(vault.lastRebalance).toLocaleString()}
      </div>
    </div>
  );
}
