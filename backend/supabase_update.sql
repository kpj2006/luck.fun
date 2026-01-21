-- 1. Add balance_nano column to the users_rugsfun table
ALTER TABLE public.users_rugsfun ADD COLUMN IF NOT EXISTS balance_nano BIGINT DEFAULT 0;

-- 2. Migrate existing decimal data to nano-units
-- FLOOR(balance * 1e9) ensures 9-decimal precision alignment
UPDATE public.users_rugsfun 
SET balance_nano = FLOOR(balance * 1000000000) 
WHERE balance IS NOT NULL;

-- 3. Create or Update the buy_trade RPC to use pure integer nano-units
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
  SELECT balance_nano INTO v_current_balance FROM public.users_rugsfun WHERE wallet_address = p_wallet_address;
  IF v_current_balance IS NULL THEN RETURN json_build_object('success', false, 'error', 'User not found'); END IF;

  IF v_current_balance < p_amount_nano THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.users_rugsfun SET balance_nano = balance_nano - p_amount_nano WHERE wallet_address = p_wallet_address RETURNING balance_nano INTO v_new_balance;
  UPDATE public.users_rugsfun SET balance = v_new_balance::NUMERIC / 1000000000 WHERE wallet_address = p_wallet_address;

  RETURN json_build_object(
    'success', true, 
    'new_balance', v_new_balance::NUMERIC / 1000000000,
    'new_balance_nano', v_new_balance::TEXT -- Use TEXT for safe transport
  );
END;
$$ LANGUAGE plpgsql;

-- 4. Create or Update the sell_trade RPC to use pure integer nano-units
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

  -- Sync legacy balance
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

-- 5. Create a view for Ledger Health (sum of all user balances)
CREATE OR REPLACE VIEW public.vw_ledger_health AS
SELECT 
  SUM(balance_nano) as total_liabilities_nano,
  COUNT(*) as total_users
FROM public.users_rugsfun;
