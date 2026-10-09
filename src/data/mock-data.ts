import type { ListingType, ItemCondition, TransactionStatus } from '../types/supabase'
import type { SafeZoneItem } from '../components/transactions/MeetupSchedulerModal'

export interface UserProfile {
  id: string
  campus_email: string
  campus_name: string
  nim: string
  whatsapp_number: string
  name: string
  faculty: string
  reliability_score: number
  avatar: string
}

export interface MarketplaceListing {
  id: string
  seller_id: string
  seller_name: string
  seller_reputation: number
  type: ListingType
  title: string
  price: number
  campus_name: string
  images: string[]
  is_active: boolean
  // Product specific
  condition?: ItemCondition
  stock?: number
  // Service specific
  delivery_estimate_days?: number
  revision_limit?: number
  scope_description?: string
}

export interface ActiveTransaction {
  id: string
  listing_id: string
  listing_title: string
  price: number
  seller_id: string
  seller_name: string
  buyer_id: string
  buyer_name: string
  safe_zone_id: string
  safe_zone_name: string
  scheduled_at: string
  handshake_otp: string
  status: TransactionStatus
  completed_at: string | null
  notes: string | null
}

export const INITIAL_SAFE_ZONES: SafeZoneItem[] = [
  {
    id: 'sz-ui-1',
    campus_name: 'Universitas Indonesia',
    name: 'Lobi Perpustakaan Pusat (Crystal of Knowledge)',
    description: 'Area ber-CCTV 24 jam dengan meja tunggu mahasiswa dan pengawasan satpam tetap.',
  },
  {
    id: 'sz-ui-2',
    campus_name: 'Universitas Indonesia',
    name: 'Pos Satpam Gerbatama',
    description: 'Pos keamanan gerbang utama UI, pencahayaan terang benderang dan petugas siaga.',
  },
  {
    id: 'sz-ui-3',
    campus_name: 'Universitas Indonesia',
    name: 'Kantin Utama Pusgiwa',
    description: 'Area ramai mahasiswa di pusat kegiatan mahasiswa dengan pengawasan terbuka.',
  },
  {
    id: 'sz-itb-1',
    campus_name: 'Institut Teknologi Bandung',
    name: 'Lobi Labtek V (Beni Pekik)',
    description: 'Gedung Informatika & Elektro ITB, ruang terbuka beralaskan WiFi dan CCTV.',
  },
  {
    id: 'sz-ugm-1',
    campus_name: 'Universitas Gadjah Mada',
    name: 'Plaza Perpustakaan Pusat UGM',
    description: 'Area sayap barat perpustakaan pusat, ramai dan terang benderang.',
  },
]

export const DEMO_PROFILES: Record<string, UserProfile> = {
  buyer_dimas: {
    id: 'u-buyer-001',
    name: 'Dimas Pratama',
    campus_email: 'dimas.pratama@ui.ac.id',
    campus_name: 'Universitas Indonesia',
    nim: '2206081234',
    whatsapp_number: '081298765432',
    faculty: 'Fakultas Ilmu Komputer',
    reliability_score: 94,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
  },
  seller_sarah: {
    id: 'u-seller-002',
    name: 'Sarah Nabilah',
    campus_email: 'sarah.nabilah@ui.ac.id',
    campus_name: 'Universitas Indonesia',
    nim: '2106095678',
    whatsapp_number: '081312345678',
    faculty: 'Fakultas Ekonomi & Bisnis',
    reliability_score: 98,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
  },
  buyer_low_rep: {
    id: 'u-risky-003',
    name: 'Budi Kurnia (Akun Bermasalah)',
    campus_email: 'budi.kurnia@ui.ac.id',
    campus_name: 'Universitas Indonesia',
    nim: '2006012999',
    whatsapp_number: '081900011122',
    faculty: 'Fakultas Teknik',
    reliability_score: 30, // < 40: harus memicu proteksi Server Action!
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
  },
}

export const INITIAL_LISTINGS: MarketplaceListing[] = [
  {
    id: 'lst-prod-001',
    seller_id: 'u-seller-002',
    seller_name: 'Sarah Nabilah',
    seller_reputation: 98,
    type: 'product',
    title: 'Buku Kalkulus Purcell Edisi 9 (Jilid 1)',
    price: 125000,
    campus_name: 'Universitas Indonesia',
    images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'],
    is_active: true,
    condition: 'like_new',
    stock: 2,
  },
  {
    id: 'lst-serv-002',
    seller_id: 'u-seller-002',
    seller_name: 'Sarah Nabilah',
    seller_reputation: 98,
    type: 'service',
    title: 'Jasa Review & Bedah CV Tech / Magang ATS Friendly',
    price: 45000,
    campus_name: 'Universitas Indonesia',
    images: ['https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=600&q=80'],
    is_active: true,
    delivery_estimate_days: 1,
    revision_limit: 2,
    scope_description: 'Sesi konsultasi tatap muka 20 menit di kantin kampus + bedah format ATS & keyword relevan.',
  },
  {
    id: 'lst-prod-003',
    seller_id: 'u-seller-002',
    seller_name: 'Sarah Nabilah',
    seller_reputation: 98,
    type: 'product',
    title: 'Kalkulator Saintifik Casio fx-991EX ClassWiz Original',
    price: 240000,
    campus_name: 'Universitas Indonesia',
    images: ['https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=600&q=80'],
    is_active: true,
    condition: 'used',
    stock: 1,
  },
]
