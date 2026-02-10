import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    include: ['@solana/web3.js', 'buffer'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'solana': ['@solana/web3.js', '@solana/wallet-adapter-base', '@solana/wallet-adapter-react'],
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
