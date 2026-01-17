-- Run this in your Supabase SQL editor to create required tables

-- Games table
CREATE TABLE IF NOT EXISTS public.games_rugs_fun (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id TEXT UNIQUE,
    crash_multiplier DECIMAL,
    total_volume DECIMAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table  
CREATE TABLE IF NOT EXISTS public.users_rugsfun (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    balance DECIMAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades table
CREATE TABLE IF NOT EXISTS public.trades_rugs_fun (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    game_id TEXT,
    buy_multiplier DECIMAL,
    sell_multiplier DECIMAL,
    amount DECIMAL,
    profit_loss DECIMAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional for now)
ALTER TABLE public.games_rugs_fun ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_rugsfun ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades_rugs_fun ENABLE ROW LEVEL SECURITY;

-- Create policies to allow service role full access
CREATE POLICY "Enable all for service role" ON public.games_rugs_fun
    FOR ALL USING (true);

CREATE POLICY "Enable all for service role" ON public.users_rugsfun
    FOR ALL USING (true);

CREATE POLICY "Enable all for service role" ON public.trades_rugs_fun
    FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_game_id ON public.games_rugs_fun(game_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON public.users_rugsfun(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trades_wallet ON public.trades_rugs_fun(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trades_game ON public.trades_rugs_fun(game_id);
