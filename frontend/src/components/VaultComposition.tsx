import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useAPI } from '../hooks/useAPI';

export default function VaultComposition() {
  const { data, loading, error } = useAPI('/reserve/state');

  if (loading) return <div className="text-center py-8">Loading vault data...</div>;
  if (error) return <div className="text-red-500 py-8">Error: {error}</div>;

  const vault = data?.vault;
  if (!vault) return null;

  const assets = [
    { name: 'USDC', value: vault.usdc_amount, color: '#3b82f6' },
    { name: 'SOL', value: vault.sol_amount, color: '#10b981' },
    { name: 'mSOL', value: vault.msol_amount, color: '#f59e0b' }
  ];

  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
  const vhrColor = vault.vhr >= 200 ? 'text-green-600' : vault.vhr >= 150 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6">Vault Composition</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={assets}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {assets.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Total Value</div>
              <div className="text-3xl font-bold">${totalValue.toLocaleString()}</div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Vault Health Ratio</div>
              <div className={`text-3xl font-bold ${vhrColor}`}>
                {vault.vhr.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {vault.vhr >= 200 ? '✓ Excellent' : vault.vhr >= 150 ? '⚠ Acceptable' : '✗ Critical'}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Liabilities</div>
              <div className="text-2xl font-bold">${vault.liabilities.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          {assets.map(asset => (
            <div key={asset.name} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{asset.name}</span>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }} />
              </div>
              <div className="text-2xl font-bold">${asset.value.toLocaleString()}</div>
              <div className="text-sm text-gray-600">
                {((asset.value / totalValue) * 100).toFixed(1)}% of vault
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
