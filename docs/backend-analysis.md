# Backend Analysis - Monad Migration Impact

## Current Backend Architecture

### File Structure
```
backend/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts (WebSocket server - 399 lines)
    ├── lib/
    │   ├── price_ticks.ts (Game crash logic)
    │   └── supabase.ts (Database client)
    └── types/
        └── supabase.ts (Database types)
```

### Technology Stack
- **Runtime**: Node.js with TypeScript
- **WebSocket**: `ws` library (port 8080)
- **Database**: Supabase (PostgreSQL)
- **Dependencies**: uuid, dotenv, @supabase/supabase-js

---

## Backend Responsibilities

### 1. Real-Time Game State Management (CRITICAL)
**File**: `index.ts` (lines 1-399)

```typescript
let gameState: "WAITING" | "ACTIVE" | "CRASHED" = "WAITING";
let currentMultiplier = 1.0;
let timer = 0;
```

**What it does:**
- Manages game lifecycle: WAITING → ACTIVE → CRASHED
- Broadcasts live multiplier updates every 500ms
- Coordinates countdown timer (8 seconds between games)
- Maintains WebSocket connections for 1000+ simultaneous players

**Real-time messages:**
- `tick`: Current multiplier + game state
- `trade-update`: User buy/sell confirmations
- `prev-game`: Historical crash data
- `global-chat`: In-game chat messages
- `client-count`: Active player count
- `PING/PONG`: Latency monitoring

---

### 2. Crash Multiplier Generation (SECURITY-CRITICAL)
**File**: `price_ticks.ts`

```typescript
function pickCrashMultiplier() {
  const r = Math.random();
  if (r < 0.49) return 2;   // 49% crash below 2x
  if (r < 0.57) return 10;  // 8% crash below 10x
  if (r < 0.59) return 50;  // 2% crash below 50x
  return 100;               // 1% crash below 100x
}

export function createTickGenerator() {
  let current = 1.0;
  let steps = 0;
  const maxTarget = pickCrashMultiplier();
  
  // Upward drift with jitter
  // 1% insta-rug at start
  // Random crash conditions
}
```

**What it does:**
- Server-side randomness generation (NOT on-chain)
- Prevents client-side manipulation
- Stateful tick generator with:
  - Upward drift simulation
  - Random crash triggers (5% after 10 steps)
  - Insta-rug mechanic (1% at game start)
  - Maximum 200 steps before forced crash

**⚠️ SECURITY ISSUE**: Uses `Math.random()` (predictable, not cryptographically secure)

---

### 3. Trade Execution & Balance Management
**File**: `index.ts` (lines 280-370)

#### Buy Trade
```typescript
if (data.type === "buy") {
  supabase.rpc("buy_trade", {
    p_wallet_address: data.userId,
    p_amount: data.buyAmount,
    p_payout_multiplier: currentMultiplier,
    p_game_id: gameId
  });
}
```

#### Sell Trade
```typescript
if (data.type === "sell") {
  openTrade.sell = currentMultiplier;
  openTrade.pnl = ((currentMultiplier - openTrade.buy) / openTrade.buy) * 100;
  
  supabase.rpc("sell_trade", {
    p_wallet_address: data.userId,
    p_sell_multiplier: currentMultiplier,
    p_game_id: gameId
  });
}
```

**What it does:**
- Executes buy/sell trades via Supabase RPC functions
- Calculates profit/loss (PnL) in real-time
- Updates user balances off-chain
- Broadcasts trade updates to all connected clients

**Database RPC Functions Used:**
1. `buy_trade(p_amount, p_game_id, p_payout_multiplier, p_wallet_address)`
   - Validates user has sufficient balance
   - Deducts bet amount from balance
   - Creates trade record in `trades_rugs_fun` table

2. `sell_trade(p_game_id, p_sell_multiplier, p_wallet_address)`
   - Calculates payout based on sell multiplier
   - Updates user balance with winnings
   - Marks trade as settled

