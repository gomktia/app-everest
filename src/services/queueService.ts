import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface Job {
  id: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  payload: Record<string, any>
  result?: Record<string, any>
  attempts: number
  created_at: string
  completed_at?: string
}

export async function publishJob(
  type: string,
  payload: Record<string, any>
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Insert job into database
  const { data: job, error } = await supabase
    .from('job_queue')
    .insert({
      type,
      status: 'pending',
      payload,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) throw error

  // Trigger QStash to process the job
  // QStash will call our handler endpoint
  try {
    const baseUrl = window.location.origin
    const response = await fetch(`${baseUrl}/api/queue/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id, type }),
    })
    if (!response.ok) {
      logger.warn('QStash publish failed, job will be processed on next poll')
    }
  } catch {
    // If QStash publish fails, job stays pending and can be retried
    logger.warn('QStash unavailable, job queued for later processing')
  }

  return job.id
}

export async function getJobStatus(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('job_queue')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error) return null
  return data as Job
}

export async function getJobsByType(type: string, limit = 20): Promise<Job[]> {
  const { data, error } = await supabase
    .from('job_queue')
    .select('*')
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as Job[]
}

export async function getCircuitBreakerState(service: string) {
  const { data, error } = await supabase
    .from('circuit_breaker_state')
    .select('*')
    .eq('service', service)
    .single()

  if (error) return { state: 'closed', failure_count: 0 }
  return data
}
