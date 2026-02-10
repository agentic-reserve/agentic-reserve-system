import { useAPI } from '../hooks/useAPI';

interface PolicyEvent {
  id: string;
  timestamp: string;
  policy_type: string;
  description: string;
  status: 'success' | 'failed';
  impact: {
    ili_before: number;
    ili_after: number;
    vhr_before: number;
    vhr_after: number;
  };
}

export default function PolicyTimeline() {
  const { data, loading, error } = useAPI<{ events: PolicyEvent[] }>('/history/policies');

  if (loading) return <div className="text-center py-8">Loading timeline...</div>;
  if (error) return <div className="text-red-500 py-8">Error: {error}</div>;

  const events = data?.events || [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Policy Execution Timeline</h2>
      
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        {events.map((event, index) => (
          <div key={event.id} className="relative pl-12 pb-8">
            <div className={`absolute left-2 w-4 h-4 rounded-full ${
              event.status === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`} />
            
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{event.policy_type}</h3>
                <span className="text-sm text-gray-500">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
              
              <p className="text-gray-700 mb-3">{event.description}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-600">ILI Impact</div>
                  <div className="font-medium">
                    {event.impact.ili_before.toFixed(2)} → {event.impact.ili_after.toFixed(2)}
                    <span className={`ml-2 ${
                      event.impact.ili_after > event.impact.ili_before 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      ({event.impact.ili_after > event.impact.ili_before ? '+' : ''}
                      {((event.impact.ili_after - event.impact.ili_before) / event.impact.ili_before * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-600">VHR Impact</div>
                  <div className="font-medium">
                    {event.impact.vhr_before.toFixed(1)}% → {event.impact.vhr_after.toFixed(1)}%
                    <span className={`ml-2 ${
                      event.impact.vhr_after > event.impact.vhr_before 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      ({event.impact.vhr_after > event.impact.vhr_before ? '+' : ''}
                      {(event.impact.vhr_after - event.impact.vhr_before).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {events.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No policy executions yet
        </div>
      )}
    </div>
  );
}
