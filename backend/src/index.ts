import WebSocket, { WebSocketServer } from "ws";
import { createTickGenerator, generateCrashPoint } from "./lib/price_ticks";
import { supabase } from "./lib/supabase";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { getPlayerBalance, processWithdrawal, onChainStartGame, onChainEndGame, onChainSettleTrade, getContractSolvency, executeTreasurySweep, gameManagerContract, syncBalance, waitForChain, withTimeout, withRetry } from "./lib/contracts";
import { ethers } from "ethers";
interface Trade {
  id: number;
  gameId: number;
  buy: number;
  buy_amount: number;
  sell?: number;
  pnl?: number;
  userId: string;
  settled?: boolean;
}

interface User {
  userId: string;
  trades: Trade[];
  socket?: WebSocket;
}

interface GameTick {
  time: number;
  value: number;
}

interface GameHistory {
  id: number;
  crashedAt: number;
  ticks: GameTick[];
}

// Use port 8081 since 8080 is in use by Apache
const PORT = process.env.PORT || 8081;

// Listen on all interfaces (0.0.0.0) to accept connections from mobile devices
const wss = new WebSocketServer({
  port: Number(PORT),
  host: '0.0.0.0' // This allows connections from any IP on your network
});

let tickGenerator: ReturnType<typeof createTickGenerator>;
let currentMultiplier = 1.0;
let gameState: "WAITING" | "ACTIVE" | "CRASHED" = "WAITING";
let timer = 0;
let gameInterval: any;
let timerInterval: any;
let gameId: any;
let localGameCounter = 1000; // Local counter for off-chain games
let isOnChainGame = false; // Track if current game is on-chain
let endGameConfirmed = false; // New gate for settlements
let onChainStartPromise: Promise<boolean> | null = null; // Track when on-chain start completes

let users: User[] = [];
let currentGameTicks: GameTick[] = [];
let previousGames: GameHistory[] = []; // holds last 10 games only
let userTrades: Trade[] = [];
let globalChats: {
  username: string;
  message: string;
}[] = [
    {
      username: "System",
      message: "Welcome to the global chat. Be respectful and have fun!",
    },
  ];

// --- Broadcast Helper ---
const broadcast = (data: any) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// dotenv
dotenv.config();

