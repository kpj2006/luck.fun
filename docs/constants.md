# Constants Documentation

## File Location

`rugs-fun/programs/rugs-fun/src/constants.rs`

## Purpose

Defines constant values used across the Rugs.Fun smart contracts.

## Constants Definition

```rust
use anchor_lang::prelude::*;

#[constant]
pub const SEED: &str = "anchor";
```

## Constants Reference

| Name   | Type   | Value      | Usage                     | Description                             |
| ------ | ------ | ---------- | ------------------------- | --------------------------------------- |
| `SEED` | `&str` | `"anchor"` | ❌ **Not currently used** | Placeholder constant for PDA derivation |

## Current PDA Seeds

While the `SEED` constant exists, the actual PDA seeds used in the contracts are:

### Bank Authority PDA

- **Seed**: `b"bank_authority"` (hardcoded in account constraints)
- **Usage**: All three contracts (Admin, Deposit, Withdraw)
- **Derivation**: `Pubkey::find_program_address(&[b"bank_authority"], program_id)`

## Usage in Contracts

### Current Implementation

```rust
// admin.rs, deposit.rs, withdraw.rs
#[account(
    seeds=[b"bank_authority"],  // Hardcoded seed
    bump
)]
pub bank_authority: UncheckedAccount<'info>
```

### Potential Refactor (Not Currently Implemented)

```rust
// constants.rs
pub const BANK_AUTHORITY_SEED: &[u8] = b"bank_authority";
pub const USER_ACCOUNT_SEED: &[u8] = b"user_account";

// Usage in contracts
#[account(
    seeds=[BANK_AUTHORITY_SEED],
    bump
)]
pub bank_authority: UncheckedAccount<'info>
```

## Frontend PDA Derivation

```typescript
import { PublicKey } from "@solana/web3.js";

const PROGRAM_ID = "5gs6aaY9ELfjVHKa7s8swkjLdAZgfnYMsGhm862rmkgN";

// Derive bank_authority PDA
const [bankAuthority, bump] = await PublicKey.findProgramAddress(
  [Buffer.from("bank_authority")],
  new PublicKey(PROGRAM_ID)
);

console.log("Bank Authority PDA:", bankAuthority.toBase58());
console.log("Bump:", bump);
```

## Migration to Solidity (Monad)

### Solidity Constants

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RugsFun Constants
 * @notice Platform-wide constant values
 */
library RugsFunConstants {
    // Token & Financial Constants
    uint256 public constant DECIMALS = 18;
    uint256 public constant MIN_DEPOSIT = 0.01 ether;  // Minimum deposit amount
    uint256 public constant MAX_DEPOSIT = 1000 ether;  // Maximum deposit amount
    uint256 public constant MIN_WITHDRAWAL = 0.01 ether;
    uint256 public constant MAX_WITHDRAWAL_PER_TX = 1000 ether;

    // Game Constants
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 100 ether;
    uint256 public constant MAX_MULTIPLIER = 100;  // 100x max multiplier
    uint256 public constant HOUSE_EDGE = 2;  // 2% house edge

    // Time Constants
    uint256 public constant GAME_DURATION = 30 seconds;
    uint256 public constant COOLDOWN_PERIOD = 10 seconds;
    uint256 public constant DAILY_LIMIT_WINDOW = 1 days;

    // Limits
    uint256 public constant DAILY_WITHDRAWAL_LIMIT = 10000 ether;
    uint256 public constant MAX_PLAYERS_PER_GAME = 1000;

    // Precision
    uint256 public constant PRECISION = 10000;  // For percentage calculations
}

/**
 * @title RugsFun Configuration
 * @notice Mutable configuration values (owner-controlled)
 */
contract RugsFunConfig {
    address public owner;
    address public bankAuthority;  // Address that holds funds
    address public gameToken;

    bool public paused;

    // Mutable limits (can be updated by owner)
    uint256 public minDeposit = RugsFunConstants.MIN_DEPOSIT;
    uint256 public maxDeposit = RugsFunConstants.MAX_DEPOSIT;
    uint256 public minBet = RugsFunConstants.MIN_BET;
    uint256 public maxBet = RugsFunConstants.MAX_BET;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(address _bankAuthority, address _gameToken) {
        owner = msg.sender;
        bankAuthority = _bankAuthority;
        gameToken = _gameToken;
    }

    function updateBankAuthority(address _newBankAuthority) external onlyOwner {
        require(_newBankAuthority != address(0), "Invalid address");
        bankAuthority = _newBankAuthority;
    }

    function updateDepositLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min < _max, "Invalid limits");
        minDeposit = _min;
        maxDeposit = _max;
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }
}
```

## Recommended Constants for Monad Implementation

### Core Platform Constants

```solidity
// Platform addresses
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

// Numeric constants
uint256 constant LAMPORTS_PER_SOL = 1e9;  // Solana compatibility
uint256 constant WAD = 1e18;               // Standard ERC20 decimals
uint256 constant RAY = 1e27;               // High precision calculations

// Platform fees
uint256 constant PLATFORM_FEE_BPS = 200;   // 2% in basis points
uint256 constant BASIS_POINTS = 10000;
```

### Gas Optimization

```solidity
// Use immutable for deployment-time constants
contract RugsFunGame {
    address public immutable GAME_TOKEN;
    address public immutable BANK_AUTHORITY;
    uint256 public immutable DEPLOYED_AT;

    constructor(address _gameToken, address _bankAuthority) {
        GAME_TOKEN = _gameToken;
        BANK_AUTHORITY = _bankAuthority;
        DEPLOYED_AT = block.timestamp;
    }
}
```

## Comparison: Solana vs Monad Constants

| Feature                    | Solana/Anchor                      | Monad/Solidity           |
| -------------------------- | ---------------------------------- | ------------------------ |
| **PDA Seeds**              | Byte strings (`b"bank_authority"`) | Not applicable (no PDAs) |
| **Compile-time Constants** | `#[constant]` macro                | `constant` keyword       |
| **Deployment Constants**   | N/A                                | `immutable` keyword      |
| **Decimals**               | Stored in Mint account             | Typically 18 for ERC20   |
| **Program ID**             | Base58 string                      | Ethereum address (0x...) |
| **Access Modifiers**       | `pub const`                        | `public constant`        |

## Best Practices

### For Solidity Migration

1. **Use Libraries**: Group related constants in library contracts
2. **Immutables**: Use `immutable` for deployment-time values
3. **Constants**: Use `constant` for compile-time values
4. **Naming**: UPPER_SNAKE_CASE for constants
5. **Documentation**: Add NatSpec comments for all constants
6. **Type Safety**: Use strong typing (don't use magic numbers)
7. **Upgradability**: Consider proxy patterns if values may change
