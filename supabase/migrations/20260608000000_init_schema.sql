-- 1. Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    capital NUMERIC(12, 2) DEFAULT 10000.00,
    lot_size NUMERIC(10, 4) DEFAULT 0.0000,
    upstox_api_key VARCHAR(255),
    upstox_api_secret VARCHAR(255),
    upstox_access_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 2. Scanner Signals Table
CREATE TABLE IF NOT EXISTS public.signals (
    id BIGSERIAL PRIMARY KEY,
    instrument VARCHAR(50) NOT NULL,
    price NUMERIC(12, 4) NOT NULL,
    high NUMERIC(12, 4) NOT NULL,
    low NUMERIC(12, 4) NOT NULL,
    candle_date DATE NOT NULL,
    candle_time TIME NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    screenshot VARCHAR(255),
    confidence VARCHAR(20),
    spread_pct NUMERIC(6, 3),
    buy_entry NUMERIC(12, 4),
    buy_target NUMERIC(12, 4),
    buy_stop_loss NUMERIC(12, 4),
    sell_entry NUMERIC(12, 4),
    sell_target NUMERIC(12, 4),
    sell_stop_loss NUMERIC(12, 4),
    status VARCHAR(50) DEFAULT 'DETECTED',
    CONSTRAINT unique_signal_key UNIQUE (instrument, candle_date, candle_time)
);

-- Enable RLS for signals
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- 3. Simulated & Live Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    plan VARCHAR(20) NOT NULL, -- 'basic' or 'growth'
    buy_entry NUMERIC(12, 4),
    buy_target NUMERIC(12, 4),
    buy_stop_loss NUMERIC(12, 4),
    buy_qty NUMERIC(12, 4),
    sell_entry NUMERIC(12, 4),
    sell_target NUMERIC(12, 4),
    sell_stop_loss NUMERIC(12, 4),
    sell_qty NUMERIC(12, 4),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    active_leg VARCHAR(10),
    entry_price NUMERIC(12, 4),
    exit_price NUMERIC(12, 4),
    entry_time TIMESTAMPTZ,
    exit_time TIMESTAMPTZ,
    pnl NUMERIC(12, 4) DEFAULT 0.0000,
    ltp NUMERIC(12, 4),
    is_sar BOOLEAN DEFAULT FALSE,
    distance_1R NUMERIC(12, 4),
    buy_stop_loss_original NUMERIC(12, 4),
    sell_stop_loss_original NUMERIC(12, 4),
    highest_reached NUMERIC(12, 4),
    lowest_reached NUMERIC(12, 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cl_order_id VARCHAR(255) UNIQUE
);

-- Enable RLS for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Execution Logs Table
CREATE TABLE IF NOT EXISTS public.client_logs (
    id BIGSERIAL PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for logs
ALTER TABLE public.client_logs ENABLE ROW LEVEL SECURITY;

-- Create default read policies (Select for authenticated users / service-role)
CREATE POLICY "Allow service role full access to clients" ON public.clients TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access to signals" ON public.signals TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access to orders" ON public.orders TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access to client_logs" ON public.client_logs TO service_role USING (true) WITH CHECK (true);
