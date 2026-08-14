import { supabase } from './supabase'

// Registra um evento no histórico do item (cadastro, edição, quantidade, conferência…)
export async function registrarHistorico(
  itemId: string,
  tipo: string,
  descricao: string,
  quantidade?: number | null,
) {
  const { data } = await supabase.auth.getUser()
  await supabase.from('historico').insert({
    item_id: itemId,
    tipo,
    descricao,
    quantidade: quantidade ?? null,
    usuario: data.user?.email ?? null,
  })
}
