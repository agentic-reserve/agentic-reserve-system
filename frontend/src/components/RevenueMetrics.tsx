import { useAPI } from '../hooks/useAPI';

interface RevenueData {
  daily: string;
  monthly: string;
  annual: string;
  agentCount: number;
  avgFeePerAgent: string;
}

interface Props {
  data: RevenueData | null;
  loading: boolean;
}

export function RevenueMetrics({ data, loading }: Props) {
  const { data: breakdown } = useAPI<{ breakdown: Record<string, number> }>('/revenue/breakdown');
  const { data: projections } = useAPI<any>('/revenue/projections');

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="text-center py-8">
          <p className="text-gray-500">No revenue data available</p>
        </div>
      </div>
    );
  }

  const dailyRevenue = parseFloat(data.daily);
  const monthlyRevenue = parseFloat(data.monthly);
  const annualRevenue = parseFloat(data.annual);
  const avgRevenuePerAgent = parseFloat(data.avgFeePerAgent);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Protocol Revenue
        </h2>
        <div className="text-xs text-gray-500">
          {data.agentCount} agents
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="space-y-4 mb-6">
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Daily Revenue</div>
          <div className="text-2xl font-bold text-green-600">
            ${dailyRevenue.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ${avgRevenuePerAgent.toFixed(2)} per agent
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Monthly</div>
            <div className="text-lg font-bold text-gray-900">
              ${(monthlyRevenue / 1000).toFixed(1)}K
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Annual</div>
            <div className="text-lg font-bold text-gray-900">
              ${(annualRevenue / 1000).toFixed(1)}K
            </div>
          </div>
        </div>
      </div>

      {/* Fee Breakdown */}
      {breakdown && (
        <div className="mb-6">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Fee Breakdown
          </div>
          <div className="space-y-2">
            {Object.entries(breakdown.breakdown).map(([type, amount]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 capitalize">
                  {type.replace(/_/g, ' ')}
                </span>
                <span className="font-medium text-gray-900">
                  ${amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projections */}
      {projections && (
        <div className="pt-4 border-t">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Revenue Projections
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">At 100 agents</span>
              <span className="font-medium text-gray-900">
                ${(projections.at100Agents.annualRevenue / 1000).toFixed(0)}K/yr
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">At 1,000 agents</span>
              <span className="font-medium text-gray-900">
                ${(projections.at1000Agents.annualRevenue / 1e6).toFixed(1)}M/yr
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">At 10,000 agents</span>
              <span className="font-medium text-green-600">
                ${(projections.at10000Agents.annualRevenue / 1e6).toFixed(1)}M/yr
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
