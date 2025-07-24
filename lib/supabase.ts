import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Verificar se usuário é Master
export async function isMasterUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('is_master, email')
    .eq('id', userId)
    .single()

  if (error) return false

  return data.is_master || data.email === process.env.MASTER_EMAIL
}

// Ativar licença
export async function activateLicense(
  userId: string, 
  serialKey: string, 
  licenseType: string
) {
  const { data, error } = await supabase
    .from('licenses')
    .update({
      activated_by: userId,
      activated_at: new Date().toISOString(),
      status: 'active'
    })
    .eq('serial_key', serialKey)
    .eq('status', 'pending')
    .select()

  return { data, error }
}

// Buscar estatísticas do usuário
export async function getUserStats(userId: string) {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()

  return { data, error }
}

// Buscar afiliados
export async function getAffiliates(userId?: string) {
  let query = supabase
    .from('affiliates')
    .select(`
      *,
      user:users(name, email),
      commissions(amount, status),
      referrals:bookings(id, total_amount, status)
    `)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  return { data, error }
}

// Buscar agendamentos
export async function getBookings(filters?: {
  therapistId?: string
  affiliateId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}) {
  let query = supabase
    .from('bookings')
    .select(`
      *,
      service:services(name, price, duration_minutes),
      therapist:therapists(user:users(name, email)),
      affiliate:affiliates(user:users(name, email), referral_code)
    `)

  if (filters) {
    if (filters.therapistId) query = query.eq('therapist_id', filters.therapistId)
    if (filters.affiliateId) query = query.eq('affiliate_id', filters.affiliateId)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.dateFrom) query = query.gte('scheduled_date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('scheduled_date', filters.dateTo)
  }

  const { data, error } = await query.order('scheduled_date', { ascending: false })

  return { data, error }
}

// Criar agendamento
export async function createBooking(bookingData: any) {
  const { data, error } = await supabase
    .from('bookings')
    .insert(bookingData)
    .select()
    .single()

  return { data, error }
}

// Atualizar status do agendamento
export async function updateBookingStatus(bookingId: string, status: string) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select()
    .single()

  return { data, error }
}