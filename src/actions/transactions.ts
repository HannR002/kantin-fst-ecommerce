'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Database, TransactionStatus } from '../types/supabase'

export interface ActionResponse<T = undefined> {
  success: boolean
  message: string
  data?: T
  error?: string
}

/**
 * Inisialisasi Supabase Server Client menggunakan cookies di Next.js App Router
 */
export async function getSupabaseServerClient() {
  const cookieStore = cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-campus-hub.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key-placeholder'

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Next.js Server Components mungkin read-only untuk set cookie
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch {
            // Next.js Server Components mungkin read-only
          }
        },
      },
    }
  )
}

/**
 * 1. Zod Schema untuk Penjadwalan Janji Temu COD
 * Memastikan tanggal dan jam terbatas pada jam operasional kampus (08:00 - 18:00 WIB)
 */
export const MeetupFormSchema = z.object({
  listingId: z.string().uuid({ message: 'ID Listing tidak valid (harus UUID)' }),
  sellerId: z.string().uuid({ message: 'ID Penjual tidak valid (harus UUID)' }),
  safeZoneId: z.string().uuid({ message: 'ID Zona Aman Kampus tidak valid (harus UUID)' }),
  scheduledAt: z.string().refine((val) => {
    const date = new Date(val)
    if (isNaN(date.getTime())) return false
    const hour = date.getHours()
    // Jam operasional kampus: 08:00 hingga 18:00
    return hour >= 8 && hour < 18
  }, { 
    message: 'Jadwal pertemuan harus berada dalam jam operasional kampus (08:00 - 18:00 WIB).' 
  }).refine((val) => {
    const date = new Date(val)
    // Tidak boleh menjadwalkan di masa lalu
    return date.getTime() > Date.now() - 5 * 60 * 1000
  }, {
    message: 'Waktu janji temu tidak boleh di masa lalu.'
  }),
  notes: z.string().max(255, { message: 'Catatan maksimal 255 karakter' }).optional().default(''),
})

export type MeetupFormValues = z.infer<typeof MeetupFormSchema>

/**
 * SERVER ACTION: createMeetupTransaction
 * Menerima FormData, validasi Zod, cek skor reliabilitas pembeli (>=40),
 * generate 6-digit OTP, dan menyimpan transaksi ke PostgreSQL.
 */
export async function createMeetupTransaction(formData: FormData): Promise<ActionResponse<{ transactionId: string }>> {
  try {
    const rawData = {
      listingId: formData.get('listingId'),
      sellerId: formData.get('sellerId'),
      safeZoneId: formData.get('safeZoneId'),
      scheduledAt: formData.get('scheduledAt'),
      notes: formData.get('notes') ? String(formData.get('notes')) : '',
    }

    const validated = MeetupFormSchema.safeParse(rawData)
    if (!validated.success) {
      const firstIssue = validated.error.issues[0]?.message || 'Input form tidak valid'
      return { success: false, message: firstIssue, error: firstIssue }
    }

    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        message: 'Autentikasi gagal. Silakan masuk terlebih dahulu.',
        error: 'UNAUTHORIZED'
      }
    }

    if (user.id === validated.data.sellerId) {
      return {
        success: false,
        message: 'Anda tidak dapat membeli atau menjadwalkan janji temu dengan diri sendiri.',
        error: 'SELF_PURCHASE_FORBIDDEN'
      }
    }

    // 1. Verifikasi ambang batas Reliability Score Pembeli (Tolak jika < 40)
    const { data: buyerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('reliability_score, campus_name')
      .eq('id', user.id)
      .single()

    if (profileError || !buyerProfile) {
      return {
        success: false,
        message: 'Gagal memverifikasi profil pembeli di pangkalan data kampus.',
        error: profileError?.message || 'PROFILE_NOT_FOUND'
      }
    }

    if (buyerProfile.reliability_score < 40) {
      return {
        success: false,
        message: `Skor reliabilitas Anda (${buyerProfile.reliability_score}/100) berada di bawah ambang batas minimal 40. Akun dibatasi untuk transaksi tatap muka karena riwayat no-show berulang.`,
        error: 'RELIABILITY_SCORE_TOO_LOW'
      }
    }

    // 2. Verifikasi status listing aktif
    const { data: listingData, error: listingError } = await supabase
      .from('listings')
      .select('id, is_active, title')
      .eq('id', validated.data.listingId)
      .single()

    if (listingError || !listingData || !listingData.is_active) {
      return {
        success: false,
        message: 'Listing barang/jasa ini sudah tidak aktif atau habis.',
        error: 'LISTING_INACTIVE'
      }
    }

    // 3. Generate 6-digit OTP kriptografis aman
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()

    // 4. Simpan transaksi janji temu COD
    const { data: newTx, error: insertError } = await supabase
      .from('transactions')
      .insert({
        listing_id: validated.data.listingId,
        seller_id: validated.data.sellerId,
        buyer_id: user.id,
        safe_zone_id: validated.data.safeZoneId,
        scheduled_at: validated.data.scheduledAt,
        handshake_otp: generatedOtp,
        status: 'scheduled',
        notes: validated.data.notes || null
      })
      .select('id')
      .single()

    if (insertError || !newTx) {
      return {
        success: false,
        message: 'Gagal menyimpan transaksi janji temu: ' + (insertError?.message || 'Database error'),
        error: insertError?.message
      }
    }

    revalidatePath('/transactions')
    revalidatePath(`/transactions/${newTx.id}`)
    revalidatePath(`/listings/${validated.data.listingId}`)

    return {
      success: true,
      message: 'Janji temu COD berhasil dijadwalkan di Campus Safe Zone!',
      data: { transactionId: newTx.id }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return { success: false, message: errorMessage, error: errorMessage }
  }
}

