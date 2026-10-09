'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  KeyRound,
  Loader2,
  Copy,
  Check
} from 'lucide-react'
import {
  confirmHandshake,
  reportNoShow,
  type ActionResponse
} from '../../actions/transactions'
import type { TransactionStatus } from '../../types/supabase'

export interface HandshakeVerificationCardProps {
  transactionId: string
  scheduledAt: string
  status: TransactionStatus
  currentUserRole: 'buyer' | 'seller'
  buyerOtp?: string // Hanya diprovide kepada buyer sah (via secure RPC get_buyer_otp)
  listingTitle: string
  price: number
  safeZoneName: string
  counterpartyName: string
  notes?: string | null
  // Client action overrides for local sandbox/workbench execution
  onConfirmHandshakeOverride?: (formData: FormData) => Promise<ActionResponse>
  onReportNoShowOverride?: (formData: FormData) => Promise<ActionResponse<{ deductedScore: number }>>
  onTransactionUpdated?: () => void
}

export const HandshakeVerificationCard: React.FC<HandshakeVerificationCardProps> = ({
  transactionId,
  scheduledAt,
  status,
  currentUserRole,
  buyerOtp,
  listingTitle,
  price,
  safeZoneName,
  counterpartyName,
  notes,
  onConfirmHandshakeOverride,
  onReportNoShowOverride,
  onTransactionUpdated,
}) => {
  const [otpInput, setOtpInput] = useState<string>('')
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [isReportingNoShow, setIsReportingNoShow] = useState<boolean>(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [hasCopiedOtp, setHasCopiedOtp] = useState<boolean>(false)

  // Status perhitungan batas 20 menit No-Show
  const [canReportNoShow, setCanReportNoShow] = useState<boolean>(false)
  const [remainingMinutesToReport, setRemainingMinutesToReport] = useState<number>(20)

  // Evaluasi waktu secara berkala
  const evaluateNoShowEligibility = useCallback(() => {
    if (status !== 'scheduled') {
      setCanReportNoShow(false)
      return
    }

    const scheduledTimestamp = new Date(scheduledAt).getTime()
    const now = Date.now()
    const thresholdMs = 20 * 60 * 1000 // 20 Menit

    if (now >= scheduledTimestamp + thresholdMs) {
      setCanReportNoShow(true)
      setRemainingMinutesToReport(0)
    } else {
      setCanReportNoShow(false)
      const diffMs = (scheduledTimestamp + thresholdMs) - now
      setRemainingMinutesToReport(Math.max(1, Math.ceil(diffMs / (60 * 1000))))
    }
  }, [scheduledAt, status])

  useEffect(() => {
    evaluateNoShowEligibility()
    const timer = setInterval(evaluateNoShowEligibility, 5000)
    return () => clearInterval(timer)
  }, [evaluateNoShowEligibility])

  // Handler Verifikasi OTP oleh Penjual
  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFeedback(null)

    if (otpInput.trim().length !== 6 || !/^\d{6}$/.test(otpInput.trim())) {
      setFeedback({
        type: 'error',
        message: 'Masukkan 6 digit angka OTP yang tertera pada layar pembeli.'
      })
      return
    }

    setIsVerifying(true)

    try {
      const formData = new FormData()
      formData.append('transactionId', transactionId)
      formData.append('otp', otpInput.trim())

      const res = onConfirmHandshakeOverride
        ? await onConfirmHandshakeOverride(formData)
        : await confirmHandshake(formData)

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Verifikasi Physical Handshake Berhasil!'
        })
        setOtpInput('')
        if (onTransactionUpdated) {
          onTransactionUpdated()
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'OTP tidak valid atau verifikasi ditolak.'
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghubungi server verifikasi'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setIsVerifying(false)
    }
  }

  // Handler Laporkan No-Show
  const handleReportNoShow = async () => {
    const isBuyer = currentUserRole === 'buyer'
    const targetRole = isBuyer ? 'Penjual' : 'Pembeli'

    const confirmMessage = `Apakah Anda yakin ingin melaporkan ${targetRole} (${counterpartyName}) sebagai NO-SHOW (Mangkir)?\n\nSistem akan secara permanen memotong 20 poin reputasi pelanggar.`
    if (!window.confirm(confirmMessage)) return

    setIsReportingNoShow(true)
    setFeedback(null)

    try {
      const formData = new FormData()
      formData.append('transactionId', transactionId)

      const res = onReportNoShowOverride
        ? await onReportNoShowOverride(formData)
        : await reportNoShow(formData)

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Laporan no-show berhasil diajukan.'
        })
        if (onTransactionUpdated) {
          onTransactionUpdated()
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Gagal memproses laporan no-show.'
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat melaporkan no-show'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setIsReportingNoShow(false)
    }
  }

  // Salin OTP ke clipboard
  const handleCopyOtp = () => {
    if (buyerOtp) {
      navigator.clipboard.writeText(buyerOtp)
      setHasCopiedOtp(true)
      setTimeout(() => setHasCopiedOtp(false), 2000)
    }
  }

  // Tampilan jika transaksi sudah selesai atau diakhiri
  if (status !== 'scheduled') {
    const isCompleted = status === 'completed'
    const isBuyerNoShow = status === 'buyer_no_show'
    const isSellerNoShow = status === 'seller_no_show'

    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center bg-slate-100">
          {isCompleted ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-rose-600" />
          )}
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-800">
            {isCompleted
              ? 'Physical Handshake Selesai & Berhasil'
              : 'Transaksi Diakhiri (Mangkir / Dibatalkan)'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Status: <span className="font-semibold uppercase tracking-wider text-slate-700">{status.replace('_', ' ')}</span>
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
          {isCompleted && (
            <span className="text-emerald-700 font-medium flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Kedua pihak telah menerima reward +2 poin Reliability Score.
            </span>
          )}
          {isBuyerNoShow && 'Pembeli tidak hadir di titik temu. Penalti -20 poin diterapkan pada akun pembeli.'}
          {isSellerNoShow && 'Penjual tidak hadir di titik temu. Penalti -20 poin diterapkan pada akun penjual.'}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden transition-all">
      {/* Transaction Top Bar */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
              Mode: {currentUserRole === 'buyer' ? '👤 Layar Pembeli' : '🏷️ Layar Penjual'}
            </span>
            <h4 className="text-sm font-bold text-slate-800 leading-tight">
              {listingTitle}
            </h4>
            <p className="text-xs text-slate-500">
              Nilai COD: <span className="font-semibold text-slate-800">Rp {price.toLocaleString('id-ID')}</span> (Bayar Tunai / QRIS Langsung)
            </p>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 justify-end">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>{safeZoneName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 justify-end mt-0.5">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{new Date(scheduledAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB</span>
            </div>
          </div>
        </div>

        {notes && (
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Catatan Temu: </span>
            {notes}
          </div>
        )}
      </div>

      {/* Handshake Security Protocol Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3.5 flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-950">Aturan Protokol Physical Handshake:</strong>{' '}
          {currentUserRole === 'buyer' ? (
            <span>
              <strong>JANGAN berikan kode ini</strong> sebelum Anda memeriksa kondisi barang/jasa dan menyelesaikan pembayaran fisik secara langsung kepada penjual.
            </span>
          ) : (
            <span>
              Minta 6-digit kode OTP dari pembeli <strong>hanya setelah</strong> Anda menyerahkan barang dan menerima uang tunai/transfer QRIS di titik temu.
            </span>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-6">
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="font-medium leading-relaxed">{feedback.message}</div>
          </div>
        )}

        {/* TAMPILAN PEMBELI */}
        {currentUserRole === 'buyer' ? (
          <div className="text-center py-4 space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Kode Handshake Rahasia Anda
              </span>
              <p className="text-xs text-slate-500">
                Tunjukkan kode ini kepada penjual ({counterpartyName}) setelah transaksi selesai
              </p>
            </div>

            <div className="inline-flex items-center gap-2 bg-slate-950 text-white rounded-2xl px-6 py-4 shadow-xl border border-slate-800">
              <KeyRound className="w-6 h-6 text-emerald-400" />
              <div className="text-3xl sm:text-4xl font-mono font-black tracking-[0.25em] text-emerald-400 select-all pl-2">
                {buyerOtp || '••••••'}
              </div>
              {buyerOtp && (
                <button
                  type="button"
                  onClick={handleCopyOtp}
                  className="ml-3 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  title="Salin OTP"
                >
                  {hasCopiedOtp ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Tersimpan aman dengan proteksi Row Level Security (RLS) PostgreSQL
            </div>
          </div>
        ) : (
          /* TAMPILAN PENJUAL */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="otpInputField" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Input 6-Digit OTP Pembeli</span>
                <span className="text-[11px] font-normal text-slate-400">
                  Didapat dari layar ponsel pembeli
                </span>
              </label>
              <div className="relative">
                <input
                  id="otpInputField"
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-3xl font-mono font-bold tracking-[0.3em] py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-300 placeholder:tracking-widest"
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifying || otpInput.trim().length !== 6}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memvalidasi Stored Procedure PostgreSQL...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verifikasi &amp; Selesaikan Transaksi</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Emergency / No-Show Section */}
        <div className="pt-5 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              Protokol Darurat Ketidakhadiran (No-Show)
            </span>
            <span className="text-[11px] text-slate-400">Ambang Batas: 20 Menit</span>
          </div>

          <button
            type="button"
            onClick={handleReportNoShow}
            disabled={!canReportNoShow || isReportingNoShow}
            className="w-full py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isReportingNoShow ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses Penalti Reputasi...</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  Laporkan {currentUserRole === 'buyer' ? 'Penjual' : 'Pembeli'} Mangkir (Penalti -20 Poin)
                </span>
              </>
            )}
          </button>

          {!canReportNoShow ? (
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Tombol ini akan aktif otomatis setelah{' '}
              <strong className="text-slate-600">{remainingMinutesToReport} menit</strong> lewat dari jadwal janji temu ({new Date(scheduledAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB).
            </p>
          ) : (
            <p className="text-[11px] text-rose-600 font-medium text-center">
              ⚠️ Waktu janji temu telah lewat lebih dari 20 menit. Anda berhak mengajukan penalti no-show.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
