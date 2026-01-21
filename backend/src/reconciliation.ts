import { supabase } from './lib/supabase';
import { onChainEndGame, onChainSettleTrade, gameManagerContract, syncBalance } from './lib/contracts';
import { ethers } from 'ethers';

interface PendingGame {
    game_id: string;
    crash_multiplier: number;
    settled: boolean;
    finalized_onchain: boolean;
    settlement_attempts: number;
}

export async function reconcileSettlements() {
    try {
        // @ts-ignore - New columns not in generated types yet
        const { data: pendingGames, error } = await (supabase as any)
            .from('games_rugs_fun')
            .select('game_id, crash_multiplier, settled, finalized_onchain, settlement_attempts')
            .not('crash_multiplier', 'is', null)
            .gt('crash_multiplier', 0) // Only games with valid crash multiplier
            .eq('settled', false)
            .lt('settlement_attempts', 5) // Max 5 retries
            .order('created_at', { ascending: true })
            .limit(10);

        if (error || !pendingGames || pendingGames.length === 0) return;

        console.log(`🔄 Reconciliation: Found ${pendingGames.length} pending games`);

        for (const game of (pendingGames as any) as PendingGame[]) {
            await reconcileGame(game);
        }
    } catch (err) {
        console.error(' Reconciliation loop error:', err);
    }
}

async function reconcileGame(game: PendingGame) {
    const gameId = parseInt(game.game_id);

    // Validate game data
    if (isNaN(gameId) || !game.crash_multiplier || game.crash_multiplier <= 0) {
        console.warn(`⏭️  Skipping invalid game: ${game.game_id} (crash_multiplier: ${game.crash_multiplier})`);
        // Mark as settled to stop retrying
        await (supabase as any)
            .from('games_rugs_fun')
            .update({ settled: true } as any)
            .eq('game_id', game.game_id);
        return;
    }

    // Stop retrying if max attempts reached
    if (game.settlement_attempts >= 5) {
        console.warn(`⏭️  Game ${gameId}: Max retry attempts reached, marking as settled`);
        await (supabase as any)
            .from('games_rugs_fun')
            .update({ settled: true } as any)
            .eq('game_id', game.game_id);
        return;
    }

    try {
        // @ts-ignore - New columns not in generated types yet
        await (supabase as any)
            .from('games_rugs_fun')
            .update({
                settlement_attempts: game.settlement_attempts + 1,
                last_settlement_attempt: new Date().toISOString()
            } as any)
            .eq('game_id', game.game_id);

        const currentGameId = await gameManagerContract.currentGameId();
        const isActive = await gameManagerContract.gameActive();

        if (gameId >= Number(currentGameId)) return;
        if (gameId === Number(currentGameId) - 1 && isActive) return;

        // Check if game is already finalized on-chain
        const gameResult = await gameManagerContract.getGameResult(gameId);
        const alreadyFinalized = gameResult.endTime > 0;

        if (!game.finalized_onchain) {
            if (alreadyFinalized) {
                // Game is finalized on-chain but not marked in DB
                console.log(`✅ Game ${gameId}: Already finalized on-chain, updating DB`);

                // Update Supabase with finalized status and game metadata
                // @ts-ignore - New columns not in generated types yet
                await (supabase as any)
                    .from('games_rugs_fun')
                    .update({
                        finalized_onchain: true,
                        crash_multiplier: game.crash_multiplier,
                    } as any)
                    .eq('game_id', game.game_id);
            } else {
                // Try to finalize on-chain
                console.log(`🔧 Game ${gameId}: Attempting endGame (retry ${game.settlement_attempts + 1})`);

                // Pass raw multiplier - onChainEndGame handles the conversion
                const endGameRes = await onChainEndGame(gameId, game.crash_multiplier);

                if (endGameRes.success) {
                    console.log(`✅ Game ${gameId}: endGame succeeded on retry`);

                    // Update Supabase with finalized status and game metadata
                    // @ts-ignore - New columns not in generated types yet
                    await (supabase as any)
                        .from('games_rugs_fun')
                        .update({
                            finalized_onchain: true,
                            crash_multiplier: game.crash_multiplier,
                            // total_volume will be updated by settlement reconciliation
                        } as any)
                        .eq('game_id', game.game_id);
                } else {
                    return;
                }
            }
        }

        const { data: trades } = await (supabase as any)
            .from('trades_rugs_fun')
            .select('wallet_address, amount, sell_multiplier')
            .eq('game_id', game.game_id);

        if (!trades) return;

        console.log(`🏦 Game ${gameId}: Settling ${trades.length} trades`);

        let allSettled = true;
        for (const trade of trades) {
            const cashoutMultiplier = trade.sell_multiplier || 0;

            if (cashoutMultiplier > 0) {
                const betAmountNano = Math.floor((trade.amount || 0) * 1_000_000_000);

                const settleRes = await onChainSettleTrade(
                    gameId,
                    trade.wallet_address,
                    betAmountNano.toString(),
                    cashoutMultiplier
                );

                if (!settleRes.success) {
                    allSettled = false;
                } else if (ethers.isAddress(trade.wallet_address)) {
                    await syncBalance(trade.wallet_address);
                }
            }
        }

        if (allSettled) {
            // @ts-ignore - New columns not in generated types yet
            await (supabase as any)
                .from('games_rugs_fun')
                .update({ settled: true } as any)
                .eq('game_id', game.game_id);

            console.log(`✅ Game ${gameId}: Fully reconciled and settled`);
        }

    } catch (err: any) {
        console.error(`❌ Game ${gameId}: Reconciliation error:`, err.message);
    }
}

export function startReconciliationLoop() {
    console.log(' Starting settlement reconciliation loop (every 15s)');
    reconcileSettlements();
    setInterval(reconcileSettlements, 15000);
}
