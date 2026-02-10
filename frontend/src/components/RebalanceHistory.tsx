import { useAPI } from '../hooks/useAPI';

interface RebalanceEvent {
  id: string;
  timestamp: string;
  from_asset: string;
  to_asset: string;
  amount: number;
  reason: string;
  vhr_before: number;
  vhr_after: number;
  transaction_signature: string;
}

export default function RebalanceHistory() {
  const { data, loading, error } = useAPI<{ events: RebalanceEvent[] }>('/reserve/rebalance-history');

  if (loading) return <div className="text-center py-8">Loading rebalance history...</div>;
  if (error) return <div className="text-red-500 py-8">Error: {error}</div>;

  const events = data?.events || [];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Rebalance History</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">VHR Impact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TX</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {events.map(event => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(event.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="font-medium">{event.from_asset}</span>
                  <span className="mx-2">→</span>
                  <span className="font-medium">{event.to_asset}</span>
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  ${event.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600">{event.vhr_before.toFixed(1)}%</span>
                    <span>→</span>
                    <span className={
                      event.vhr_after > event.vhr_before 
                        ? 'text-green-600 font-medium' 
                        : 'text-red-600 font-medium'
                    }>
                      {event.vhr_after.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {event.reason}
                </td>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={`https://solscan.io/tx/${event.transaction_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {event.transaction_signature.slice(0, 8)}...
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {events.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No rebalance events yet
        </div>
      )}
    </div>
  );
}
