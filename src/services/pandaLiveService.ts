/**
 * Serviço de integração direta com a API de Lives do Panda Video v2.
 * Usado apenas pelo admin para criar/gerenciar lives automaticamente.
 * Todas as chamadas passam pelo Edge Function panda-proxy para não expor a API key.
 */
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

interface PandaStreamKey {
  id: string
  title: string
  stream_key: string
  user_id: string
  default: boolean
  is_attached: boolean
}

export interface PandaLive {
  id: string
  title: string
  rtmp: string
  stream_key: string
  stream_key_id: string
  user_id: string
  status: string
  live_player: string
  live_hls: string
  active_dvr: boolean
  latency_type: string
  bitrate: string[]
  folder_id: string | null
  vod_id: string | null
  started_at: string | null
  ended_at: string | null
  scheduled_at: string | null
  created_at: string
}

async function pandaFetch<T>(endpoint: string, method: string = 'GET', body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('panda-proxy', {
    body: { endpoint, method, body },
  })

  if (error) {
    logger.error(`[PandaLive] ${method} ${endpoint} → proxy error:`, error.message)
    throw new Error(error.message || `Erro na API Panda`)
  }

  // The proxy may return an error inside the data payload
  if (data?.error) {
    logger.error(`[PandaLive] ${method} ${endpoint} → API error:`, data.error)
    throw new Error(data.error)
  }

  return data as T
}

/**
 * Lista stream keys disponíveis na conta.
 * Silver = 1 key, Gold = 2 keys.
 */
export async function getStreamKeys(): Promise<PandaStreamKey[]> {
  return pandaFetch<PandaStreamKey[]>('/live_stream_key/')
}

/**
 * Busca a primeira stream key disponível (não vinculada a outra live ativa).
 */
export async function getAvailableStreamKey(): Promise<PandaStreamKey | null> {
  const keys = await getStreamKeys()
  return keys.find(k => !k.is_attached) || null
}

/**
 * Cria uma live no Panda Video.
 * Retorna RTMP URL + stream key para configurar no OBS.
 */
export async function createPandaLive(params: {
  title: string
  scheduled_at?: string
  active_dvr?: boolean
  bitrate?: string[]
  folder_id?: string
}): Promise<PandaLive> {
  const streamKey = await getAvailableStreamKey()
  if (!streamKey) {
    throw new Error('Nenhuma stream key disponível. Finalize a live ativa antes de criar outra.')
  }

  return pandaFetch<PandaLive>('/lives/', 'POST', {
    title: params.title,
    stream_key_id: streamKey.id,
    scheduled_at: params.scheduled_at || undefined,
    active_dvr: params.active_dvr ?? false,
    bitrate: params.bitrate || [],
    folder_id: params.folder_id || undefined,
  })
}

/**
 * Busca detalhes de uma live no Panda.
 */
export async function getPandaLive(liveId: string): Promise<PandaLive> {
  return pandaFetch<PandaLive>(`/lives/${liveId}`)
}

/**
 * Lista todas as lives da conta Panda.
 */
export async function listPandaLives(): Promise<PandaLive[]> {
  return pandaFetch<PandaLive[]>('/lives/')
}

/**
 * Finaliza a live no Panda e inicia conversão para VOD.
 */
export async function finishPandaLive(liveId: string): Promise<void> {
  await pandaFetch<{ status: boolean }>(`/lives/${liveId}/finish`, 'POST')
}

/**
 * Atualiza propriedades da live no Panda.
 */
export async function updatePandaLive(
  liveId: string,
  updates: { title?: string; scheduled_at?: string; active_dvr?: boolean; folder_id?: string }
): Promise<PandaLive> {
  return pandaFetch<PandaLive>(`/lives/${liveId}`, 'PUT', updates)
}

/**
 * Deleta uma live no Panda.
 */
export async function deletePandaLive(liveId: string): Promise<void> {
  await pandaFetch<void>(`/lives/${liveId}`, 'DELETE')
}

/**
 * Busca viewers de uma live ativa.
 */
export async function getPandaLiveViewers(liveId: string): Promise<{ viewers: number }> {
  return pandaFetch<{ viewers: number }>(
    `/analytics/live/${liveId}/viewers`
  )
}
