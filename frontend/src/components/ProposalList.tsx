import { useState, useEffect } from 'react';
import { useAPI } from '../hooks/useAPI';

interface Proposal {
  id: string;
  title: string;
  description: string;
  policy_type: 'mint' | 'burn' | 'icr_update' | 'rebalance';
  status: 'active' | 'passed' | 'rejected' | 'executed';
  yes_stake: number;
  no_stake: number;
  total_stake: number;
  created_at: string;
  voting_ends_at: string;
  execution_time?: string;
}

export default function ProposalList() {
  const [filter, setFilter] = useState<string>('all');
  const { data, loading, error } = useAPI<{ proposals: Proposal[] }>('/proposals');

  const filteredProposals = data?.proposals?.filter(p => 
    filter === 'all' || p.status === filter
  ) || [];

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-blue-100 text-blue-800',
      passed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      executed: 'bg-purple-100 text-purple-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPolicyTypeLabel = (type: string) => {
    const labels = {
      mint: '🪙 Mint ARU',
      burn: '🔥 Burn ARU',
      icr_update: '📊 Update ICR',
      rebalance: '⚖️ Rebalance Vault'
    };
    return labels[type as keyof typeof labels] || type;
  };

  if (loading) return <div className="text-center py-8">Loading proposals...</div>;
  if (error) return <div className="text-red-500 py-8">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-gray-200">
        {['all', 'active', 'passed', 'rejected', 'executed'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-medium capitalize ${
              filter === status
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filteredProposals.map(proposal => {
          const yesPercent = proposal.total_stake > 0 
            ? (proposal.yes_stake / proposal.total_stake * 100).toFixed(1)
            : '0';
          const noPercent = proposal.total_stake > 0
            ? (proposal.no_stake / proposal.total_stake * 100).toFixed(1)
            : '0';

          return (
            <div
              key={proposal.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => window.location.href = `/proposals/${proposal.id}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-lg font-semibold">{getPolicyTypeLabel(proposal.policy_type)}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                      {proposal.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{proposal.title}</h3>
                  <p className="text-gray-600 line-clamp-2">{proposal.description}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Yes: {yesPercent}%</span>
                  <span>No: {noPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="flex h-full">
                    <div 
                      className="bg-green-500"
                      style={{ width: `${yesPercent}%` }}
                    />
                    <div 
                      className="bg-red-500"
                      style={{ width: `${noPercent}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{proposal.yes_stake.toLocaleString()} ARU</span>
                  <span>{proposal.no_stake.toLocaleString()} ARU</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Created: {new Date(proposal.created_at).toLocaleDateString()}</span>
                {proposal.status === 'active' && (
                  <span>Ends: {new Date(proposal.voting_ends_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProposals.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No {filter !== 'all' ? filter : ''} proposals found
        </div>
      )}
    </div>
  );
}
