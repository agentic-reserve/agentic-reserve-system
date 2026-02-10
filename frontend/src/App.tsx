import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { WalletProvider } from './providers/WalletProvider'
import { Dashboard } from './components/Dashboard'

function App() {
  return (
    <Router>
      <WalletProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xl">ARS</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Agentic Reserve System</h1>
                    <p className="text-xs text-gray-500">Macro Layer for Internet of Agents</p>
                  </div>
                </Link>
                <div className="flex items-center space-x-4">
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Devnet
                  </span>
                </div>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
            </Routes>
          </main>

          <footer className="border-t bg-white/80 backdrop-blur-sm mt-16">
            <div className="container mx-auto px-4 py-6">
              <div className="text-center text-sm text-gray-600">
                <p>© 2026 Agentic Reserve System. Built for Colosseum Agent Hackathon.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Macro coordination layer for autonomous AI agents on Solana
                </p>
              </div>
            </div>
          </footer>
        </div>
      </WalletProvider>
    </Router>
  )
}

export default App
