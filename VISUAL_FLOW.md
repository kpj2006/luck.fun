# luck.fun Visual Flow

## 🎮 Game Round Flow

```
┌─────────────────┐
│  IDLE / WAITING │
│   New Round     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  COUNTDOWN (5s) │ ◄── Players can place bets
│    5...4...3    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ROUND ACTIVE   │
│  Multiplier ↑   │ ◄─┐
│  1.00x → ?.??x  │   │
└────────┬────────┘   │
         │            │
    ┌────┴────┐       │
    ▼         ▼       │
┌────────┐ ┌──────┐  │
│ CASHOUT│ │ WAIT │──┘
│  Win!  │ └──────┘
└────────┘
    │
    │
    ▼
┌─────────────────┐
│     CRASH!      │
│   💥 Game Over  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   SETTLEMENT    │
│ Winners Paid    │
│ Losers Record   │
└────────┬────────┘
         │
         └────► Back to IDLE
```

## 👤 Player Actions

```
Connect Wallet
      ↓
Deposit Tokens → Balance Updated
      ↓
Wait for Round
      ↓
Place Bet (during countdown)
      ↓
   ┌──────────────────┐
   │  Watch Multiplier │
   └──────┬───────────┘
          │
   ┌──────┴───────┐
   ▼              ▼
Manual         Auto-Sell
Cash Out       Triggered
   │              │
   └──────┬───────┘
          ▼
    Win = Stake × Multiplier
          ↓
    Balance Updated
          ↓
   Withdraw or Play Again
```

## 🔄 Auto-Sell Logic

```
Player Sets Target (e.g., 2.50x)
           ↓
    Round Starts
           ↓
┌──────────────────────┐
│ Check Every Tick:    │
│ Current >= Target?   │
└──────┬───────┬───────┘
       │       │
      NO      YES
       │       │
   Keep ↓     ↓ Auto Cashout
   Rising   Execute Sell
       │       │
       └───────┴──► Continue
```

## 📡 WebSocket Events

```
SERVER                          CLIENT
   │                              │
   ├──► ROUND_STARTING ──────────►│ Show countdown
   │                              │
   ├──► MULTIPLIER_UPDATE ───────►│ Animate number
   │    (every 100ms)             │
   │                              │
   │◄─── PLACE_BET ───────────────┤ User action
   │                              │
   ├──► BET_CONFIRMED ───────────►│ Lock bet
   │                              │
   │◄─── CASHOUT ─────────────────┤ User sells
   │                              │
   ├──► CASHOUT_SUCCESS ─────────►│ Show win
   │                              │
   ├──► ROUND_CRASHED ───────────►│ Game over
   │                              │
   └──► ROUND_RESULT ────────────►│ Show results
```

## 🎯 Core Game States

```
WAITING  →  COUNTDOWN  →  PLAYING  →  CRASHED  →  SETTLING  →  WAITING
   ↑                                                             │
   └─────────────────────────────────────────────────────────────┘
```

## 💰 Token Flow

```
User Wallet (MetaMask)
        ↓ Deposit
Smart Contract
        ↓ Transfer
Backend Balance (DB)
        ↓ Place Bet
In-Game Balance
        ↓ Win/Lose
Backend Balance (DB)
        ↓ Withdraw
Smart Contract
        ↓ Transfer
User Wallet (MetaMask)
```
