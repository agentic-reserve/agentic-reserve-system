/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_API_URL: string
  readonly VITE_SOLANA_NETWORK: string
  readonly VITE_SOLANA_RPC_URL: string
  readonly VITE_ICB_CORE_PROGRAM_ID: string
  readonly VITE_ICB_TOKEN_PROGRAM_ID: string
  readonly VITE_ICB_RESERVE_PROGRAM_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