---

### 4. Game History & State Persistence
**File**: `index.ts` (lines 30-50, 120-140)

```typescript
let currentGameTicks: GameTick[] = [];
let previousGames: GameHistory[] = []; // Last 10 games

// On crash
previousGames.push({
  id: Date.now(),
  crashedAt: currentMultiplier,
  ticks: currentGameTicks
});

// Update database
supabase
  .from("games_rugs_fun")
  .update({
    crash_multiplier: currentMultiplier,
    total_volume: total_volume
  })
  .eq("game_id", gameId);
```

**What it does:**
- Records every tick (time + multiplier value) during game
- Stores last 10 games in memory for quick access
- Persists game outcomes to `games_rugs_fun` table
- Calculates total volume per game

---

### 5. Global Chat System
**File**: `index.ts` (lines 240-250)

```typescript
if (data.type === "global-chat") {
  globalChats.push({
    username: data.chats.username,
    message: data.chats.message
  });
  broadcast({
    type: "global-chat",
    chats: globalChats
  });
}
```

**What it does:**
- Manages in-game chat for community interaction
- Broadcasts messages to all connected players
- No persistence (resets on server restart)

---

### 6. Client Reconnection & State Recovery
**File**: `index.ts` (lines 260-280)

```typescript
if (data.type === "identify") {
  const user = users.find(u => u.userId === data.userId);
  if (user) {
    ws.send(JSON.stringify({
      type: "trade-restore",
      userId: user.userId,
      trades: user.trades
    }));
  }
  // Restore current game ticks for chart redraw
  ws.send(JSON.stringify({
    type: "tick-restore",
    ticks: currentGameTicks
  }));
}
```

**What it does:**
- Restores active trades when user reconnects
- Sends historical tick data to redraw chart
- Prevents data loss during temporary disconnections

---

## Monad Migration Analysis

### ❌ CANNOT BE REPLACED BY SMART CONTRACTS

The backend is **ESSENTIAL** even after migrating to Monad. Here's why:

#### 1. Real-Time Requirements
**Blockchain Limitation:**
- Ethereum/Monad blocks: ~1-2 seconds
- Backend broadcasts: 500ms (2x faster)
- Required latency: <200ms for responsive UX

**Solution:**
✅ **KEEP BACKEND** for WebSocket real-time updates
- Cannot achieve 500ms tick broadcasts on-chain
- WebSocket is the only viable option for multiplayer gaming

---

#### 2. Crash Generation Must Be Server-Controlled
**Why not on-chain randomness?**

**Option A: Chainlink VRF**
```solidity
// Chainlink VRF request (takes 2-3 blocks = 4-6 seconds)
function requestRandomWords() external {
    s_requestId = COORDINATOR.requestRandomWords(
        keyHash, subId, requestConfirmations,
        callbackGasLimit, numWords
    );
}
```
❌ **Too slow**: 4-6 second delay per game unacceptable

**Option B: On-chain blockhash randomness**
```solidity
uint256 random = uint256(keccak256(abi.encodePacked(
    block.timestamp, block.difficulty, msg.sender
)));
```
❌ **Not secure**: Miners can manipulate blockhash

**Option C: Server-side generation (current approach)**
✅ **BEST FOR CRASH GAMES**: Fast, unpredictable (if using proper RNG)

**Recommendation:**
- Keep backend for crash generation
- Use cryptographically secure RNG (replace `Math.random()`)
- Optionally: Implement provably fair system with commit-reveal

---

#### 3. Trade Execution Latency
**Current flow:**
1. User clicks "Buy" → WebSocket message (50ms)
2. Backend validates balance → Supabase RPC (100ms)
3. Trade confirmed → Broadcast to all users (50ms)
**Total: ~200ms**

**On-chain flow:**
1. User signs transaction → Submit to mempool (500ms)
2. Block inclusion → Wait for confirmation (2-4 seconds)
3. Event emitted → Frontend reads event (1-2 seconds)
**Total: ~4-8 seconds**

