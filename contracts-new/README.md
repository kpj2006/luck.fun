# Rugs.Fun Monad Smart Contracts

## Folder Structure

```
contracts/
├── src/
│   ├── core/          # Main game contracts
│   │   ├── RugsFun.sol              # Main contract (deposits, withdrawals, balances)
│   │   ├── GameManager.sol          # Game state and provably fair logic
│   │   └── Treasury.sol             # Platform fee management
│   │
│   ├── interfaces/    # Contract interfaces
│   │   ├── IRugsFun.sol             # Main contract interface
│   │   ├── IGameManager.sol         # Game manager interface
│   │   └── ITreasury.sol            # Treasury interface
│   │
│   ├── libraries/     # Shared libraries
│   │   ├── SafeMath.sol             # Math operations (if needed)
│   │   └── GameLib.sol              # Game-related helper functions
│   │
│   └── utils/         # Helper contracts
│       ├── Constants.sol            # Platform constants
│       └── Errors.sol               # Custom error definitions
│
├── test/              # Contract tests (to be created with Hardhat/Foundry)
├── scripts/           # Deployment scripts (to be created)
└── README.md          # This file
```

## Contract Architecture (Single Owner - No Multi-Sig)

### Phase 1: Simple Single-Owner Implementation ✅

**Current Plan:** Start with basic Ownable pattern for faster development

```
Owner (EOA) → Controls all admin functions
    ↓
RugsFun Contract → Handles deposits/withdrawals/balances
    ↓
ERC-20 Token → Platform game token
```

**Key Features:**

- Single owner for admin functions
- Owner can update treasury address
- Owner can set min/max deposit limits
- Daily withdrawal limits per user
- Simple and fast to deploy

### Phase 2: Multi-Sig Upgrade (Future) 🔄

**After project is fully functional:**

- Deploy Gnosis Safe multi-sig
- Transfer ownership to multi-sig address
- Require 3-of-5 signatures for admin actions

---

## Core Contracts Overview

### 1. RugsFun.sol (Main Contract)

**Responsibilities:**

- User deposits (ERC-20 → contract)
- User withdrawals (contract → ERC-20)
- On-chain balance tracking
- Emergency pause mechanism
- Owner-controlled parameters

**Storage:**

```solidity
IERC20 public gameToken;
address public owner;
address public treasury;
mapping(address => uint256) public balances;
bool public paused;
```

---

### 2. GameManager.sol

**Responsibilities:**

- Provably fair commit-reveal system
- Game history tracking
- Crash verification
- Settlement coordination with backend

**Storage:**

```solidity
mapping(bytes32 => GameCommit) public gameCommits;
mapping(bytes32 => GameResult) public gameResults;
```

---

### 3. Treasury.sol

**Responsibilities:**

- Platform fee collection
- Fee withdrawal (owner only)
- Revenue tracking

---

## Development Phases

### ✅ Phase 1: Folder Structure (Current)

- [x] Create contract directories
- [x] Define architecture
- [ ] Set up Hardhat/Foundry (next step)

### 🔄 Phase 2: Core Contracts

- [ ] Write RugsFun.sol
- [ ] Write GameManager.sol
- [ ] Write Treasury.sol
- [ ] Write interfaces
- [ ] Write error definitions

### 🔄 Phase 3: Testing & Deployment

- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Deploy to testnet
- [ ] Audit contracts
- [ ] Deploy to mainnet

### 🔄 Phase 4: Backend Integration

- [ ] Update backend to read on-chain balances
- [ ] Implement batch settlement
- [ ] Add provably fair verification
- [ ] Sync events to Supabase

### 🔄 Phase 5: Multi-Sig Upgrade (Optional)

- [ ] Deploy Gnosis Safe
- [ ] Transfer ownership
- [ ] Update documentation

---

## Design Decisions

### Why Single Owner First?

1. **Speed**: Faster to develop and test
2. **Simplicity**: Easier to debug issues
3. **Flexibility**: Can iterate quickly during development
4. **Upgrade Path**: Can transfer to multi-sig later without contract changes

### Why Not Multi-Sig Now?

- Adds complexity during active development
- Slows down testing (need multiple signatures)
- Can be added later with simple `transferOwnership()`
- Focus on core functionality first

---

## Next Steps

1. Choose framework: Hardhat or Foundry
2. Initialize project with `npm init` or `forge init`
3. Install dependencies (OpenZeppelin contracts)
4. Start writing RugsFun.sol
5. Set up testing infrastructure

---

## Notes

- All contracts use OpenZeppelin libraries (Ownable, SafeERC20)
- Solidity version: ^0.8.20
- ERC-20 token standard for game token
- Events emitted for all state changes
- Security features removed per project requirements (Pausable, ReentrancyGuard, CEI pattern)
- Daily withdrawal limits implemented
- Provably fair commit-reveal system for game fairness