// --- Start Game ---
const startGame = async () => {
  // Initial generator setup
  const target = generateCrashPoint();
  tickGenerator = createTickGenerator(target);
  currentGameTicks = [];
  endGameConfirmed = false;
  isOnChainGame = false; // Start as off-chain
  onChainStartPromise = null; // Reset promise for new game
  users = []; // Reset users for new game

  // Use local counter for off-chain games
  gameId = localGameCounter++;
  gameState = "ACTIVE"; // Start immediately without blockchain

  console.log(`🎮 Game ${gameId} starting OFF-CHAIN (no blockchain until someone bets)`);

  // Register in Supabase
  const { error: sbError } = await supabase
    .from("games_rugs_fun")
    .upsert({
      game_id: gameId.toString(),
    }, { onConflict: 'game_id' });

  if (sbError) {
    console.error("❌ Supabase Game Registration Failed:", sbError);
  }

  // Tick generator loop
  gameInterval = setInterval(async () => {
    const tick = tickGenerator();
    currentMultiplier = tick.value;
    // Record tick
    currentGameTicks.push({ time: Date.now(), value: currentMultiplier });
    // Broadcast live tick
    broadcast({
      type: "tick",
      multiplier: currentMultiplier,
      state: gameState,
      timer: 0,
      gameId: gameId,
    });

    // --- Crash ---
    if (tick.crashed) {
      clearInterval(gameInterval);
      gameState = "CRASHED";
      console.log(`💥Game crashed at multiplier: ${currentMultiplier}`);

      // Check if anyone actually played in this game
      const hasActiveTrades = users.some(user =>
        user.trades.some(trade => trade.gameId === gameId)
      );

      if (!hasActiveTrades || !isOnChainGame) {
        console.log(`⏭️  Game ${gameId} ${!hasActiveTrades ? 'had no players' : 'was off-chain only'} - skipping ALL blockchain calls`);
        endGameConfirmed = false; // No need for settlements

        // Still update Supabase and broadcast crash
        const total_volume = currentGameTicks
          .map((data) => data.value)
          .reduce((acc, val) => acc + val, 0);

        supabase
          .from("games_rugs_fun")
          .update({
            crash_multiplier: currentMultiplier,
            total_volume: total_volume,
          })
          .eq("game_id", gameId.toString())
          .then(({ error }) => {
            if (error) console.error("❌ Error updating game in Supabase:", error);
            else console.log("✅ Game result updated in Supabase (no players).");
          });

        // Add to history
        previousGames.push({
          id: Date.now(),
          crashedAt: currentMultiplier,
          ticks: currentGameTicks,
        });
        if (previousGames.length > 10) {
          previousGames.shift();
        }
        currentGameTicks = [];

        broadcast({
          type: "tick",
          multiplier: currentMultiplier,
          state: "CRASHED",
          timer: 0,
        });
        broadcast({
          type: "prev-game",
          data: previousGames,
        });

        // Start next game after delay (match normal game flow)
        setTimeout(() => {
          timer = 10;
          timerInterval = setInterval(() => {
            broadcast({
              type: "tick",
              multiplier: currentMultiplier,
              state: "WAITING",
              timer,
            });
            timer--;

            if (timer < 0) {
              clearInterval(timerInterval);
              startGame();
            }
          }, 1000);
        }, 20000);
        return; // Exit early - NO blockchain calls
      }

      // 1. Wait for on-chain start to complete, then end game
      console.log(`📡 Finalizing Game ${gameId} on-chain (${users.filter(u => u.trades.some(t => t.gameId === gameId)).length} players)...`);

      // CRITICAL: Wait for on-chain start to complete before ending
      if (onChainStartPromise) {
        console.log(`⏳ Waiting for on-chain start to complete before ending...`);
        await onChainStartPromise.catch(() => false); // Wait but don't throw
        console.log(`✅ On-chain start complete, now ending game...`);
      }

      withTimeout(onChainEndGame(gameId, currentMultiplier), 30000, "End Game On-Chain Timed Out")
        .then(async (endGameRes) => {
          if (endGameRes && endGameRes.success) {
            endGameConfirmed = true; // Gate unlocked
            console.log(`✅ Game ${gameId} finalized on-chain. TX: ${endGameRes.txHash || 'N/A'}`);
          } else {
            console.warn(`⚠️ EndGame attempt failed for Game ${gameId}. Deferring settlements.`);
            return; // ❗ DO NOT SETTLE if on-chain state isn't ready
          }

          // 1.5 Settle ALL Trades (Guarded and Selective)
          console.log(`🏦 Starting settlements for Game ${gameId}...`);
          for (const user of users) {
            const activeTrade = user.trades.find((t) => t.gameId === gameId);
            if (activeTrade && !activeTrade.settled && endGameConfirmed) { // Double check gate
              const cashoutMultiplier = activeTrade.sell || 0;

              // Non-blocking settlement for winners only
              if (cashoutMultiplier > 0) {
                console.log(`🏦 On-chain settling Game ${gameId} for ${user.userId} (Mult: ${cashoutMultiplier})`);
                withTimeout(
                  onChainSettleTrade(
                    gameId,
                    user.userId,
                    activeTrade.buy_amount.toString(),
                    cashoutMultiplier
                  ),
                  30000,
                  `Settlement for ${user.userId} timed out`
                ).then(async (settleRes) => {
                  if (settleRes.success) {
                    activeTrade.settled = true; // Mark only on success
                    console.log(`✅ Win settled for ${user.userId}. TX: ${settleRes.txHash || 'N/A'}`);
                    if (ethers.isAddress(user.userId)) {
                      const { balance, balanceNano } = await syncBalance(user.userId);
                      // Final trade update broadcast
                      if (user.socket && user.socket.readyState === WebSocket.OPEN) {
                        user.socket.send(JSON.stringify({
                          type: "trade-update",
                          userId: user.userId,
                          trades: user.trades,
                          new_balance: balance,
                          new_balance_nano: balanceNano,
                        }));
                      }
                    }
                  }
                }).catch(err => {
                  console.error(`❌ Failed/Timed out to settle trade for ${user.userId}:`, err);
                });
              } else {
                // User Lost (Crashed) - Settle on-chain with multiplier=0 to deduct balance
                console.log(`📉 Game ${gameId}: Settling LOSS on-chain for ${user.userId}`);
                withTimeout(
                  onChainSettleTrade(
                    gameId,
                    user.userId,
                    activeTrade.buy_amount.toString(),
                    0 // 0 multiplier = full loss
                  ),
                  30000,
                  `Loss settlement for ${user.userId} timed out`
                ).then(async (settleRes) => {
                  if (settleRes.success) {
                    activeTrade.settled = true;
                    console.log(`✅ Loss settled on-chain for ${user.userId}. TX: ${settleRes.txHash || 'N/A'}`);
                  } else {
                    console.error(`❌ Failed to settle loss on-chain for ${user.userId}`);
                  }
                  // Sync and notify user of their final balance
                  if (ethers.isAddress(user.userId)) {
                    const { balance, balanceNano } = await syncBalance(user.userId);
                    if (user.socket && user.socket.readyState === WebSocket.OPEN) {
                      user.socket.send(JSON.stringify({
                        type: "trade-update",
                        userId: user.userId,
                        trades: user.trades,
                        new_balance: balance,
                        new_balance_nano: balanceNano,
                      }));
                    }
                  }
                }).catch(err => {
                  console.error(`❌ Error settling loss for ${user.userId}:`, err);
                  // Still try to notify user even on error
                  getPlayerBalance(user.userId).then(({ balance, balanceNano }) => {
                    if (user.socket && user.socket.readyState === WebSocket.OPEN) {
                      user.socket.send(JSON.stringify({
                        type: "trade-update",
                        userId: user.userId,
                        trades: user.trades,
                        new_balance: balance,
                        new_balance_nano: balanceNano,
                      }));
                    }
                  });
                });
              }
            }
          }
        })
        .catch(err => {
          console.warn(`⚠️ EndGame attempt failed for Game ${gameId}:`, err.message);
          // ❗ DO NOTHING ELSE — never crash, never settle
        });

      // Save finished game to history
      previousGames.push({
        id: Date.now(),
        crashedAt: currentMultiplier,
        ticks: currentGameTicks,
      });

      // Keep only last 10 games
      if (previousGames.length > 10) {
        previousGames.shift();
      }
      const total_volume = currentGameTicks
        .map((data) => data.value)
        .reduce((acc, val) => acc + val, 0);
      currentGameTicks = [];

      // Update off chain ledger
      supabase
        .from("games_rugs_fun")
        .update({
          crash_multiplier: currentMultiplier,
          total_volume: total_volume,
        })
        .eq("game_id", gameId.toString())
        .then(({ error }) => {
          if (error) console.error("❌ Error updating game in Supabase:", error);
          else console.log("✅ Game result updated in Supabase.");
        });
      broadcast({
        type: "tick",
        multiplier: currentMultiplier,
        state: "CRASHED",
        timer: 0,
      });
      broadcast({
        type: "prev-game",
        data: previousGames,
      });

      // 2️⃣ Wait 20 seconds before starting WAITING timer (30s total interval)
      setTimeout(() => {
        timer = 10;
        timerInterval = setInterval(() => {
          broadcast({
            type: "tick",
            multiplier: currentMultiplier,
            state: "WAITING",
            timer,
          });
          timer--;

          if (timer < 0) {
            clearInterval(timerInterval);
            startGame(); // start new game
          }
        }, 1000);
      }, 20000);
    }
  }, 500);
};

