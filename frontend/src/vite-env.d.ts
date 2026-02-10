/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_API_URL: string
  readonly VITE_SOLANA_NETWORK: string
  readonly VITE_SOLANA_RPC_URL: string
  readonly VITE_ARS_CORE_PROGRAM_ID: string
  readonly VITE_ARS_RESERVE_PROGRAM_ID: string
  readonly VITE_ARS_TOKEN_PROGRAM_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
