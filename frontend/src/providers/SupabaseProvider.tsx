import { FC, ReactNode, createContext, useContext } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface SupabaseContextType {
  supabase: SupabaseClient
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined)

interface SupabaseProviderProps {
  children: ReactNode
}

export const SupabaseProvider: FC<SupabaseProviderProps> = ({ children }) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8000'
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}
