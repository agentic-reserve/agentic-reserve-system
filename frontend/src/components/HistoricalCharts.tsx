import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAPI } from '../hooks/useAPI';

interface DateRange {
  start: string;
  end: string;
}

export default function HistoricalCharts() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const { data: iliData } = useAPI(`/ili/history?start=${dateRange.start}&end=${dateRange.end}`);
  const { data: icrData } = useAPI(`/icr/history?start=${dateRange.start}&end=${dateRange.end}`);
  const { data: vhrData } = useAPI(`/reserve/history?start=${dateRange.start}&end=${dateRange.end}`);

  const formatData = (data: any[], valueKey: string) => {
    if (!data) return [];
    return data.map(item => ({
      timestamp: new Date(item.timestamp).toLocaleDateString(),
      value: item[valueKey]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Date Range</h2>
        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        
        <div className="flex space-x-2 mt-4">
          <button
            onClick={() => setDateRange({
              start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0]
            })}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            24H
          </button>
          <button
            onClick={() => setDateRange({
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0]
            })}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            7D
          </button>
          <button
            onClick={() => setDateRange({
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0]
            })}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            30D
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4">Internet Liquidity Index (ILI)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formatData(iliData?.history, 'ili_value')}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" name="ILI" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4">Internet Credit Rate (ICR)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formatData(icrData?.history, 'icr_value')}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#10b981" name="ICR %" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4">Vault Health Ratio (VHR)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formatData(vhrData?.history, 'vhr')}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#f59e0b" name="VHR %" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