/**
 * 2. Zod Schema untuk Konfirmasi Handshake OTP
 */
export const HandshakeSchema = z.object({
  transactionId: z.string().uuid({ message: 'Transaction ID harus valid UUID' }),
  otp: z.string()
    .length(6, { message: 'Kode OTP harus tepat 6 digit angka' })
    .regex(/^\d{6}$/, { message: 'Kode OTP hanya boleh mengandung angka numerik' }),
})

export type HandshakeInput = z.infer<typeof HandshakeSchema>

/**
 * SERVER ACTION: confirmHandshake
 * Memanggil Stored Procedure verify_handshake(p_transaction_id, p_input_otp)
 * dengan row-level locking (FOR UPDATE) dan update status atomik.
 */
export async function confirmHandshake(formData: FormData): Promise<ActionResponse> {
  try {
    const rawData = {
      transactionId: formData.get('transactionId'),
      otp: formData.get('otp'),
    }

    const validated = HandshakeSchema.safeParse(rawData)
    if (!validated.success) {
      const issue = validated.error.issues[0]?.message || 'Input OTP tidak valid'
      return { success: false, message: issue, error: issue }
    }

    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        message: 'Sesi login telah berakhir. Silakan login kembali.',
        error: 'UNAUTHORIZED'
      }
    }

    // Eksekusi Stored Procedure atomik di Supabase PostgreSQL
    const { error: rpcError } = await supabase.rpc('verify_handshake', {
      p_transaction_id: validated.data.transactionId,
      p_input_otp: validated.data.otp,
    })

    if (rpcError) {
      let friendlyMessage = rpcError.message
      if (rpcError.message.includes('Invalid OTP')) {
        friendlyMessage = 'Kode OTP tidak cocok! Mohon periksa kembali layar ponsel pembeli.'
      } else if (rpcError.message.includes('Only the assigned seller')) {
        friendlyMessage = 'Hanya penjual sah yang diizinkan memvalidasi OTP transaksi ini.'
      } else if (rpcError.message.includes('not in scheduled state')) {
        friendlyMessage = 'Transaksi ini sudah selesai atau telah dibatalkan sebelumnya.'
      }

      return {
        success: false,
        message: friendlyMessage,
        error: rpcError.message
      }
    }

    revalidatePath(`/transactions/${validated.data.transactionId}`)
    revalidatePath('/transactions')
    revalidatePath('/profile')

    return {
      success: true,
      message: 'Physical Handshake Berhasil! Transaksi selesai, stok terpotong, dan masing-masing pihak mendapat +2 poin reputasi.'
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Terjadi kegagalan saat verifikasi handshake'
    return { success: false, message: errorMessage, error: errorMessage }
  }
}