// --- WebSocket Connection ---
wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🟢 NEW CLIENT CONNECTED from ${clientIp}`);
  console.log(`   Total clients: ${wss.clients.size}`);

  broadcast({
    type: "global-chat",
    chats: globalChats,
  });

  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      console.log(`Sending PING`);
      ws.send(
        JSON.stringify({
          type: "PING",
          serverTimestamp: Date.now(),
        })
      );
    }
  }, 2000);

  // Send initial state & recent game history
  ws.send(
    JSON.stringify({
      type: "init",
      multiplier: currentMultiplier,
      state: gameState,
      timer,
      allUserTrades: users,
      previousGames,
      currentGameTicks, // include current round tick data for redraws
    })
  );

  // Update live user count
  broadcast({
    type: "client-count",
    count: wss.clients.size,
  });

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "PONG") {
        const rtt = Date.now() - data.serverTimestamp;
        const latency = Math.round(rtt / 2);

        ws.send(
          JSON.stringify({
            type: "LATENCY_UPDATE",
            latency,
          })
        );
      }

      if (data.type === "global-chat") {
        globalChats.push({
          username: data.chats.username,
          message: data.chats.message,
        });
        broadcast({
          type: "global-chat",
          chats: globalChats,
        });
      }

      // --- WITHDRAW ---
      if (data.type === "withdraw") {
        const { userId, amount } = data;

        if (!ethers.isAddress(userId)) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid wallet address" }));
          return;
        }

        // Process withdrawal directly from blockchain (Supabase sync optional)
        const result = await processWithdrawal(userId, amount.toString());

        if (!result.success) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: result.error || "Withdrawal failed",
            })
          );
          return;
        }

        // Sync balance after withdrawal
        const newBalance = await syncBalance(userId);

        ws.send(
          JSON.stringify({
            type: "withdrawal-success",
            txHash: result.txHash,
            newBalance: newBalance,
          })
        );

        console.log(`✅ Withdrawal processed for ${userId}: ${amount} RUGS, tx: ${result.txHash}`);
      }

      // --- GET BALANCE ---
      if (data.type === "get-balance") {
        try {
          if (!ethers.isAddress(data.userId)) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid wallet address" }));
            return;
          }
          const { balance, balanceNano } = await syncBalance(data.userId);
          ws.send(
            JSON.stringify({
              type: "balance",
              balance,
              balance_nano: balanceNano,
            })
          );
        } catch (error: any) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: error.message,
            })
          );
        }
      }

      // --- Identify / Reconnect user ---
      if (data.type === "identify") {
        // Sync balance on reconnect
        if (ethers.isAddress(data.userId)) {
          syncBalance(data.userId); // Just trigger sync, no need to await result here for identify
        }

        const user = users.find((u) => u.userId === data.userId);
        if (user) {
          user.socket = ws;
          ws.send(
            JSON.stringify({
              type: "trade-restore",
              userId: user.userId,
              trades: user.trades,
            })
          );
        }
        // Send current tick data for chart redraw
        ws.send(
          JSON.stringify({
            type: "tick-restore",
            ticks: currentGameTicks,
          })
        );
        ws.send(
          JSON.stringify({
            type: "prev-game",
            data: previousGames,
          })
        );
        return;
      }
      // --- BUY ---
      if (data.type === "buy") {
        if (!ethers.isAddress(data.userId)) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid wallet address" }));
          return;
        }

        // --- STATE GUARD: Only buy during ACTIVE state ---
        if (gameState !== "ACTIVE") {
          ws.send(JSON.stringify({ type: "error", message: "Market is closed. Please wait for the next round." }));
          return;
        }

        // --- STATE GUARD: One trade per user per game ---
        const existingUser = users.find((u) => u.userId === data.userId);
        if (existingUser && existingUser.trades.some(t => t.gameId === gameId)) {
          ws.send(JSON.stringify({ type: "error", message: "You already have an active trade for this game." }));
          return;
        }

        // Atomic balance check in Supabase. We sync first to ensure ledger is fresh.
        const { balanceNano } = await syncBalance(data.userId);

        // --- PRECISION GUARD: Strictly handle math as BigInt nano-units ---
        const rawRequestedNano = data.buyAmountNano
          ? BigInt(data.buyAmountNano)
          : BigInt(Math.floor(data.buyAmount));

        // FINAL SAFETY CLAMP: If frontend drift causes requested > balance, 
        // automatically clamp to "Max Bet" (balance - 1 nano).
        const balanceBigInt = BigInt(balanceNano);
        let safeAmountNano = rawRequestedNano;

        if (safeAmountNano >= balanceBigInt) {
          console.warn(`⚖️ Trade [${data.userId}]: Clamping drifted request ${safeAmountNano} to safe limit ${balanceBigInt - 1n}`);
          safeAmountNano = balanceBigInt > 0n ? balanceBigInt - 1n : 0n;
        } else if (safeAmountNano > 0n) {
          // Still apply 1-unit buffer to normal bets for strict inequality safety
          safeAmountNano = safeAmountNano - 1n;
        }

        // DEBUG: Final Ledger Check
        console.log(`💎 Trade [${data.userId}]: Final: ${safeAmountNano}, Balance: ${balanceNano}, Diff: ${balanceBigInt - safeAmountNano}`);

        // ==========================================
        // CRITICAL FIX: Record trade IMMEDIATELY
        // This ensures hasActiveTrades=true even if
        // game crashes during on-chain setup
        // ==========================================
        let user = users.find((u) => u.userId === data.userId);
        if (!user) {
          user = { userId: data.userId, trades: [], socket: ws };
          users.push(user);
        } else {
          user.socket = ws;
        }

        const trade: Trade = {
          id: Date.now(),
          gameId: gameId,
          buy: currentMultiplier,
          buy_amount: Number(safeAmountNano),
          userId: user.userId,
        };

        // Record trade IMMEDIATELY in memory (before any async ops)
        user.trades.push(trade);
        userTrades.push(trade);
        console.log(`📝 Trade recorded in memory for ${user.userId} (Game ${gameId})`);

        // 🚀 IMMEDIATELY broadcast so Cash Out button activates
        // Balance will update again after Supabase confirms
        const remainingNano = (balanceBigInt - safeAmountNano).toString();
        broadcast({
          type: "trade-update",
          userId: user.userId,
          trades: user.trades,
          new_balance: Number(remainingNano) / 1_000_000_000,
          new_balance_nano: remainingNano,
        });

        // �🔥 FIRST BET → Start game on-chain in BACKGROUND (non-blocking)
        if (!isOnChainGame) {
          console.log(`🎯 First bet detected! Starting on-chain in background...`);
          isOnChainGame = true; // Mark immediately to prevent duplicate starts

          // Store promise so crash handler can wait for it
          onChainStartPromise = (async (): Promise<boolean> => {
            try {
              let onChainId = await withRetry(() => gameManagerContract.currentGameId());
              const onChainGameActive = await gameManagerContract.gameActive();

              if (onChainGameActive) {
                console.warn(`⚠️ Game ${onChainId} already active on-chain, force-ending first...`);
                await onChainEndGame(Number(onChainId), 1.0).catch(() => { });
                onChainId = await withRetry(() => gameManagerContract.currentGameId());
              }

              // Update gameId to on-chain ID for settlements
              const newGameId = Number(onChainId);
              console.log(`📡 Starting Game ${newGameId} on-chain...`);

              // Update all pending trades to use on-chain game ID
              if (gameId !== newGameId) {
                console.log(`🔄 Updating game ID from ${gameId} to ${newGameId}`);
                users.forEach(u => {
                  u.trades.forEach(t => {
                    if (t.gameId === gameId) t.gameId = newGameId;
                  });
                });
                userTrades.forEach(t => {
                  if (t.gameId === gameId) t.gameId = newGameId;
                });
                gameId = newGameId;
              }

              const startRes = await onChainStartGame(newGameId);
              if (startRes.success) {
                console.log(`✅ Game ${newGameId} started on-chain. TX: ${startRes.txHash || 'N/A'}`);
                return true;
              } else {
                console.error(`❌ Failed to start on-chain`);
                return false;
              }
            } catch (err) {
              console.error(`❌ Error starting on-chain:`, err);
              return false;
            }
          })();
        }

        // Deduct balance in Supabase
        supabase
          .rpc("buy_trade", {
            p_wallet_address: data.userId,
            p_amount_nano: safeAmountNano.toString() as any,
            p_payout_multiplier: currentMultiplier,
            p_game_id: gameId.toString(),
          } as any)
          .then(({ data: rpcData, error }: { data: any; error: any }) => {
            if (error || (rpcData && rpcData.success === false)) {
              console.error("❌ Buy trade failed:", error || rpcData?.error);

              // ROLLBACK: Remove trade from memory on failure
              const tradeIndex = user.trades.findIndex(t => t.id === trade.id);
              if (tradeIndex !== -1) user.trades.splice(tradeIndex, 1);
              const globalIndex = userTrades.findIndex(t => t.id === trade.id);
              if (globalIndex !== -1) userTrades.splice(globalIndex, 1);
              console.log(`🔙 Trade rolled back for ${user.userId}`);

              ws.send(JSON.stringify({
                type: "error",
                message: rpcData?.error || "Trade rejected: Insufficient balance or sequence error."
              }));
            } else {
              console.log("✅ Buy trade confirmed in Supabase:", rpcData);

              broadcast({
                type: "trade-update",
                userId: user.userId,
                trades: user.trades,
                new_balance: rpcData.new_balance,
                new_balance_nano: rpcData.new_balance_nano,
              });
            }
          });
      }
      // --- SELL ---
      if (data.type === "sell") {
        // --- STATE GUARD: Only sell during ACTIVE state ---
        if (gameState !== "ACTIVE") {
          ws.send(JSON.stringify({ type: "error", message: "Game has already crashed." }));
          return;
        }

        const user = users.find((u) => u.userId === data.userId);
        if (!user) return;

        const openTrade = user.trades.find((t) => t.sell === undefined && t.gameId === gameId);
        const openGlobalTrade = userTrades.find((t) => t.sell === undefined && t.gameId === gameId);

        if (!openTrade || !openGlobalTrade) {
          ws.send(JSON.stringify({ type: "error", message: "No active trade found to sell for this game." }));
          return;
        }

        // --- FAIRNESS GUARD: Clamp sell multiplier to current server state ---
        const sellMultiplier = Math.min(data.sell, currentMultiplier);
        openTrade.sell = sellMultiplier;

        // --- PRECISION GUARD: Calculate payout in nano-units using BigInt ---
        const payoutNano = BigInt(Math.floor(openTrade.buy_amount * sellMultiplier));
        openTrade.pnl = ((sellMultiplier - openTrade.buy) / openTrade.buy) * 100;

        supabase
          .rpc("sell_trade", {
            p_wallet_address: data.userId,
            p_payout_nano: payoutNano.toString() as any, // Atomic credit using nano-units
            p_game_id: gameId.toString(),
          } as any)
          .then(({ data: rpcData, error }) => {
            if (error) {
              console.error("❌ Error selling trade (atomic):", error);
              ws.send(JSON.stringify({ type: "error", message: error.message }));
              return;
            }
            console.log("✅ Trade sold successfully (Nano-ledger) for user:", data.userId);

            // Broadcast updated trades to specific user
            broadcast({
              type: "trade-update",
              userId: user.userId,
              trades: user.trades,
              new_balance: (rpcData as any)?.new_balance,
              new_balance_nano: (rpcData as any)?.new_balance_nano,
            });
          });
      }
    } catch (err) {
      console.error("❌ Invalid WS message:", err);
    }
  });

  ws.on("close", () => {
    console.log(`🔴 CLIENT DISCONNECTED (${clientIp})`);
    console.log(`   Remaining clients: ${wss.clients.size}`);
  });
});

// --- Initialize Server ---
const initServer = async () => {
  const host = '0.0.0.0';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ WEBSOCKET SERVER RUNNING`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🌐 Host: ${host}`);
  console.log(`🔌 Port: ${PORT}`);
  console.log(`📱 Mobile: ws://YOUR-LOCAL-IP:${PORT}`);
  console.log(`💻 Local: ws://localhost:${PORT}`);
  console.log(`🚀 Railway TCP Proxy: Check Railway dashboard for wss:// URL`);
  console.log(`${'='.repeat(60)}\n`);

  // Non-blocking chain wait
  waitForChain().then(() => {
    startGame();
  }).catch(err => {
    console.error("❌ Fatal: Failed to establish chain connectivity", err);
  });
};

initServer();
