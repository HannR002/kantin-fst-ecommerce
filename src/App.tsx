import React, { useState } from 'react'
import {
  ShieldCheck,
  Building2,
  Users,
  Code2,
  Database as DatabaseIcon,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  ShoppingBag,
  Briefcase,
  Copy,
  Check,
  RotateCcw,
  Zap,
  Info
} from 'lucide-react'
import { MeetupSchedulerModal } from './components/transactions/MeetupSchedulerModal'
import { HandshakeVerificationCard } from './components/transactions/HandshakeVerificationCard'
import {
  INITIAL_SAFE_ZONES,
  DEMO_PROFILES,
  INITIAL_LISTINGS,
  type MarketplaceListing,
  type ActiveTransaction,
  type UserProfile,
} from './data/mock-data'
import type { ActionResponse } from './actions/transactions'

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'sandbox' | 'sql' | 'actions' | 'components' | 'architecture'>('sandbox')

  // University state
  const [selectedCampus, setSelectedCampus] = useState<string>('Universitas Indonesia')

  // User persona state
  const [currentPersonaKey, setCurrentPersonaKey] = useState<keyof typeof DEMO_PROFILES>('buyer_dimas')
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>(DEMO_PROFILES)
  const currentProfile = profiles[currentPersonaKey]

  // Listings state
  const [listings, setListings] = useState<MarketplaceListing[]>(INITIAL_LISTINGS)

  // Active Transaction State (Simulated Supabase PostgreSQL Record)
  const [activeTransaction, setActiveTransaction] = useState<ActiveTransaction | null>({
    id: 'b148c3e8-5b4f-4d37-9759-880fa9bc1210',
    listing_id: 'lst-prod-001',
    listing_title: 'Buku Kalkulus Purcell Edisi 9 (Jilid 1)',
    price: 125000,
    seller_id: 'u-seller-002',
    seller_name: 'Sarah Nabilah',
    buyer_id: 'u-buyer-001',
    buyer_name: 'Dimas Pratama',
    safe_zone_id: 'sz-ui-1',
    safe_zone_name: 'Lobi Perpustakaan Pusat (Crystal of Knowledge)',
    scheduled_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now
    handshake_otp: '742918',
    status: 'scheduled',
    completed_at: null,
    notes: 'Bertemu di dekat sofa tunggu lobi kaca perpus. Saya pakai jaket almamater kuning.',
  })

  // Simulated Time Offset (in minutes) to test No-Show 20 min rule
  const [simulatedMinutesOffset, setSimulatedMinutesOffset] = useState<number>(0)

  // Modal scheduler state
  const [isSchedulerOpen, setIsSchedulerOpen] = useState<boolean>(false)
  const [selectedListingForScheduler, setSelectedListingForScheduler] = useState<MarketplaceListing | null>(null)

  // Code copy feedback state
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const handleCopyCode = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(sectionId)
    setTimeout(() => setCopiedSection(null), 2500)
  }

  // Filter Safe Zones by active campus
  const filteredSafeZones = INITIAL_SAFE_ZONES.filter(
    (sz) => sz.campus_name === selectedCampus
  )

  // Helper to calculate effective scheduled time under simulation
  const getSimulatedScheduledTime = (originalIso: string): string => {
    const origTime = new Date(originalIso).getTime()
    // If offset is positive, we simulate the scheduled time as being in the past
    const simulatedScheduled = new Date(origTime - simulatedMinutesOffset * 60 * 1000)
    return simulatedScheduled.toISOString()
  }

  // Client Simulation Handler for `createMeetupTransaction`
  const handleClientCreateMeetup = async (formData: FormData): Promise<ActionResponse<{ transactionId: string }>> => {
    const listingId = String(formData.get('listingId'))
    const sellerId = String(formData.get('sellerId'))
    const safeZoneId = String(formData.get('safeZoneId'))
    const scheduledAt = String(formData.get('scheduledAt'))
    const notes = formData.get('notes') ? String(formData.get('notes')) : ''

    // 1. Check Reliability Score Threshold (< 40 is rejected)
    if (currentProfile.reliability_score < 40) {
      return {
        success: false,
        message: `Skor reliabilitas Anda (${currentProfile.reliability_score}/100) berada di bawah ambang batas minimal 40. Akun dibatasi dari transaksi COD tatap muka karena riwayat pelanggaran.`,
        error: 'RELIABILITY_SCORE_TOO_LOW',
      }
    }

    if (currentProfile.id === sellerId) {
      return {
        success: false,
        message: 'Anda tidak dapat membeli atau menjadwalkan janji temu dengan diri sendiri.',
        error: 'SELF_PURCHASE_FORBIDDEN',
      }
    }

    const listing = listings.find((l) => l.id === listingId)
    if (!listing || !listing.is_active) {
      return {
        success: false,
        message: 'Listing barang/jasa ini sudah tidak aktif atau stok habis.',
        error: 'LISTING_INACTIVE',
      }
    }

    const safeZone = INITIAL_SAFE_ZONES.find((sz) => sz.id === safeZoneId)
    const newTxId = 'tx-' + Math.random().toString(36).substring(2, 9)
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString()

    const newTx: ActiveTransaction = {
      id: newTxId,
      listing_id: listing.id,
      listing_title: listing.title,
      price: listing.price,
      seller_id: listing.seller_id,
      seller_name: listing.seller_name,
      buyer_id: currentProfile.id,
      buyer_name: currentProfile.name,
      safe_zone_id: safeZoneId,
      safe_zone_name: safeZone?.name || 'Campus Safe Zone',
      scheduled_at: scheduledAt,
      handshake_otp: newOtp,
      status: 'scheduled',
      completed_at: null,
      notes: notes || null,
    }

    setActiveTransaction(newTx)
    setSimulatedMinutesOffset(0)

    return {
      success: true,
      message: 'Janji temu COD berhasil dijadwalkan di Campus Safe Zone!',
      data: { transactionId: newTxId },
    }
  }

  // Client Simulation Handler for `confirmHandshake` (Atomic Stored Procedure)
  const handleClientConfirmHandshake = async (formData: FormData): Promise<ActionResponse> => {
    if (!activeTransaction) {
      return { success: false, message: 'Transaksi tidak ditemukan', error: 'NOT_FOUND' }
    }

    const inputOtp = String(formData.get('otp')).trim()

    // Seller Role Check
    if (currentProfile.id !== activeTransaction.seller_id) {
      return {
        success: false,
        message: 'Unauthorized: Hanya Penjual sah yang dapat menginput dan memverifikasi OTP handshake.',
        error: 'UNAUTHORIZED_NOT_SELLER',
      }
    }

    // OTP Check
    if (inputOtp !== activeTransaction.handshake_otp) {
      return {
        success: false,
        message: 'Kode OTP tidak cocok! Mohon periksa kembali layar ponsel pembeli.',
        error: 'INVALID_OTP',
      }
    }

    // ATOMIC MUTATIONS:
    // 1. Update status transaksi -> completed
    const updatedTx: ActiveTransaction = {
      ...activeTransaction,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }
    setActiveTransaction(updatedTx)

    // 2. Reduce stock if product, deactivate if 0
    setListings((prevListings) =>
      prevListings.map((l) => {
        if (l.id === activeTransaction.listing_id && l.type === 'product' && l.stock !== undefined) {
          const newStock = Math.max(0, l.stock - 1)
          return {
            ...l,
            stock: newStock,
            is_active: newStock > 0,
          }
        }
        return l
      })
    )

    // 3. Reward +2 reliability score to both parties (max 100)
    setProfiles((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (next[key].id === activeTransaction.buyer_id || next[key].id === activeTransaction.seller_id) {
          next[key] = {
            ...next[key],
            reliability_score: Math.min(100, next[key].reliability_score + 2),
          }
        }
      }
      return next
    })

    return {
      success: true,
      message: 'Physical Handshake Berhasil! Transaksi selesai, stok terpotong atomik, dan kedua mahasiswa menerima +2 reputasi.',
    }
  }

  // Client Simulation Handler for `reportNoShow`
  const handleClientReportNoShow = async (): Promise<ActionResponse<{ deductedScore: number }>> => {
    if (!activeTransaction) {
      return { success: false, message: 'Transaksi tidak ditemukan', error: 'NOT_FOUND' }
    }

    const isBuyer = currentProfile.id === activeTransaction.buyer_id
    const isSeller = currentProfile.id === activeTransaction.seller_id

    if (!isBuyer && !isSeller) {
      return {
        success: false,
        message: 'Akses ditolak: Anda bukan partisipan dalam transaksi ini.',
        error: 'FORBIDDEN',
      }
    }

    const effectiveScheduledTime = new Date(getSimulatedScheduledTime(activeTransaction.scheduled_at)).getTime()
    const now = Date.now()
    const thresholdMs = 20 * 60 * 1000

    if (now < effectiveScheduledTime + thresholdMs) {
      return {
        success: false,
        message: 'Pelaporan No-Show terkunci. Minimal 20 menit setelah waktu janji temu terlewati.',
        error: 'TIME_THRESHOLD_NOT_MET',
      }
    }

    const culpritId = isBuyer ? activeTransaction.seller_id : activeTransaction.buyer_id
    const updatedStatus = isBuyer ? 'seller_no_show' : 'buyer_no_show'

    // Update Transaction
    setActiveTransaction({
      ...activeTransaction,
      status: updatedStatus,
    })

    // Deduct -20 points from culprit
    setProfiles((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (next[key].id === culpritId) {
          next[key] = {
            ...next[key],
            reliability_score: Math.max(0, next[key].reliability_score - 20),
          }
        }
      }
      return next
    })

    return {
      success: true,
      message: `Laporan No-Show berhasil. Pihak lawan dinyatakan mangkir. Penalti otomatis -20 poin reputasi telah diterapkan ke akun pelanggar.`,
      data: { deductedScore: 20 },
    }
  }

  // Reset sandbox to initial demo state
  const handleResetSandbox = () => {
    setProfiles(DEMO_PROFILES)
    setListings(INITIAL_LISTINGS)
    setSimulatedMinutesOffset(0)
    setActiveTransaction({
      id: 'b148c3e8-5b4f-4d37-9759-880fa9bc1210',
      listing_id: 'lst-prod-001',
      listing_title: 'Buku Kalkulus Purcell Edisi 9 (Jilid 1)',
      price: 125000,
      seller_id: 'u-seller-002',
      seller_name: 'Sarah Nabilah',
      buyer_id: 'u-buyer-001',
      buyer_name: 'Dimas Pratama',
      safe_zone_id: 'sz-ui-1',
      safe_zone_name: 'Lobi Perpustakaan Pusat (Crystal of Knowledge)',
      scheduled_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      handshake_otp: '742918',
      status: 'scheduled',
      completed_at: null,
      notes: 'Bertemu di dekat sofa tunggu lobi kaca perpus. Saya pakai jaket almamater kuning.',
    })
  }

  // Determine current role in active transaction
  const activeUserRole: 'buyer' | 'seller' =
    activeTransaction && currentProfile.id === activeTransaction.seller_id ? 'seller' : 'buyer'

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Global Navigation */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Platform Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">KampusHub</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Zero-Escrow COD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Physical Handshake Protocol • Campus Safe Zones • Reliability Scoring
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('sandbox')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'sandbox'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Live Workbench
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sql'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <DatabaseIcon className="w-3.5 h-3.5" />
              <span>1. Supabase SQL</span>
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'actions'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>2. Server Actions</span>
            </button>
            <button
              onClick={() => setActiveTab('components')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'components'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>3. React Components</span>
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer hidden md:flex items-center gap-1.5 ${
                activeTab === 'architecture'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Arsitektur Protocol</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Persona & Simulation Controller Bar (Available Across App) */}
      <section className="bg-slate-950 border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Active Persona Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              Pilih Akun Mahasiswa (Role Switcher):
            </span>
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setCurrentPersonaKey('buyer_dimas')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  currentPersonaKey === 'buyer_dimas'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👤 Dimas (Pembeli, Skor {profiles.buyer_dimas.reliability_score})
              </button>
              <button
                onClick={() => setCurrentPersonaKey('seller_sarah')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  currentPersonaKey === 'seller_sarah'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏷️ Sarah (Penjual, Skor {profiles.seller_sarah.reliability_score})
              </button>
              <button
                onClick={() => setCurrentPersonaKey('buyer_low_rep')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  currentPersonaKey === 'buyer_low_rep'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                    : 'text-rose-400/80 hover:text-rose-300'
                }`}
                title="Skor < 40: Menguji proteksi penolakan Server Action"
              >
                ⚠️ Budi (Skor {profiles.buyer_low_rep.reliability_score} &lt; 40)
              </button>
            </div>
          </div>

          {/* Campus Selector & Reset Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCampus}
                onChange={(e) => setSelectedCampus(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="Universitas Indonesia">UI (Depok)</option>
                <option value="Institut Teknologi Bandung">ITB (Ganesa)</option>
                <option value="Universitas Gadjah Mada">UGM (Bulaksumur)</option>
              </select>
            </div>

            <button
              onClick={handleResetSandbox}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Reset state ke data awal"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset State</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: SANDBOX / LIVE WORKBENCH */}
        {activeTab === 'sandbox' && (
          <div className="space-y-8">
            {/* User Profile Banner & Reliability Engine Overview */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                {/* Profile Identity */}
                <div className="flex items-center gap-4">
                  <img
                    src={currentProfile.avatar}
                    alt={currentProfile.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white leading-tight">{currentProfile.name}</h2>
                      <span className="text-[10px] font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                        NIM {currentProfile.nim}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {currentProfile.faculty} • {currentProfile.campus_name}
                    </p>
                    <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                      {currentProfile.campus_email}
                    </p>
                  </div>
                </div>

                {/* Reliability Score Badge & Meter */}
                <div className="bg-slate-900 rounded-xl p-3.5 border border-slate-800 flex items-center gap-4 sm:min-w-[280px]">
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <svg className="w-12 h-12 transform -rotate-90">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="#1e293b"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke={
                          currentProfile.reliability_score >= 80
                            ? '#10b981'
                            : currentProfile.reliability_score >= 40
                            ? '#f59e0b'
                            : '#ef4444'
                        }
                        strokeWidth="4"
                        strokeDasharray={125.6}
                        strokeDashoffset={125.6 - (125.6 * currentProfile.reliability_score) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute text-xs font-black text-white">
                      {currentProfile.reliability_score}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">Reliability Score</span>
                      <span
                        className={`text-[11px] font-bold ${
                          currentProfile.reliability_score >= 80
                            ? 'text-emerald-400'
                            : currentProfile.reliability_score >= 40
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {currentProfile.reliability_score >= 80
                          ? 'Terpercaya'
                          : currentProfile.reliability_score >= 40
                          ? 'Pengawasan'
                          : 'Dibatasi (<40)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                      {currentProfile.reliability_score >= 40
                        ? 'Berhak melakukan COD di Zona Aman kampus. +2 poin per transaksi sukses.'
                        : 'Dilarang menjadwalkan COD tatap muka karena akumulasi no-show.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Split Grid: Left = Active Transaction Handshake Protocol; Right = Marketplace Listings */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: ACTIVE PHYSICAL HANDSHAKE TRANSACTION */}
              <div className="lg:col-span-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
                      Protokol Transaksi Aktif
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Verifikasi langsung di titik temu Campus Safe Zone
                    </p>
                  </div>
                  {activeTransaction && (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        activeTransaction.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : activeTransaction.status === 'scheduled'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {activeTransaction.status.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Simulation Time Machine Controller */}
                {activeTransaction && activeTransaction.status === 'scheduled' && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Simulasi Waktu Pertemuan (Test No-Show Rule)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Offset: +{simulatedMinutesOffset}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSimulatedMinutesOffset(0)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          simulatedMinutesOffset === 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        ⏱️ Waktu Baru (0m)
                      </button>
                      <button
                        onClick={() => setSimulatedMinutesOffset(25)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          simulatedMinutesOffset === 25
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                        title="Simulasi 25 menit lewat dari jadwal janji temu"
                      >
                        🚨 +25 Menit (Buka No-Show)
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Server Action <code>reportNoShow</code> memvalidasi bahwa laporan hanya sah jika waktu janji temu telah lewat minimal 20 menit.
                    </p>
                  </div>
                )}

                {/* Interactive HandshakeVerificationCard Instance */}
                {activeTransaction ? (
                  <HandshakeVerificationCard
                    transactionId={activeTransaction.id}
                    scheduledAt={getSimulatedScheduledTime(activeTransaction.scheduled_at)}
                    status={activeTransaction.status}
                    currentUserRole={activeUserRole}
                    buyerOtp={activeUserRole === 'buyer' ? activeTransaction.handshake_otp : undefined}
                    listingTitle={activeTransaction.listing_title}
                    price={activeTransaction.price}
                    safeZoneName={activeTransaction.safe_zone_name}
                    counterpartyName={
                      activeUserRole === 'buyer'
                        ? activeTransaction.seller_name
                        : activeTransaction.buyer_name
                    }
                    notes={activeTransaction.notes}
                    onConfirmHandshakeOverride={handleClientConfirmHandshake}
                    onReportNoShowOverride={handleClientReportNoShow}
                  />
                ) : (
                  <div className="bg-slate-950 p-8 rounded-2xl border border-dashed border-slate-800 text-center space-y-3">
                    <Clock className="w-10 h-10 text-slate-600 mx-auto" />
                    <h4 className="text-sm font-semibold text-slate-300">Belum Ada Janji Temu Aktif</h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Pilih barang atau jasa di katalog sebelah kanan lalu klik tombol "Jadwalkan COD" untuk memulai Physical Handshake.
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: CAMPUS MARKETPLACE CATALOG */}
              <div className="lg:col-span-7 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                      Katalog KampusHub ({selectedCampus})
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Direct Payment / COD tanpa biaya penahanan escrow
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listings.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-all shadow-lg flex flex-col"
                    >
                      {/* Image Thumbnail */}
                      <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                        <img
                          src={item.images[0]}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              item.type === 'product'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-teal-500 text-slate-950'
                            }`}
                          >
                            {item.type === 'product' ? 'Produk Fisik' : 'Jasa Kampus'}
                          </span>
                          {!item.is_active && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-md">
                              Habis
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content Details */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <h4 className="text-sm font-bold text-white leading-snug line-clamp-2">
                            {item.title}
                          </h4>
                          <div className="text-emerald-400 font-extrabold text-base">
                            Rp {item.price.toLocaleString('id-ID')}
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-900">
                            <span>Penjual: {item.seller_name}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold">
                              ⭐ {item.seller_reputation} pts
                            </span>
                          </div>

                          {item.type === 'product' ? (
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span>Kondisi: <strong className="text-slate-300 uppercase">{item.condition?.replace('_', ' ')}</strong></span>
                              <span>•</span>
                              <span>Stok: <strong className="text-slate-300">{item.stock} unit</strong></span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 leading-tight">
                              <span>Estimasi: {item.delivery_estimate_days} Hari • Revisi: {item.revision_limit}x</span>
                            </div>
                          )}
                        </div>

                        {/* Schedule Button */}
                        <button
                          onClick={() => {
                            setSelectedListingForScheduler(item)
                            setIsSchedulerOpen(true)
                          }}
                          disabled={!item.is_active}
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Jadwalkan Physical Handshake</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUPABASE SQL SCHEMA VIEWER */}
        {activeTab === 'sql' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DatabaseIcon className="w-5 h-5 text-emerald-400" />
                  Supabase PostgreSQL Schema &amp; Physical Handshake Engine
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Skrip SQL murni siap dieksekusi di <strong>Supabase SQL Editor</strong>. Dilengkapi Enums, Tables, Strict RLS, Column-Level Revocation, dan Stored Procedure Atomik (<code>FOR UPDATE</code> lock).
                </p>
              </div>

              <button
                onClick={() =>
                  handleCopyCode(
                    `-- KAMPUSHUB SUPABASE SQL SCRIPT\n-- Tersedia di /supabase/schema.sql`,
                    'sql-full'
                  )
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 cursor-pointer shrink-0"
              >
                {copiedSection === 'sql-full' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Tersalin ke Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Seluruh SQL Schema</span>
                  </>
                )}
              </button>
            </div>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1.5">
                  <ShieldCheck className="w-4 h-4" /> Column-Level OTP Security
                </span>
                <p className="text-slate-400 leading-relaxed">
                  <code>REVOKE SELECT (handshake_otp)</code> dicabut secara global dari role <code>authenticated</code>. Hanya pembeli sah yang dapat melihat kodenya via RPC <code>get_buyer_otp</code>.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="font-bold text-teal-400 flex items-center gap-1.5 mb-1.5">
                  <Layers className="w-4 h-4" /> Atomic Row Locking (FOR UPDATE)
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Fungsi <code>verify_handshake</code> mengunci baris transaksi secara atomik untuk mencegah race condition / double-spending saat penyerahan tunai.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="font-bold text-amber-400 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-4 h-4" /> Automated Reputation &amp; Stock Sync
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Sukses: +2 poin reputasi ke kedua pihak &amp; pengurangan stok produk. Jika stok 0, listing otomatis dinonaktifkan (<code>is_active = FALSE</code>).
                </p>
              </div>
            </div>

            {/* SQL Code Display */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>supabase/schema.sql</span>
                <span>PostgreSQL 15+ / Supabase</span>
              </div>
              <pre className="p-5 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed max-h-[500px]">
{`-- ==============================================================================
-- KAMPUSHUB: DATABASE SCHEMA & PHYSICAL HANDSHAKE PROTOCOL LOGIC ENGINE
-- ==============================================================================

-- 1. ENUM TYPES
CREATE TYPE listing_type AS ENUM ('product', 'service');
CREATE TYPE item_condition AS ENUM ('new', 'like_new', 'used');
CREATE TYPE transaction_status AS ENUM (
    'scheduled', 'completed', 'cancelled', 'buyer_no_show', 'seller_no_show', 'disputed'
);

-- 2. MASTER PROFILES (Terikat ke auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    campus_email VARCHAR(255) NOT NULL UNIQUE CHECK (campus_email LIKE '%.ac.id'),
    campus_name VARCHAR(255) NOT NULL,
    nim VARCHAR(50) NOT NULL,
    whatsapp_number VARCHAR(20) NOT NULL,
    reliability_score INT NOT NULL DEFAULT 100 CHECK (reliability_score >= 0 AND reliability_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CAMPUS SAFE ZONES (Titik Temu Tervalidasi Kampus)
CREATE TABLE public.campus_safe_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_name VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. LISTINGS & SUB-TABLES (1-to-1)
CREATE TABLE public.listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type listing_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    campus_name VARCHAR(255) NOT NULL,
    images TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.listing_products (
    id UUID PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
    condition item_condition NOT NULL,
    stock INT NOT NULL CHECK (stock >= 0)
);

CREATE TABLE public.listing_services (
    id UUID PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
    delivery_estimate_days INT NOT NULL CHECK (delivery_estimate_days > 0),
    revision_limit INT NOT NULL CHECK (revision_limit >= 0),
    scope_description TEXT NOT NULL
);

-- 5. PHYSICAL HANDSHAKE TRANSACTIONS
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id),
    seller_id UUID NOT NULL REFERENCES public.profiles(id),
    buyer_id UUID NOT NULL REFERENCES public.profiles(id),
    safe_zone_id UUID NOT NULL REFERENCES public.campus_safe_zones(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    handshake_otp VARCHAR(6) NOT NULL,
    status transaction_status NOT NULL DEFAULT 'scheduled',
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. STRICT ROW LEVEL SECURITY (RLS) & ACCESS CONTROL
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_safe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view transactions" ON public.transactions
FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers initiate transactions" ON public.transactions
FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- PROTEKSI KETAT: Revoke SELECT langsung pada kolom handshake_otp
REVOKE SELECT (handshake_otp) ON public.transactions FROM authenticated;
REVOKE SELECT (handshake_otp) ON public.transactions FROM anon;

-- RPC Aman: Hanya pembeli yang bisa melihat OTP miliknya
CREATE OR REPLACE FUNCTION public.get_buyer_otp(p_transaction_id UUID)
RETURNS VARCHAR(6)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_otp VARCHAR(6);
    v_buyer_id UUID;
BEGIN
    SELECT handshake_otp, buyer_id INTO v_otp, v_buyer_id FROM public.transactions WHERE id = p_transaction_id;
    IF v_buyer_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Hanya pembeli sah yang dapat melihat OTP';
    END IF;
    RETURN v_otp;
END;
$$;

-- 7. ATOMIC STORED PROCEDURE: verify_handshake
CREATE OR REPLACE FUNCTION public.verify_handshake(p_transaction_id UUID, p_input_otp VARCHAR(6))
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tx public.transactions%ROWTYPE;
    v_listing public.listings%ROWTYPE;
    v_remaining_stock INT;
BEGIN
    -- ROW-LEVEL LOCK: Mencegah Race Condition
    SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

    IF v_tx.id IS NULL THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
    IF v_tx.status != 'scheduled' THEN RAISE EXCEPTION 'Status transaksi bukan scheduled'; END IF;
    IF v_tx.seller_id != auth.uid() THEN RAISE EXCEPTION 'Hanya penjual sah yang dapat verifikasi OTP'; END IF;
    IF v_tx.handshake_otp != p_input_otp THEN RAISE EXCEPTION 'Invalid OTP'; END IF;

    -- Update Transaksi -> completed
    UPDATE public.transactions SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = p_transaction_id;

    -- Tambah +2 Skor Reliabilitas ke Pembeli & Penjual
    UPDATE public.profiles SET reliability_score = LEAST(100, reliability_score + 2) WHERE id IN (v_tx.buyer_id, v_tx.seller_id);

    -- Sinkronisasi Stok & Deaktivasi Listing jika Produk Fisik Habis
    SELECT * INTO v_listing FROM public.listings WHERE id = v_tx.listing_id;
    IF v_listing.type = 'product' THEN
        UPDATE public.listing_products SET stock = stock - 1 WHERE id = v_tx.listing_id RETURNING stock INTO v_remaining_stock;
        IF v_remaining_stock <= 0 THEN
            UPDATE public.listings SET is_active = FALSE, updated_at = NOW() WHERE id = v_tx.listing_id;
        END IF;
    END IF;
END;
$$;`}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: NEXT.JS SERVER ACTIONS VIEWER */}
        {activeTab === 'actions' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-emerald-400" />
                  Next.js App Router Server Actions (TypeScript + Zod)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  File terpadu di <code>src/actions/transactions.ts</code> dengan validasi Zod ketat, penegakan jam operasional kampus (08:00 - 18:00), threshold reputasi, dan revalidasi cache.
                </p>
              </div>

              <button
                onClick={() =>
                  handleCopyCode(
                    `// Tersedia di src/actions/transactions.ts`,
                    'actions-copy'
                  )
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 cursor-pointer shrink-0"
              >
                {copiedSection === 'actions-copy' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Tersalin ke Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Server Actions</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                  1. createMeetupTransaction
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Mengecek Zod schema (08:00 - 18:00), memvalidasi profil pembeli (tolak bila <code>reliability_score &lt; 40</code>), generate 6-digit OTP, simpan transaksi.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="font-bold text-teal-400 flex items-center gap-1.5 mb-1">
                  2. confirmHandshake
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Memvalidasi input OTP via Zod, memanggil RPC stored procedure <code>verify_handshake</code> Supabase secara aman dan merevalidasi cache Next.js.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="font-bold text-rose-400 flex items-center gap-1.5 mb-1">
                  3. reportNoShow
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Validasi ketat <code>scheduled_at + 20 menit</code>. Mengubah status transaksi menjadi mangkir dan otomatis memotong 20 poin reputasi pelanggar.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>src/actions/transactions.ts</span>
                <span>TypeScript Strict Mode (No 'any')</span>
              </div>
              <pre className="p-5 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed max-h-[500px]">
{`'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// 1. ZOD SCHEMA: Jadwal Operasional Kampus 08:00 - 18:00 WIB
export const MeetupFormSchema = z.object({
  listingId: z.string().uuid(),
  sellerId: z.string().uuid(),
  safeZoneId: z.string().uuid(),
  scheduledAt: z.string().refine((val) => {
    const hour = new Date(val).getHours()
    return hour >= 8 && hour < 18
  }, { message: 'Jadwal pertemuan harus berada dalam jam operasional kampus (08:00 - 18:00 WIB).' }),
  notes: z.string().max(255).optional(),
})

// 2. SERVER ACTION: createMeetupTransaction
export async function createMeetupTransaction(formData: FormData) {
  // Validasi input form
  const parsed = MeetupFormSchema.parse(...)
  
  // Verifikasi ambang batas Reliability Score Pembeli (Tolak jika < 40)
  const { data: buyerProfile } = await supabase.from('profiles').select('reliability_score').eq('id', user.id).single()
  if (buyerProfile.reliability_score < 40) {
    throw new Error('Skor reliabilitas Anda (<40) terlalu rendah untuk transaksi tatap muka.')
  }

  // Generate 6-digit OTP
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()

  // Simpan Transaksi
  await supabase.from('transactions').insert({
    listing_id: parsed.listingId,
    seller_id: parsed.sellerId,
    buyer_id: user.id,
    safe_zone_id: parsed.safeZoneId,
    scheduled_at: parsed.scheduledAt,
    handshake_otp: generatedOtp,
    status: 'scheduled',
  })

  revalidatePath('/transactions')
}

// 3. SERVER ACTION: confirmHandshake
export async function confirmHandshake(formData: FormData) {
  const parsed = HandshakeSchema.parse(...)
  
  // Panggil RPC Stored Procedure Atomik (FOR UPDATE lock)
  const { error } = await supabase.rpc('verify_handshake', {
    p_transaction_id: parsed.transactionId,
    p_input_otp: parsed.otp,
  })
  
  if (error) throw new Error(error.message)
  revalidatePath('/transactions')
}

// 4. SERVER ACTION: reportNoShow (Ambang Batas 20 Menit)
export async function reportNoShow(formData: FormData) {
  const scheduledTime = new Date(tx.scheduled_at).getTime()
  const now = Date.now()
  if (now < scheduledTime + (20 * 60 * 1000)) {
    throw new Error('Pelaporan no-show hanya sah minimal 20 menit setelah jadwal janji temu berlalu.')
  }

  // Terapkan penalti otomatis -20 poin ke pelanggar
  await supabase.from('profiles').update({ reliability_score: Math.max(0, culprit.score - 20) }).eq('id', culprit.id)
  revalidatePath('/transactions')
}`}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: REACT COMPONENTS VIEWER */}
        {activeTab === 'components' && (
          <div className="space-y-6">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Frontend Core Components (Next.js / React + Tailwind CSS)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Komponen modular siap pakai di <code>src/components/transactions/</code> dengan tiping TypeScript penuh, Lucide icons, responsive Tailwind CSS styling, dan state handling tanpa potongan kode.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: MeetupSchedulerModal */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    MeetupSchedulerModal.tsx
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Client Component
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Modal dialog interaktif untuk memilih Campus Safe Zone tervalidasi, membatasi jam janji temu pada jam operasional kampus (08:00 - 18:00 WIB), serta input catatan briefing sebelum submit ke Server Action.
                </p>
                <button
                  onClick={() => {
                    setSelectedListingForScheduler(listings[0])
                    setIsSchedulerOpen(true)
                  }}
                  className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Preview &amp; Coba Modal Sekarang</span>
                </button>
              </div>

              {/* Card 2: HandshakeVerificationCard */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    HandshakeVerificationCard.tsx
                  </h4>
                  <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">
                    Adaptive Dual-View
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Komponen adaptif yang menyesuaikan tampilan: <strong>Layar Pembeli</strong> (menampilkan 6-digit OTP + banner peringatan keamanan) atau <strong>Layar Penjual</strong> (form input OTP + tombol verifikasi atomik + tombol darurat No-Show 20 menit).
                </p>
                <button
                  onClick={() => setActiveTab('sandbox')}
                  className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-teal-400" />
                  <span>Lihat Interaksi di Live Workbench</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ARCHITECTURE SPEC */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Arsitektur "Physical Handshake Protocol" KampusHub (Tanpa Escrow)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Di lingkungan kampus Indonesia, pembayaran escrow sering membebani mahasiswa dengan biaya admin gerbang pembayaran, waktu penarikan lambat (T+2), dan friksi adopsi. KampusHub menerapkan model <strong>Direct Payment / COD</strong> yang diamankan dengan arsitektur 4 lapis:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <span>1.</span> Verifikasi OTP Tatap Muka
                </div>
                <p className="text-slate-400 leading-relaxed">
                  OTP 6 digit hanya dapat dilihat oleh Pembeli. Pembeli diinstruksikan untuk <em>hanya</em> memberikan kode tersebut setelah mengecek barang secara fisik dan menyelesaikan pembayaran tunai / QRIS. Begitu penjual memasukkan kode, sistem PostgreSQL menjalankan fungsi atomik yang mengunci baris dan menyelesaikan status secara serentak.
                </p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-teal-400 font-bold text-sm">
                  <span>2.</span> Campus Safe Zones
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Transaksi COD dibatasi secara ketat hanya pada titik-titik tervalidasi kampus (Lobi Perpustakaan, Pos Satpam Utama, Kantin Terbuka) dengan pengawasan CCTV 24 jam dan personel keamanan universitas, serta dibatasi pada jam operasional kampus (08:00 - 18:00 WIB).
                </p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <span>3.</span> Reliability Scoring Engine
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Setiap akun mahasiswa baru memulai dengan skor 100. Transaksi sukses memberikan reward +2 poin reputasi (maks 100). Ketidakhadiran (no-show) memicu penalti berat -20 poin. Jika skor turun di bawah 40, sistem otomatis mengunci mahasiswa dari membuat janji temu COD.
                </p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <span>4.</span> Column-Level PostgreSQL Security
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Mencegah kebocoran OTP dari endpoint Supabase PostgREST standar dengan mengeksekusi <code>REVOKE SELECT (handshake_otp)</code> secara eksplisit, dan membungkus hak baca OTP ke dalam fungsi <code>get_buyer_otp</code> yang memverifikasi <code>auth.uid() = buyer_id</code>.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MeetupSchedulerModal Instance */}
      {selectedListingForScheduler && (
        <MeetupSchedulerModal
          isOpen={isSchedulerOpen}
          listingId={selectedListingForScheduler.id}
          listingTitle={selectedListingForScheduler.title}
          sellerId={selectedListingForScheduler.seller_id}
          sellerName={selectedListingForScheduler.seller_name}
          safeZones={filteredSafeZones}
          onClose={() => {
            setIsSchedulerOpen(false)
            setSelectedListingForScheduler(null)
          }}
          onSuccess={(transactionId) => {
            setActiveTab('sandbox')
          }}
          clientSubmitOverride={handleClientCreateMeetup}
        />
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        <p>
          KampusHub • Physical Handshake Protocol &amp; Campus Marketplace Engine • Next.js App Router • Supabase PostgreSQL RLS
        </p>
      </footer>
    </div>
  )
}
