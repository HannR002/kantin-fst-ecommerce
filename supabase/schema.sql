-- ==============================================================================
-- KAMPUSHUB: DATABASE SCHEMA & PHYSICAL HANDSHAKE PROTOCOL LOGIC ENGINE
-- Dialect: PostgreSQL / Supabase SQL Editor Ready
-- ==============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM TYPES
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_type') THEN
        CREATE TYPE listing_type AS ENUM ('product', 'service');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_condition') THEN
        CREATE TYPE item_condition AS ENUM ('new', 'like_new', 'used');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
        CREATE TYPE transaction_status AS ENUM (
            'scheduled',
            'completed',
            'cancelled',
            'buyer_no_show',
            'seller_no_show',
            'disputed'
        );
    END IF;
END $$;

-- 2. TABLES

-- Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    campus_email VARCHAR(255) NOT NULL UNIQUE CHECK (campus_email LIKE '%.ac.id'),
    campus_name VARCHAR(255) NOT NULL,
    nim VARCHAR(50) NOT NULL,
    whatsapp_number VARCHAR(20) NOT NULL,
    reliability_score INT NOT NULL DEFAULT 100 CHECK (reliability_score >= 0 AND reliability_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campus Safe Zones Table (Verified Meetup Points)
CREATE TABLE IF NOT EXISTS public.campus_safe_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_name VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Master Listings Table
CREATE TABLE IF NOT EXISTS public.listings (
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

-- Listing Products (1-to-1 extension)
CREATE TABLE IF NOT EXISTS public.listing_products (
    id UUID PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
    condition item_condition NOT NULL,
    stock INT NOT NULL CHECK (stock >= 0)
);

-- Listing Services (1-to-1 extension)
CREATE TABLE IF NOT EXISTS public.listing_services (
    id UUID PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
    delivery_estimate_days INT NOT NULL CHECK (delivery_estimate_days > 0),
    revision_limit INT NOT NULL CHECK (revision_limit >= 0),
    scope_description TEXT NOT NULL
);

-- Physical Handshake Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
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

-- Indexes for high-throughput queries
CREATE INDEX IF NOT EXISTS idx_transactions_participants ON public.transactions(buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_listings_active ON public.listings(campus_name, is_active);
CREATE INDEX IF NOT EXISTS idx_safe_zones_campus ON public.campus_safe_zones(campus_name);

-- 3. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_safe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Campus Safe Zones Policies
DROP POLICY IF EXISTS "Campus safe zones are viewable by everyone" ON public.campus_safe_zones;
CREATE POLICY "Campus safe zones are viewable by everyone" 
ON public.campus_safe_zones FOR SELECT USING (is_active = TRUE);

-- Listings Policies
DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.listings;
CREATE POLICY "Listings are viewable by everyone" 
ON public.listings FOR SELECT USING (is_active = TRUE OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can manage their listings" ON public.listings;
CREATE POLICY "Sellers can manage their listings" 
ON public.listings FOR ALL USING (auth.uid() = seller_id);

-- Listing Products Policies
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.listing_products;
CREATE POLICY "Products are viewable by everyone" 
ON public.listing_products FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Sellers can manage product details" ON public.listing_products;
CREATE POLICY "Sellers can manage product details" 
ON public.listing_products FOR ALL 
USING (EXISTS (SELECT 1 FROM public.listings WHERE listings.id = listing_products.id AND listings.seller_id = auth.uid()));

-- Listing Services Policies
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.listing_services;
CREATE POLICY "Services are viewable by everyone" 
ON public.listing_services FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Sellers can manage service details" ON public.listing_services;
CREATE POLICY "Sellers can manage service details" 
ON public.listing_services FOR ALL 
USING (EXISTS (SELECT 1 FROM public.listings WHERE listings.id = listing_services.id AND listings.seller_id = auth.uid()));

-- Transactions Policies:
-- Only participants (buyer or seller) can see their transactions.
DROP POLICY IF EXISTS "Participants can view their transactions" ON public.transactions;
CREATE POLICY "Participants can view their transactions" 
ON public.transactions FOR SELECT 
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyers can initiate transaction" ON public.transactions;
CREATE POLICY "Buyers can initiate transaction" 
ON public.transactions FOR INSERT 
WITH CHECK (auth.uid() = buyer_id);

-- PROTEKSI KETAT HANDSHAKE OTP:
-- Revoke hak SELECT pada kolom handshake_otp agar seller tidak bisa membocorkan/mengintip OTP via SELECT *
REVOKE SELECT (handshake_otp) ON public.transactions FROM authenticated;
REVOKE SELECT (handshake_otp) ON public.transactions FROM anon;

-- RPC Khusus untuk Buyer: Hanya Buyer yang bisa mengambil OTP miliknya sendiri
CREATE OR REPLACE FUNCTION public.get_buyer_otp(p_transaction_id UUID)
RETURNS VARCHAR(6)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_otp VARCHAR(6);
    v_buyer_id UUID;
BEGIN
    SELECT handshake_otp, buyer_id INTO v_otp, v_buyer_id 
    FROM public.transactions 
    WHERE id = p_transaction_id;

    IF v_buyer_id IS NULL THEN
        RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
    END IF;

    IF v_buyer_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Only buyer can view the Handshake OTP';
    END IF;

    RETURN v_otp;
END;
$$;

-- 4. ATOMIC STORED PROCEDURE: Physical Handshake Verification
-- Dieksekusi saat Penjual memasukkan 6-digit OTP dari Pembeli di Safe Zone setelah terima tunai/QRIS
CREATE OR REPLACE FUNCTION public.verify_handshake(p_transaction_id UUID, p_input_otp VARCHAR(6))
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tx public.transactions%ROWTYPE;
    v_listing public.listings%ROWTYPE;
    v_remaining_stock INT;
BEGIN
    -- ROW-LEVEL LOCK: Mencegah double-spending atau race-condition saat verifikasi bersamaan
    SELECT * INTO v_tx 
    FROM public.transactions 
    WHERE id = p_transaction_id 
    FOR UPDATE;

    IF v_tx.id IS NULL THEN 
        RAISE EXCEPTION 'Transaction % not found', p_transaction_id; 
    END IF;
    
    IF v_tx.status != 'scheduled' THEN 
        RAISE EXCEPTION 'Transaction is not in scheduled state (Current status: %)', v_tx.status; 
    END IF;
    
    -- Verifikasi bahwa hanya Penjual yang berhak men-submit OTP verifikasi
    IF v_tx.seller_id != auth.uid() THEN 
        RAISE EXCEPTION 'Unauthorized: Only the assigned seller can verify Handshake OTP'; 
    END IF;
    
    -- Validasi OTP
    IF v_tx.handshake_otp != p_input_otp THEN 
        RAISE EXCEPTION 'Invalid OTP provided. Please confirm the 6-digit code shown on the buyer device.'; 
    END IF;

    -- Update status transaksi menjadi completed
    UPDATE public.transactions 
    SET 
        status = 'completed', 
        completed_at = NOW(), 
        updated_at = NOW() 
    WHERE id = p_transaction_id;

    -- Reward Reliability Score: +2 poin untuk pembeli dan penjual (maksimal 100)
    UPDATE public.profiles 
    SET reliability_score = LEAST(100, reliability_score + 2) 
    WHERE id IN (v_tx.buyer_id, v_tx.seller_id);

    -- Sinkronisasi Stok & Status Listing (jika berupa produk fisik)
    SELECT * INTO v_listing FROM public.listings WHERE id = v_tx.listing_id;
    
    IF v_listing.type = 'product' THEN
        UPDATE public.listing_products 
        SET stock = stock - 1 
        WHERE id = v_tx.listing_id 
        RETURNING stock INTO v_remaining_stock;
        
        -- Nonaktifkan listing secara otomatis bila stok habis (0)
        IF v_remaining_stock <= 0 THEN
            UPDATE public.listings 
            SET is_active = FALSE, updated_at = NOW() 
            WHERE id = v_tx.listing_id;
        END IF;
    END IF;
END;
$$;

-- 5. SEED DATA (Safe Zones tervalidasi kampus & demo data)
INSERT INTO public.campus_safe_zones (campus_name, name, description)
VALUES 
    ('Universitas Indonesia', 'Lobi Perpustakaan Pusat (Crystal of Knowledge)', 'Area ber-CCTV 24 jam dengan meja tunggu dan pengawasan satpam.'),
    ('Universitas Indonesia', 'Pos Satpam Gerbatama', 'Pos keamanan gerbang utama UI, pencahayaan terang dan penjagaan aktif.'),
    ('Universitas Indonesia', 'Kantin Utama Pusgiwa', 'Area publik ramai mahasiswa dengan akses tempat duduk dan pengawasan.'),
    ('Institut Teknologi Bandung', 'Lobi Labtek V (Beni Pekik)', 'Gedung Informatika ITB, ruang terbuka beralaskan WiFi dan CCTV.'),
    ('Institut Teknologi Bandung', 'Pos Satpam Gerbang Depan Ganesa', 'Pos penjagaan gerbang utama Jl. Ganesa No. 10.'),
    ('Universitas Gadjah Mada', 'Plaza Perpustakaan Pusat UGM', 'Area ruang terbuka mahasiswa ramai dan aman di sayap barat perpus.'),
    ('Universitas Gadjah Mada', 'Pos Satpam Boulevard UGM', 'Pos gerbang pintu masuk utama Boulevard.')
ON CONFLICT DO NOTHING;
