import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

export const supabase = createClient(url, key)

export type Item = {
  id: string
  codigo_m: string
  nome: string | null
  descricao: string | null
  categoria: string | null
  foto_url: string | null
  locacao_id?: string | null
  locacao_codigo?: string | null
  score?: number
}

export type Locacao = {
  id: string
  codigo: string
  descricao: string | null
}