❌ **Unacceptable for crash games** where multiplier changes every 500ms

**Solution:**
✅ **HYBRID APPROACH** (detailed below)

---

## Recommended Architecture After Monad Migration

### 🏗️ Hybrid Model: Smart Contracts + Backend

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│  - User wallet connection                                        │
│  - Transaction signing                                           │
│  - WebSocket client for real-time updates                       │
└──────────────┬────────────────────────────────┬─────────────────┘
               │                                │
               │ Deposits/Withdrawals           │ Real-time gameplay
               │ (Blockchain)                   │ (WebSocket)
               ▼                                ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│   MONAD SMART CONTRACTS      │    │    BACKEND (Node.js)         │
│                              │    │                              │
│  ✅ Deposit funds            │    │  ✅ Game state management    │
│  ✅ Withdraw funds           │    │  ✅ Crash generation         │
│  ✅ On-chain balance tracking│    │  ✅ Real-time tick broadcast │
│  ✅ Escrow/custody           │    │  ✅ Trade execution          │
│  ✅ Provably fair commits    │    │  ✅ Balance validation       │
│  ✅ Emergency pause          │    │  ✅ Chat system              │
│                              │    │  ✅ User reconnection        │
└──────────────────────────────┘    └──────────────┬───────────────┘
                                                   │
                                                   │ Postgres
                                                   ▼
                                    ┌──────────────────────────────┐
                                    │   SUPABASE DATABASE          │
                                    │                              │
                                    │  ✅ Game history             │
                                    │  ✅ Trade records            │
                                    │  ✅ User stats               │
                                    │  ✅ Leaderboards             │
                                    └──────────────────────────────┘
```

---

## Backend Responsibilities - Before vs After Monad

| Function | Current (Solana) | After Monad Migration | Notes |
|----------|------------------|----------------------|-------|
| **Deposits** | ❌ Backend | ✅ Smart Contract | Move to on-chain |
| **Withdrawals** | ❌ Backend | ✅ Smart Contract | Move to on-chain |
| **Balance Tracking** | ❌ Supabase | ✅ Smart Contract | Single source of truth |
| **Game State** | ✅ Backend | ✅ Backend | KEEP - Real-time required |
| **Crash Generation** | ✅ Backend | ✅ Backend | KEEP - Speed & security |
| **Tick Broadcasting** | ✅ Backend (500ms) | ✅ Backend (500ms) | KEEP - WebSocket needed |
| **Trade Execution** | ✅ Backend + DB | ✅ Backend + Blockchain | HYBRID - Fast validation + on-chain settlement |
| **Chat System** | ✅ Backend | ✅ Backend | KEEP - Real-time chat |
| **User Reconnection** | ✅ Backend | ✅ Backend | KEEP - Session management |
| **Game History** | ✅ Supabase | ✅ Supabase | KEEP - Fast queries |

---

## Required Backend Changes for Monad

### 1. Replace Balance Validation
**Before (Supabase RPC):**
```typescript
supabase.rpc("buy_trade", {
  p_wallet_address: data.userId,
  p_amount: data.buyAmount,
  // ...
});
```

**After (Smart Contract Read):**
```typescript
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Check on-chain balance
const userBalance = await contract.getBalance(walletAddress);
if (userBalance < buyAmount) {
  ws.send(JSON.stringify({
    type: "error",
    message: "Insufficient balance"
  }));
  return;
}

