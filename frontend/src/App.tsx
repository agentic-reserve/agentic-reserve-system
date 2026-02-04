import { BrowserRouter as Router } from 'react-router-dom'
import { WalletProvider } from './providers/WalletProvider'
import { SupabaseProvider } from './providers/SupabaseProvider'

function App() {
  return (
    <Router>
      <SupabaseProvider>
        <WalletProvider>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <header className="border-b bg-white/80 backdrop-blur-sm">
              <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-xl">ICB</span>
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">Internet Capital Bank</h1>
                      <p className="text-xs text-gray-500">Agent-First DeFi Protocol</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">Devnet</span>
                  </div>
                </div>
              </div>
            </header>

            <main className="container mx-auto px-4 py-8">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">
                      Welcome to Internet Capital Bank
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                      The first agent-first DeFi protocol on Solana. Powered by futarchy, 
                      AI agents, and decentralized governance.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                      <div className="p-6 bg-blue-50 rounded-xl">
                        <div className="text-3xl mb-2">🤖</div>
                        <h3 className="font-semibold text-gray-900 mb-2">AI Agents</h3>
                        <p className="text-sm text-gray-600">
                          Autonomous agents manage liquidity, yield, and governance
                        </p>
                      </div>
                      
                      <div className="p-6 bg-purple-50 rounded-xl">
                        <div className="text-3xl mb-2">🏛️</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Futarchy</h3>
                        <p className="text-sm text-gray-600">
                          Vote on beliefs, bet on outcomes with prediction markets
                        </p>
                      </div>
                      
                      <div className="p-6 bg-green-50 rounded-xl">
                        <div className="text-3xl mb-2">💎</div>
                        <h3 className="font-semibold text-gray-900 mb-2">ICU Token</h3>
                        <p className="text-sm text-gray-600">
                          Algorithmic stablecoin backed by Internet Liquidity Index
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-200">
                      <p className="text-sm text-gray-500">
                        🚀 Frontend setup complete! Ready for development.
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Vite + React + TypeScript + Tailwind CSS + Solana Wallet Adapter
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </main>

            <footer className="border-t bg-white/80 backdrop-blur-sm mt-16">
              <div className="container mx-auto px-4 py-6">
                <div className="text-center text-sm text-gray-600">
                  <p>© 2026 Internet Capital Bank. Built for Colosseum Agent Hackathon.</p>
                </div>
              </div>
            </footer>
          </div>
        </WalletProvider>
      </SupabaseProvider>
    </Router>
  )
}

export default App