/**
 * 3. Zod Schema untuk Pelaporan No-Show
 */
export const NoShowSchema = z.object({
  transactionId: z.string().uuid({ message: 'Transaction ID harus valid UUID' }),
})

/**
 * SERVER ACTION: reportNoShow
 * Validasi batas waktu: HANYA bisa dieksekusi minimal 20 menit setelah jadwal janji temu lewat.
 * Mengubah status transaksi menjadi buyer_no_show atau seller_no_show,
 * dan memotong 20 poin reliability_score pihak yang mangkir.
 */
export async function reportNoShow(formData: FormData): Promise<ActionResponse<{ deductedScore: number }>> {
  try {
    const rawData = {
      transactionId: formData.get('transactionId'),
    }

    const validated = NoShowSchema.safeParse(rawData)
    if (!validated.success) {
      return { success: false, message: 'ID Transaksi tidak valid', error: 'INVALID_ID' }
    }

    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, message: 'Autentikasi gagal.', error: 'UNAUTHORIZED' }
    }

    // Ambil data transaksi secara langsung
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('id, scheduled_at, buyer_id, seller_id, status')
      .eq('id', validated.data.transactionId)
      .single()

    if (txError || !tx) {
      return { success: false, message: 'Transaksi tidak ditemukan.', error: 'NOT_FOUND' }
    }

    if (tx.status !== 'scheduled') {
      return {
        success: false,
        message: `Transaksi tidak dalam status janji temu (Status saat ini: ${tx.status}).`,
        error: 'INVALID_STATUS'
      }
    }

    // Validasi partisipan
    const isCallerBuyer = user.id === tx.buyer_id
    const isCallerSeller = user.id === tx.seller_id

    if (!isCallerBuyer && !isCallerSeller) {
      return {
        success: false,
        message: 'Akses ditolak: Anda bukan partisipan dalam transaksi ini.',
        error: 'FORBIDDEN'
      }
    }

    // Validasi batas waktu: Minimal 20 menit setelah scheduled_at lewat
    const scheduledTimestamp = new Date(tx.scheduled_at).getTime()
    const currentTimestamp = Date.now()
    const minimumWaitPeriodMs = 20 * 60 * 1000 // 20 menit dalam milidetik

    if (currentTimestamp < scheduledTimestamp + minimumWaitPeriodMs) {
      const remainingSeconds = Math.ceil((scheduledTimestamp + minimumWaitPeriodMs - currentTimestamp) / 1000)
      const remainingMinutes = Math.ceil(remainingSeconds / 60)
      return {
        success: false,
        message: `Pelaporan No-Show terkunci. Anda baru dapat melapor minimal 20 menit setelah jadwal janji temu berlalu (sisa sekitar ${remainingMinutes} menit lagi).`,
        error: 'TIME_THRESHOLD_NOT_MET'
      }
    }

    const culpritId = isCallerBuyer ? tx.seller_id : tx.buyer_id
    const updatedStatus: TransactionStatus = isCallerBuyer ? 'seller_no_show' : 'buyer_no_show'

    // Update status transaksi
    const { error: updateTxError } = await supabase
      .from('transactions')
      .update({
        status: updatedStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', tx.id)

    if (updateTxError) {
      return { success: false, message: 'Gagal memperbarui status transaksi: ' + updateTxError.message }
    }

    // Potong 20 poin dari reliability_score pelanggar (dengan batas bawah 0)
    const { data: culpritProfile } = await supabase
      .from('profiles')
      .select('reliability_score')
      .eq('id', culpritId)
      .single()

    let newScore = 0
    if (culpritProfile) {
      newScore = Math.max(0, culpritProfile.reliability_score - 20)
      await supabase
        .from('profiles')
        .update({ reliability_score: newScore })
        .eq('id', culpritId)
    }

    revalidatePath(`/transactions/${tx.id}`)
    revalidatePath('/transactions')

    const culpritRoleName = isCallerBuyer ? 'Penjual' : 'Pembeli'
    return {
      success: true,
      message: `Laporan No-Show diproses. ${culpritRoleName} dinyatakan mangkir. Penalti otomatis -20 poin reputasi telah diterapkan.`,
      data: { deductedScore: 20 }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memproses laporan no-show'
    return { success: false, message: msg, error: msg }
  }
}
