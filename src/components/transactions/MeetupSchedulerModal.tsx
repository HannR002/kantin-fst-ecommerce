'use client'

import React, { useState, useEffect } from 'react'
import { MapPin, Clock, FileText, X, AlertCircle, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react'
import { createMeetupTransaction, type ActionResponse } from '../../actions/transactions'

export interface SafeZoneItem {
  id: string
  campus_name: string
  name: string
  description: string | null
}

export interface MeetupSchedulerModalProps {
  isOpen: boolean
  listingId: string
  listingTitle: string
  sellerId: string
  sellerName?: string
  safeZones: SafeZoneItem[]
  onClose: () => void
  onSuccess: (transactionId: string) => void
  // Optional client mock dispatcher for instant in-browser interactive sandbox demo
  clientSubmitOverride?: (formData: FormData) => Promise<ActionResponse<{ transactionId: string }>>
}

export const MeetupSchedulerModal: React.FC<MeetupSchedulerModalProps> = ({
  isOpen,
  listingId,
  listingTitle,
  sellerId,
  sellerName = 'Penjual Terverifikasi',
  safeZones,
  onClose,
  onSuccess,
  clientSubmitOverride,
}) => {
  const [selectedSafeZone, setSelectedSafeZone] = useState<string>('')
  const [scheduledDate, setScheduledDate] = useState<string>('')
  const [scheduledTime, setScheduledTime] = useState<string>('10:00')
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Inisialisasi default tanggal: besok jam 10:00 (dalam rentang 08:00 - 18:00)
  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const year = tomorrow.getFullYear()
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
      const day = String(tomorrow.getDate()).padStart(2, '0')
      setScheduledDate(`${year}-${month}-${day}`)
      setScheduledTime('10:00')
      setErrorMessage(null)
      setFieldErrors({})
      if (safeZones.length > 0 && !selectedSafeZone) {
        setSelectedSafeZone(safeZones[0].id)
      }
    }
  }, [isOpen, safeZones, selectedSafeZone])

  if (!isOpen) return null

  // Validasi lokal sebelum submit
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!selectedSafeZone) {
      errors.safeZoneId = 'Pilih salah satu titik temu Campus Safe Zone.'
    }

    if (!scheduledDate) {
      errors.date = 'Pilih tanggal pertemuan.'
    }

    if (!scheduledTime) {
      errors.time = 'Pilih jam pertemuan.'
    } else {
      const [hourStr] = scheduledTime.split(':')
      const hour = parseInt(hourStr, 10)
      if (isNaN(hour) || hour < 8 || hour >= 18) {
        errors.time = 'Pertemuan harus dijadwalkan pada jam operasional kampus (08:00 - 18:00 WIB).'
      }
    }

    if (notes.length > 255) {
      errors.notes = 'Catatan maksimal 255 karakter.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const combinedDateTime = `${scheduledDate}T${scheduledTime}:00`
      const scheduledIso = new Date(combinedDateTime).toISOString()

      const formData = new FormData()
      formData.append('listingId', listingId)
      formData.append('sellerId', sellerId)
      formData.append('safeZoneId', selectedSafeZone)
      formData.append('scheduledAt', scheduledIso)
      formData.append('notes', notes.trim())

      // Menggunakan Server Action atau client mock override untuk browser sandbox
      const response = clientSubmitOverride
        ? await clientSubmitOverride(formData)
        : await createMeetupTransaction(formData)

      if (response.success && response.data?.transactionId) {
        onSuccess(response.data.transactionId)
        onClose()
      } else {
        setErrorMessage(response.message || 'Gagal membuat jadwal janji temu.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi gangguan koneksi ke server.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentZoneDetail = safeZones.find((z) => z.id === selectedSafeZone)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/15 rounded-lg backdrop-blur-md">
                <ShieldCheck className="w-5 h-5 text-emerald-100" />
              </div>
              <div>
                <h3 id="modal-title" className="text-lg font-bold leading-tight tracking-tight">
                  Jadwalkan Physical Handshake
                </h3>
                <p className="text-xs text-emerald-100/90 mt-0.5">
                  COD Terverifikasi di Campus Safe Zone (Tanpa Escrow)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-3.5 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-emerald-50">
            <span className="truncate max-w-[280px] font-medium">Item: {listingTitle}</span>
            <span className="shrink-0 bg-white/20 px-2 py-0.5 rounded text-[11px]">
              Penjual: {sellerName}
            </span>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Safe Zone Selection */}
          <div className="space-y-1.5">
            <label htmlFor="safeZoneSelect" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Titik Temu Campus Safe Zone <span className="text-rose-500">*</span>
            </label>
            <select
              id="safeZoneSelect"
              value={selectedSafeZone}
              onChange={(e) => setSelectedSafeZone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
            >
              <option value="">-- Pilih Titik Temu Tervalidasi Kampus --</option>
              {safeZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.campus_name}: {zone.name}
                </option>
              ))}
            </select>
            {fieldErrors.safeZoneId && (
              <p className="text-xs text-rose-600 font-medium">{fieldErrors.safeZoneId}</p>
            )}

            {currentZoneDetail && (
              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-100/80 text-[11px] text-emerald-900 leading-relaxed mt-2 flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-950">{currentZoneDetail.name}: </span>
                  {currentZoneDetail.description || 'Lokasi umum ber-CCTV yang diawasi keamanan kampus.'}
                </div>
              </div>
            )}
          </div>

          {/* Date & Time Picker (Campus Operating Hours 08:00 - 18:00) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="meetupDate" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Tanggal Temu <span className="text-rose-500">*</span>
              </label>
              <input
                id="meetupDate"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
              {fieldErrors.date && (
                <p className="text-xs text-rose-600 font-medium">{fieldErrors.date}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="meetupTime" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Jam Temu (08:00 - 18:00) <span className="text-rose-500">*</span>
              </label>
              <input
                id="meetupTime"
                type="time"
                value={scheduledTime}
                min="08:00"
                max="18:00"
                step="900"
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
              {fieldErrors.time && (
                <p className="text-xs text-rose-600 font-medium">{fieldErrors.time}</p>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 -mt-2">
            * Demi keamanan kedua mahasiswa, pertemuan fisik dibatasi pada jam operasional kampus <strong>08:00 - 18:00 WIB</strong>.
          </p>

          {/* Notes Input */}
          <div className="space-y-1.5">
            <label htmlFor="meetupNotes" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                Catatan Briefing / Ciri Fisik (Opsional)
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {notes.length}/255
              </span>
            </label>
            <textarea
              id="meetupNotes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Menunggu di kursi dekat lobi kaca, mengenakan jaket almamater biru..."
              maxLength={255}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all resize-none"
            />
            {fieldErrors.notes && (
              <p className="text-xs text-rose-600 font-medium">{fieldErrors.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses Janji Temu...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Konfirmasi Jadwal COD</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
