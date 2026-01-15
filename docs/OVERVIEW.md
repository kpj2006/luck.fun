# Rugs.Fun Smart Contracts - Documentation Overview

## Project Summary

**Rugs.fun** is an on-chain crash game built on Solana using the Anchor framework. The smart contracts manage user token deposits and withdrawals using SPL Token 2022, enabling a decentralized gaming experience.

## Program Details

- **Program ID**: `5gs6aaY9ELfjVHKa7s8swkjLdAZgfnYMsGhm862rmkgN`
- **Framework**: Anchor (Rust-based Solana framework)
- **Token Standard**: SPL Token 2022
- **Blockchain**: Solana (Devnet)

## Architecture Overview

The smart contract system consists of three main instruction modules:

1. **Admin Module** (`admin.rs`)

   - Initializes the platform's bank authority and token vault
   - One-time setup required before deposits/withdrawals

2. **Deposit Module** (`deposit.rs`)

   - Handles user token deposits into the platform
   - Transfers tokens from user to platform vault

3. **Withdraw Module** (`withdraw.rs`)
   - Handles user token withdrawals from the platform
   - Transfers tokens from platform vault back to user

## Key Concepts

### Program Derived Address (PDA)

- The contracts use a PDA called `bank_authority` derived from seed `b"bank_authority"`
- This PDA owns the platform's token vault and signs withdrawal transactions
- Ensures secure custody of deposited funds without requiring a private key

### Associated Token Accounts (ATAs)

- Each user and the platform have ATAs for storing SPL tokens
- ATAs are deterministic addresses derived from owner + mint address
- Automatically managed by the SPL Token program

## Contract Flow

```
SCHEDULE (one-time) ON DEPLOYMENT
│
└─ admin.rs → Initialize bank_authority PDA
              └─ Create platform token vault (bank_account)

SCHEDULE (recurring) DURING GAME OPERATION
│
├─ deposit.rs → User deposits tokens
│              ├─ Transfer from user_account to bank_account
│              └─ Update off-chain balance tracking
│
└─ withdraw.rs → User withdraws tokens
               ├─ Verify user has sufficient balance
               ├─ Transfer from bank_account to user_account (PDA signs)
               └─ Update off-chain balance tracking
```

## Related Documentation Files

- [Admin Contract](./admin-contract.md) - Initialization & setup
- [Deposit Contract](./deposit-contract.md) - User deposits
- [Withdraw Contract](./withdraw-contract.md) - User withdrawals
- [Error Codes](./errors.md) - Contract error definitions
- [Constants](./constants.md) - Contract constants

## Migration to Monad/Solidity

For converting to Solidity smart contracts on Monad:

1. Replace PDA concept with a multi-sig or governance wallet
2. Use ERC-20 token standard instead of SPL Token 2022
3. Implement access control using OpenZeppelin's Ownable pattern
4. Replace CPI calls with direct ERC-20 transfers
5. Add proper events/logs for all state changes