// Execute trade in database (off-chain ledger)
await supabase.from("trades_rugs_fun").insert({
  wallet_address: data.userId,
  amount: data.buyAmount,
  payout_multiplier: currentMultiplier,
  game_id: gameId
});
```

---

### 2. Add Settlement Batch Processing
**New Feature**: Periodically settle trades on-chain

```typescript
// Every 10 games or every 5 minutes
async function settleBatchOnChain() {
  // Get all unsettled trades from last N games
  const { data: trades } = await supabase
    .from("trades_rugs_fun")
    .select("*")
    .eq("settled_on_chain", false)
    .limit(100);

  // Batch settle via smart contract
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, serverWallet);
  
  const settlements = trades.map(t => ({
    user: t.wallet_address,
    amount: t.profit_loss,
    gameId: t.game_id
  }));
  
  const tx = await contract.batchSettle(settlements);
  await tx.wait();
  
  // Mark as settled
  await supabase
    .from("trades_rugs_fun")
    .update({ settled_on_chain: true })
    .in("id", trades.map(t => t.id));
}

setInterval(settleBatchOnChain, 5 * 60 * 1000); // Every 5 minutes
```

---

### 3. Implement Provably Fair System
**Add commit-reveal scheme:**

```typescript
import crypto from "crypto";

interface GameCommit {
  gameId: string;
  commitHash: string; // Hash of seed
  revealedSeed?: string;
}

let pendingCommits: GameCommit[] = [];

// BEFORE game starts
function commitCrashValue() {
  const seed = crypto.randomBytes(32).toString("hex");
  const crashMultiplier = pickCrashMultiplier(seed); // Deterministic
  
  const commitHash = crypto
    .createHash("sha256")
    .update(seed + crashMultiplier.toString())
    .digest("hex");
  
  const gameId = uuidv4();
  pendingCommits.push({ gameId, commitHash });
  
  // Store commit hash on-chain
  await contract.commitGame(gameId, commitHash);
  
  return { gameId, seed, crashMultiplier };
}

// AFTER game ends
function revealCrash(gameId: string, seed: string, crashValue: number) {
  // Reveal on-chain
  await contract.revealGame(gameId, seed, crashValue);
  
  // Anyone can verify: hash(seed + crashValue) === commitHash
}
```

**Benefits:**
- Proves backend didn't manipulate crash after seeing bets
- Users can verify fairness cryptographically
- Builds trust in the platform

---

### 4. Replace Supabase Balance Updates
**Remove direct balance manipulation:**

```typescript
// ❌ DELETE THIS
await supabase
  .from("users_rugsfun")
  .update({ balance: newBalance })
  .eq("wallet_address", userId);

// ✅ REPLACE WITH SMART CONTRACT CALL
const contract = new ethers.Contract(ADDRESS, ABI, serverWallet);
await contract.updateUserBalance(userId, profitLoss);
```

**Or use event-driven sync:**
```typescript
// Listen to smart contract events
contract.on("BalanceUpdated", async (user, newBalance, event) => {
  // Sync to Supabase for fast queries
  await supabase
    .from("users_rugsfun")
    .update({ 
      balance: newBalance.toString(),
      last_synced_block: event.blockNumber
    })
    .eq("wallet_address", user);
});
```

---

### 5. Add Health Monitoring
**New monitoring endpoints:**

```typescript
import express from "express";
const app = express();

app.get("/health", async (req, res) => {
  const blockNumber = await provider.getBlockNumber();
  const contractBalance = await contract.getBankBalance();
  
  res.json({
    status: "healthy",
    websocket: {
      connectedClients: wss.clients.size,
      gameState: gameState,
      currentMultiplier: currentMultiplier
    },
    blockchain: {
      network: "monad",
      blockNumber: blockNumber,
      contractBalance: ethers.formatEther(contractBalance)
    },
    database: {
      connected: true,
      pendingTrades: await getPendingTradesCount()
    }
  });
});

app.listen(3001);
```

---

## Security Improvements Required(for now not required later on we can )

### 1. Replace Math.random() with Crypto-Secure RNG
**Before:**
```typescript
function pickCrashMultiplier() {
  const r = Math.random(); // ❌ PREDICTABLE
  // ...
}
```

**After:**
```typescript
import crypto from "crypto";

