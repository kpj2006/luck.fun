-- ============================================
-- Cleanup Script: Remove Old Games from Previous Contract
-- Run in Supabase SQL Editor after new deployment
-- ============================================

-- WARNING: This will delete game data from the previous contract!
-- Only run this AFTER confirming the new contract is working.

-- 1. Mark all old games as settled to stop reconciliation from processing them
UPDATE public.games_rugs_fun
SET 
  settled = TRUE,
  finalized_onchain = TRUE,
  settlement_attempts = 5
WHERE 
  game_id NOT LIKE '%-%' -- Only numeric game IDs (new format)
  OR crash_multiplier < 1; -- Games with sub-1.0x crashes from before fix

-- 2. Clean up games with invalid UUIDs (from earlier test runs)
DELETE FROM public.games_rugs_fun
WHERE game_id LIKE '%-%' -- UUID format from old runs
  AND settled = FALSE;

-- 3. Reset game counter for fresh start (optional - only if you want to restart from Game 1)
-- TRUNCATE public.games_rugs_fun CASCADE;
-- TRUNCATE public.trades_rugs_fun CASCADE;

-- 4. Verify cleanup
SELECT 
  COUNT(*) as total_games,
  COUNT(*) FILTER (WHERE settled = TRUE) as settled_games,
  COUNT(*) FILTER (WHERE settled = FALSE) as pending_games
FROM public.games_rugs_fun;

-- 5. Show remaining pending games (should be 0 or only recent games)
SELECT game_id, crash_multiplier, settled, finalized_onchain, settlement_attempts
FROM public.games_rugs_fun
WHERE settled = FALSE
ORDER BY created_at DESC
LIMIT 20;
