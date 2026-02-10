import { useState } from 'react';
import { useAPI } from '../hooks/useAPI';

interface ProposalDetailProps {
  proposalId: string;
}

export default function ProposalDetail({ proposalId }: ProposalDetailProps) {
  const [voteAmount, setVoteAmount] = useState('');
  const [prediction, setPrediction] = useState<'yes' | 'no'>('yes');
  const { data, loading, error } = useAPI(`/proposals/${proposalId}`);

  const handleVote = async () => {
    // TODO: Implement wallet transaction signing
    console.log('Voting:', { proposalId, prediction, amount: voteAmount });
  };

  if (loading) return <div className="text-center py-8">Loading proposal...</div>;
  if (error) return <div className="text-red-500 py-8">Error: {error}</div>;
  if (!data) return null;

  const proposal = data.proposal;
  const yesPercent = proposal.total_stake > 0 
    ? (proposal.yes_stake / proposal.total_stake * 100).toFixed(1)
    : '0';
  const noPercent = proposal.total_stake > 0
    ? (proposal.no_stake / proposal.total_stake * 100).toFixed(1)
    : '0';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">{proposal.title}</h1>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${
            proposal.status === 'active' ? 'bg-blue-100 text-blue-800' :
            proposal.status === 'passed' ? 'bg-green-100 text-green-800' :
            proposal.status === 'rejected' ? 'bg-red-100 text-red-800' :
            'bg-purple-100 text-purple-800'
          }`}>
            {proposal.status}
          </span>
        </div>

        <p className="text-gray-700 mb-6">{proposal.description}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-600">Policy Type</div>
            <div className="text-lg font-semibold">{proposal.policy_type}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-600">Total Stake</div>
            <div className="text-lg font-semibold">{proposal.total_stake.toLocaleString()} ARU</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-green-600">Yes: {yesPercent}%</span>
            <span className="text-red-600">No: {noPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div className="flex h-full">
              <div className="bg-green-500" style={{ width: `${yesPercent}%` }} />
              <div className="bg-red-500" style={{ width: `${noPercent}%` }} />
            </div>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>{proposal.yes_stake.toLocaleString()} ARU</span>
            <span>{proposal.no_stake.toLocaleString()} ARU</span>
          </div>
        </div>
      </div>

      {proposal.status === 'active' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4">Cast Your Vote</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Prediction</label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setPrediction('yes')}
                  className={`flex-1 py-3 rounded-lg font-medium ${
                    prediction === 'yes'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Yes - Will Stabilize ILI
                </button>
                <button
                  onClick={() => setPrediction('no')}
                  className={`flex-1 py-3 rounded-lg font-medium ${
                    prediction === 'no'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  No - Will Not Stabilize
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Stake Amount (ARU)</label>
              <input
                type="number"
                value={voteAmount}
                onChange={(e) => setVoteAmount(e.target.value)}
                placeholder="Enter amount to stake"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Quadratic staking: voting power = √(stake amount)
              </p>
            </div>

            <button
              onClick={handleVote}
              disabled={!voteAmount || parseFloat(voteAmount) <= 0}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Submit Vote
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Proposal Details</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Created:</span>
            <span className="font-medium">{new Date(proposal.created_at).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Voting Ends:</span>
            <span className="font-medium">{new Date(proposal.voting_ends_at).toLocaleString()}</span>
          </div>
          {proposal.execution_time && (
            <div className="flex justify-between">
              <span className="text-gray-600">Executed:</span>
              <span className="font-medium">{new Date(proposal.execution_time).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
