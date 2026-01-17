import WebSocket, { WebSocketServer } from "ws";
import { createTickGenerator, generateCrashPoint } from "./lib/price_ticks";
import { supabase } from "./lib/supabase";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { getPlayerBalance, processWithdrawal, onChainStartGame, onChainEndGame, onChainSettleTrade, gameManagerContract, syncBalance } from "./lib/contracts";
import { ethers } from "ethers";
interface Trade {
  id: number;
  gameId: number;
  buy: number;
  buy_amount: number;
  sell?: number;
  pnl?: number;
  userId: string;
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

const wss = new WebSocketServer({ port: 8080 });

let tickGenerator: ReturnType<typeof createTickGenerator>;
let currentMultiplier = 1.0;
let gameState: "WAITING" | "ACTIVE" | "CRASHED" = "WAITING";
let timer = 0;
let gameInterval: any;
let timerInterval: any;
let gameId: any;

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
  // Reset per-game state
  users = [];
  currentGameTicks = [];
  const target = generateCrashPoint();
  tickGenerator = createTickGenerator(target);
  gameState = "WAITING"; // Don't allow bets until on-chain is ready

  // Get numerical game ID from contract
  try {
    const isActive = await gameManagerContract.gameActive();
    let onChainId = await gameManagerContract.currentGameId();
    gameId = Number(onChainId);

    if (isActive) {
      console.log(`⚠️ Game ${gameId} is already active on-chain. Resetting...`);
      await onChainEndGame(gameId, 1.0);
      // Wait a moment for state to settle
      await new Promise(r => setTimeout(r, 2000));
      onChainId = await gameManagerContract.currentGameId();
      gameId = Number(onChainId);
    }

    console.log(`📡 Syncing with Monad: Game ID ${gameId}`);

    // 1. Register in Supabase first (Upsert to avoid collisions)
    const { error: sbError } = await supabase
      .from("games_rugs_fun")
      .upsert({
        game_id: gameId.toString(),
      }, { onConflict: 'game_id' });

    if (sbError) {
      console.error("❌ Supabase Game Registration Failed:", sbError);
      // We can continue if it's just a duplicate, but logged it
    } else {
      console.log(`✅ Supabase Sync: Game ${gameId} registered.`);
    }

    // 2. Start on-chain (WAIT for it)
    console.log(`⛓️  Starting Game ${gameId} on-chain...`);
    const startRes = await onChainStartGame(gameId);

    if (!startRes.success) {
      console.error(`🛑 ABORT: Failed to start game ${gameId} on-chain. Check wallet/nonce.`);
      gameState = "WAITING";
      // Schedule a restart? No, let user fix or wait for next tick.
      // For now, retry index.ts manually if this happens.
      return;
    }

    console.log(`🚀 Game ${gameId} ACTIVE on-chain!`);
    gameState = "ACTIVE";

  } catch (err) {
    console.error("❌ Fatal Startup Error:", err);
    gameState = "WAITING";
    return;
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

      // 1. End Game On-Chain
      await onChainEndGame(gameId, currentMultiplier);

      // 1.5 Settle ALL Trades (Winners & Losers)
      for (const user of users) {
        const activeTrade = user.trades.find((t) => t.gameId === gameId);
        if (activeTrade) {
          const cashoutMultiplier = activeTrade.sell || 0;
          console.log(`🏦 On-chain settling Game ${gameId} for ${user.userId} (Mult: ${cashoutMultiplier})`);

          try {
            await onChainSettleTrade(
              gameId,
              user.userId,
              activeTrade.buy_amount.toString(),
              cashoutMultiplier
            );
            await syncBalance(user.userId);

            // Final trade update broadcast
            if (user.socket && user.socket.readyState === WebSocket.OPEN) {
              user.socket.send(JSON.stringify({
                type: "trade-update",
                userId: user.userId,
                trades: user.trades,
                new_balance: await getPlayerBalance(user.userId)
              }));
            }
          } catch (err) {
            console.error(`❌ Failed to settle trade for ${user.userId}:`, err);
          }
        }
      }

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

      // 2️⃣ Wait 2 seconds before starting WAITING timer
      setTimeout(() => {
        timer = 8;
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
      }, 2000);
    }
  }, 500);
};

// --- WebSocket Connection ---
wss.on("connection", (ws) => {
  console.log("🟢 New client connected");

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
          const balance = await syncBalance(data.userId);
          ws.send(
            JSON.stringify({
              type: "balance",
              balance,
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
        syncBalance(data.userId);

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
        // Sync balance before buy to ensure deposit reflected
        await syncBalance(data.userId);

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
          buy_amount: data.buyAmount,
          userId: user.userId,
        };
        // check for balance if trade is valid and update balance.
        supabase
          .rpc("buy_trade", {
            p_wallet_address: data.userId,
            p_amount: data.buyAmount / 1000000000,
            p_payout_multiplier: currentMultiplier,
            p_game_id: gameId.toString(),
          })
          .then(({ data, error }: { data: any; error: any }) => {
            if (error) console.error(error);
            else {
              console.log("✅ Buy trade result:", data);
              user.trades.push(trade);
              // global trades array
              userTrades.push(trade);
              broadcast({
                type: "trade-update",
                userId: user.userId,
                trades: user.trades,
                new_balance: data.new_balance,
              });
            }
          });
      }
      // --- SELL ---
      if (data.type === "sell") {
        const user = users.find((u) => u.userId === data.userId);
        if (!user) return;

        const openTrade = user.trades.find((t) => t.sell === undefined && t.gameId === gameId);
        const openGlobalTrade = userTrades.find((t) => t.sell === undefined && t.gameId === gameId);
        if (!openTrade) return;
        if (!openGlobalTrade) return;

        openTrade.sell = data.sell; // Use client multiplier
        openTrade.pnl = ((data.sell - openTrade.buy) / openTrade.buy) * 100;

        supabase
          .rpc("sell_trade", {
            p_wallet_address: data.userId,
            p_sell_multiplier: data.sell,
            p_game_id: gameId.toString(),
          })
          .then(({ data: rpcData, error }) => {
            if (error) {
              console.error("❌ Error selling trade:", error);
              ws.send(JSON.stringify({ type: "error", message: error.message }));
              return;
            }
            console.log("✅ Trade sold successfully (Off-chain) for user:", data.userId);

            // Update local state is already done above, but refresh from RPC results if needed
            // Broadcast updated trades to specific user
            broadcast({
              type: "trade-update",
              userId: user.userId,
              trades: user.trades,
              new_balance: (rpcData as any)?.new_balance,
            });
          });
      }
    } catch (err) {
      console.error("❌ Invalid WS message:", err);
    }
  });

  ws.on("close", () => console.log("🔴 Client disconnected"));
});

// --- Start first game ---
startGame();

console.log(
  `✅ WebSocket server running on ${process.env.CLIENT_URL ?? "ws://localhost:8080"
  } `
);
