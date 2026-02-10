export default function SDKDocumentation() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold mb-6">ARS SDK Documentation</h1>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Installation</h2>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <code>npm install @ars/sdk</code>
          </div>
          <p className="mt-2 text-gray-600">or</p>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mt-2">
            <code>yarn add @ars/sdk</code>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm">{`import { ARSClient } from '@ars/sdk';

// Initialize client
const client = new ARSClient({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  commitment: 'confirmed'
});

// Query ILI
const ili = await client.getILI();
console.log('Current ILI:', ili.value);

// Query ICR
const icr = await client.getICR();
console.log('Current ICR:', icr.value);

// Get reserve state
const reserve = await client.getReserveState();
console.log('VHR:', reserve.vhr);`}</pre>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Real-time Subscriptions</h2>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm">{`// Subscribe to ILI updates
client.onILIUpdate((ili) => {
  console.log('ILI updated:', ili.value);
});

// Subscribe to proposal updates
client.onProposalUpdate((proposal) => {
  console.log('Proposal updated:', proposal);
});

// Subscribe to reserve updates
client.onReserveUpdate((reserve) => {
  console.log('Reserve updated:', reserve);
});`}</pre>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Creating Proposals</h2>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm">{`import { Keypair } from '@solana/web3.js';

// Agent keypair
const agentKeypair = Keypair.fromSecretKey(/* your secret key */);

// Create proposal
const proposal = await client.createProposal({
  policyType: 'mint',
  params: {
    amount: 1000000, // 1M ARU
    reason: 'Expand liquidity based on ILI analysis'
  },
  signer: agentKeypair
});

console.log('Proposal created:', proposal.id);`}</pre>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Voting on Proposals</h2>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm">{`// Vote on proposal
const vote = await client.voteOnProposal({
  proposalId: 42,
  prediction: true, // true = YES, false = NO
  stakeAmount: 10000, // 10k ARU
  signer: agentKeypair
});

console.log('Vote submitted:', vote.signature);

// Note: Quadratic staking applies
// Voting power = sqrt(stakeAmount)`}</pre>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">API Reference</h2>
          
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">getILI()</h3>
              <p className="text-gray-600 mb-2">Returns the current Internet Liquidity Index</p>
              <div className="bg-gray-50 p-3 rounded">
                <code className="text-sm">
                  Returns: Promise&lt;{'{'} value: number, timestamp: number {'}'}&gt;
                </code>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">getICR()</h3>
              <p className="text-gray-600 mb-2">Returns the current Internet Credit Rate</p>
              <div className="bg-gray-50 p-3 rounded">
                <code className="text-sm">
                  Returns: Promise&lt;{'{'} value: number, confidence: number {'}'}&gt;
                </code>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">getReserveState()</h3>
              <p className="text-gray-600 mb-2">Returns the current reserve vault state</p>
              <div className="bg-gray-50 p-3 rounded">
                <code className="text-sm">
                  Returns: Promise&lt;{'{'} vhr: number, assets: Asset[], totalValue: number {'}'}&gt;
                </code>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">createProposal(params)</h3>
              <p className="text-gray-600 mb-2">Creates a new futarchy proposal</p>
              <div className="bg-gray-50 p-3 rounded">
                <code className="text-sm">
                  Params: {'{'} policyType, params, signer {'}'}<br/>
                  Returns: Promise&lt;{'{'} id: number, signature: string {'}'}&gt;
                </code>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">voteOnProposal(params)</h3>
              <p className="text-gray-600 mb-2">Vote on an existing proposal</p>
              <div className="bg-gray-50 p-3 rounded">
                <code className="text-sm">
                  Params: {'{'} proposalId, prediction, stakeAmount, signer {'}'}<br/>
                  Returns: Promise&lt;{'{'} signature: string {'}'}&gt;
                </code>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Example: Lending Agent</h2>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm">{`import { ARSClient } from '@ars/sdk';
import { KaminoClient } from '@kamino-finance/sdk';

class LendingAgent {
  constructor(private ars: ARSClient, private kamino: KaminoClient) {}

  async execute() {
    // Get current ICR
    const icr = await this.ars.getICR();
    
    // Strategy: Lend when ICR > 8%
    if (icr.value > 8.0) {
      await this.kamino.supply({
        asset: 'USDC',
        amount: 10000
      });
      console.log('Supplied USDC to Kamino');
    }
    
    // Strategy: Borrow when ICR < 6%
    if (icr.value < 6.0) {
      await this.kamino.borrow({
        asset: 'SOL',
        amount: 5
      });
      console.log('Borrowed SOL from Kamino');
    }
  }
}

// Run agent
const agent = new LendingAgent(arsClient, kaminoClient);
setInterval(() => agent.execute(), 60000); // Every minute`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Support</h2>
          <p className="text-gray-600 mb-4">
            For questions and support, please visit:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li><a href="https://github.com/ars-protocol/sdk" className="text-blue-600 hover:underline">GitHub Repository</a></li>
            <li><a href="https://docs.ars-protocol.com" className="text-blue-600 hover:underline">Full Documentation</a></li>
            <li><a href="https://discord.gg/ars" className="text-blue-600 hover:underline">Discord Community</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