function pickCrashMultiplier() {
  const buffer = crypto.randomBytes(4);
  const r = buffer.readUInt32BE(0) / 0xFFFFFFFF; // ✅ CRYPTO-SECURE
  
  if (r < 0.49) return 2;
  if (r < 0.57) return 10;
  if (r < 0.59) return 50;
  return 100;
}
```

---

### 2. Add Rate Limiting
```typescript
import rateLimit from "express-rate-limit";

const wsRateLimiter = new Map<string, number>();

ws.on("message", (message) => {
  const userId = data.userId;
  const now = Date.now();
  const lastMessage = wsRateLimiter.get(userId) || 0;
  
  // Max 10 messages per second per user
  if (now - lastMessage < 100) {
    ws.send(JSON.stringify({
      type: "error",
      message: "Rate limit exceeded"
    }));
    return;
  }
  
  wsRateLimiter.set(userId, now);
  // Process message...
});
```

---

### 3. Add Input Validation
```typescript
import { z } from "zod";

const BuyTradeSchema = z.object({
  type: z.literal("buy"),
  userId: z.string().regex(/^0x[a-fA-F0-9]{40}$/), // Ethereum address
  buyAmount: z.number().min(0.001).max(1000)
});

ws.on("message", (message) => {
  const data = JSON.parse(message.toString());
  
  if (data.type === "buy") {
    const validation = BuyTradeSchema.safeParse(data);
    if (!validation.success) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid trade data"
      }));
      return;
    }
    // Process valid trade...
  }
});
```

---

## Migration Checklist

### Phase 1: Smart Contract Deployment
- [ ] Deploy Monad smart contracts (deposit/withdraw/escrow)
- [ ] Test on-chain balance tracking
- [ ] Implement emergency pause mechanism
- [ ] Add event emission for all state changes

### Phase 2: Backend Updates
- [ ] Replace `Math.random()` with `crypto.randomBytes()`
- [ ] Implement provably fair commit-reveal system
- [ ] Add smart contract integration (ethers.js)
- [ ] Replace Supabase balance updates with contract reads
- [ ] Add batch settlement logic
- [ ] Implement rate limiting
- [ ] Add input validation (zod)

### Phase 3: Database Migration
- [ ] Keep Supabase for game history & analytics
- [ ] Add `settled_on_chain` column to trades table
- [ ] Add blockchain sync tracking (block numbers)
- [ ] Create indexes for fast queries

### Phase 4: Testing
- [ ] Load test WebSocket (1000+ concurrent users)
- [ ] Verify 500ms tick broadcast latency
- [ ] Test smart contract gas costs
- [ ] Audit provably fair implementation
- [ ] Penetration testing for exploits

### Phase 5: Monitoring
- [ ] Set up health check endpoints
- [ ] Add Prometheus metrics
- [ ] Configure alerts for:
  - WebSocket disconnections
  - Smart contract errors
  - Database sync delays
  - Abnormal crash patterns

---


### ✅ BACKEND IS ABSOLUTELY REQUIRED

**Do NOT eliminate the backend.** Instead:

1. **Keep these backend responsibilities:**
   - WebSocket server for real-time updates (500ms ticks)
   - Crash generation with crypto-secure RNG
   - Game state management
   - Chat system
   - User session management

2. **Move to smart contracts:**
   - Deposits & withdrawals
   - On-chain balance tracking
   - Escrow/custody of funds
   - Settlement of winnings

3. **Hybrid trade execution:**
   - Backend validates trades instantly (200ms UX)
   - Smart contract settles in batches (every 5 minutes)
   - Balances tracked on-chain as source of truth

4. **Keep Supabase for:**
   - Game history & analytics
   - Leaderboards
   - User profiles
   - Fast read queries

**Why this works:**
- ✅ Real-time gameplay (500ms ticks)
- ✅ Instant trade feedback (<200ms)
- ✅ On-chain security for funds
- ✅ Provably fair crash generation
- ✅ Scalable to 1000+ concurrent users
- ✅ Lower gas costs (batch settlement)

