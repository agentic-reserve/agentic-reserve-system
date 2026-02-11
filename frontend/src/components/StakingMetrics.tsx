import { useAPI } from '../hooks/useAPI';

export function StakingMetrics() {
  const { data: distributions } = useAPI<{ distributions: any[] }>('/revenue/distributions');

  // Mock staking data - in production, this would come from an API
  const stakingData = {
    totalStaked: 1250000,
    stakingAPY: 124.5,
    rewardsPool: 45000,
    icuBurned: 5000,
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Staking Metrics
        </h2>
        <div className="px-3 py-1 bg-purple-50 rounded-full">
          <span className="text-sm font-semibold text-purple-600">
            {stakingData.stakingAPY.toFixed(1)}% APY
          </span>
        </div>
      </div>

      {/* Staking Stats */}
      <div className="space-y-4 mb-6">
        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Total ARU Staked</div>
          <div className="text-2xl font-bold text-purple-600">
            {(stakingData.totalStaked / 1000).toFixed(0)}K ARU
          </div>
          <div className="text-xs text-gray-500 mt-1">
            50% fee discount active
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Rewards Pool</div>
            <div className="text-lg font-bold text-gray-900">
              {(stakingData.rewardsPool / 1000).toFixed(1)}K ARU
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">ARU Burned</div>
            <div className="text-lg font-bold text-gray-900">
              {(stakingData.icuBurned / 1000).toFixed(1)}K ARU
            </div>
          </div>
        </div>
      </div>

      {/* Distribution Breakdown */}
      <div className="mb-6">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Revenue Distribution
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">Buyback & Burn</span>
            </div>
            <span className="text-sm font-medium text-gray-900">40%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-sm text-gray-600">Staking Rewards</span>
            </div>
            <span className="text-sm font-medium text-gray-900">30%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Development</span>
            </div>
            <span className="text-sm font-medium text-gray-900">20%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-gray-600">Insurance Fund</span>
            </div>
            <span className="text-sm font-medium text-gray-900">10%</span>
          </div>
        </div>
      </div>

      {/* Recent Distributions */}
      {distributions && distributions.distributions.length > 0 && (
        <div className="pt-4 border-t">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Recent Distributions
          </div>
          <div className="space-y-2">
            {distributions.distributions.slice(0, 3).map((dist, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {new Date(dist.distribution_date).toLocaleDateString()}
                </span>
                <span className="font-medium text-gray-900">
                  ${dist.total_revenue.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
