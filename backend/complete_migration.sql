-- ============================================
-- Complete Migration for Rugs.Fun Backend
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Settlement Tracking Columns
-- (For reconciliation system)
-- ============================================

ALTER TABLE public.games_rugs_fun 
ADD COLUMN IF NOT EXISTS settled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS finalized_onchain BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS settlement_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_settlement_attempt TIMESTAMPTZ;

-- Create index for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_games_unsettled 
ON public.games_rugs_fun(settled, crash_multiplier) 
WHERE settled = FALSE AND crash_multiplier IS NOT NULL;

COMMENT ON COLUMN public.games_rugs_fun.settled IS 'True if all settlements have been executed';
COMMENT ON COLUMN public.games_rugs_fun.finalized_onchain IS 'True if endGame succeeded on-chain';
COMMENT ON COLUMN public.games_rugs_fun.settlement_attempts IS 'Number of times settlement was attempted';
COMMENT ON COLUMN public.games_rugs_fun.last_settlement_attempt IS 'Timestamp of last settlement attempt';

-- ============================================
-- PART 2: Nano-Precision Balance Column
-- (For integer-safe accounting)
-- ============================================

ALTER TABLE public.users_rugsfun 
ADD COLUMN IF NOT EXISTS balance_nano BIGINT DEFAULT 0;

-- Migrate existing decimal data to nano-units
-- FLOOR(balance * 1e9) ensures 9-decimal precision alignment
UPDATE public.users_rugsfun 
SET balance_nano = FLOOR(balance * 1000000000) 
WHERE balance IS NOT NULL AND balance_nano = 0;

-- ============================================
-- PART 3: RPC Functions for Atomic Trading
-- (Pure integer nano-units)
-- ============================================

-- Buy Trade RPC
CREATE OR REPLACE FUNCTION public.buy_trade(
  p_wallet_address TEXT,
  p_amount_nano BIGINT,
  p_payout_multiplier NUMERIC,
  p_game_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_current_balance BIGINT;
  v_new_balance BIGINT;
BEGIN
  SELECT balance_nano INTO v_current_balance 
  FROM public.users_rugsfun 
  WHERE wallet_address = p_wallet_address;
  
  IF v_current_balance IS NULL THEN 
    RETURN json_build_object('success', false, 'error', 'User not found'); 
  END IF;

  IF v_current_balance < p_amount_nano THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.users_rugsfun 
  SET balance_nano = balance_nano - p_amount_nano 
  WHERE wallet_address = p_wallet_address 
  RETURNING balance_nano INTO v_new_balance;
  
  -- Sync legacy balance column
  UPDATE public.users_rugsfun 
  SET balance = v_new_balance::NUMERIC / 1000000000 
  WHERE wallet_address = p_wallet_address;

  RETURN json_build_object(
    'success', true, 
    'new_balance', v_new_balance::NUMERIC / 1000000000,
    'new_balance_nano', v_new_balance::TEXT
  );
END;
$$ LANGUAGE plpgsql;

-- Sell Trade RPC
CREATE OR REPLACE FUNCTION public.sell_trade(
  p_wallet_address TEXT,
  p_payout_nano BIGINT,
  p_game_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  -- ATOMIC CREDIT
  UPDATE public.users_rugsfun 
  SET balance_nano = balance_nano + p_payout_nano 
  WHERE wallet_address = p_wallet_address
  RETURNING balance_nano INTO v_new_balance;

  -- Sync legacy balance column
  UPDATE public.users_rugsfun 
  SET balance = v_new_balance::NUMERIC / 1000000000 
  WHERE wallet_address = p_wallet_address;

  RETURN json_build_object(
    'success', true, 
    'new_balance', v_new_balance::NUMERIC / 1000000000,
    'new_balance_nano', v_new_balance::TEXT
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 4: Ledger Health View
-- (For solvency audits)
-- ============================================

CREATE OR REPLACE VIEW public.vw_ledger_health AS
SELECT 
  SUM(balance_nano) as total_liabilities_nano,
  COUNT(*) as total_users
FROM public.users_rugsfun;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check settlement tracking columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'games_rugs_fun' 
  AND column_name IN ('settled', 'finalized_onchain', 'settlement_attempts', 'last_settlement_attempt')
ORDER BY ordinal_position;

-- Check balance_nano column
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users_rugsfun' 
  AND column_name = 'balance_nano';

-- Check RPC functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('buy_trade', 'sell_trade');

-- Check view exists
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'vw_ledger_health';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE 'Settlement tracking: enabled';
  RAISE NOTICE 'Nano-precision balances: enabled';
  RAISE NOTICE 'Atomic trade RPCs: enabled';
  RAISE NOTICE 'Ledger health view: enabled';
END $$;
