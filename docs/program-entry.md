# Program Entry Point Documentation

## File Location

`rugs-fun/programs/rugs-fun/src/lib.rs`

## Purpose

The main entry point for the Rugs.Fun Anchor program. Defines the program ID, module structure, and exposes public instruction handlers.

## Program Structure

```rust
pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;

declare_id!("5gs6aaY9ELfjVHKa7s8swkjLdAZgfnYMsGhm862rmkgN");

#[program]
pub mod rugs_fun {
    use super::*;

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::process_deposit(ctx, amount)?;
        Ok(())
    }

    pub fn instructions(ctx: Context<Admin>) -> Result<()> {
        instructions::admin(ctx)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::process_withdraw(ctx, amount)?;
        Ok(())
    }
}
```

## Module Organization

| Module         | Path                | Purpose                                         |
| -------------- | ------------------- | ----------------------------------------------- |
| `constants`    | `src/constants.rs`  | Program-wide constants                          |
| `error`        | `src/error.rs`      | Custom error definitions                        |
| `instructions` | `src/instructions/` | Instruction handlers (deposit, withdraw, admin) |
| `state`        | `src/state.rs`      | State account structures (if any)               |

## Program ID

**Deployed Program Address**: `5gs6aaY9ELfjVHKa7s8swkjLdAZgfnYMsGhm862rmkgN`

This is the on-chain address of the deployed Rugs.Fun program on Solana Devnet.

## Public Instructions

### 1. deposit()

**Purpose**: Allows users to deposit tokens into the platform vault.

**Signature**:

```rust
pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()>
```

**Parameters**:

- `ctx: Context<Deposit>` - Account context with signer, bank accounts, token program
- `amount: u64` - Amount to deposit in smallest token units (lamports)

**Flow**:

1. Validates all accounts via Anchor constraints
2. Calls `instructions::process_deposit()`
3. Transfers tokens from user to platform vault
4. Returns success or error

---

### 2. instructions()

⚠️ **Note**: Misleading name - this is actually the **admin initialization** function

**Purpose**: One-time initialization of the platform's bank authority and vault.

**Signature**:

```rust
pub fn instructions(ctx: Context<Admin>) -> Result<()>
```

**Parameters**:

- `ctx: Context<Admin>` - Account context for initialization

**Flow**:

1. Creates `bank_authority` PDA
2. Creates `bank_account` ATA owned by PDA
3. Calls `instructions::admin()`
4. Returns success or error

**Recommended Rename**: Should be called `initialize()` or `setup()` for clarity

---

### 3. withdraw()

**Purpose**: Allows users to withdraw tokens from the platform vault to their wallet.

**Signature**:

```rust
pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()>
```

**Parameters**:

- `ctx: Context<Withdraw>` - Account context with signer, bank accounts, token program
- `amount: u64` - Amount to withdraw in smallest token units (lamports)

**Flow**:

1. Validates all accounts via Anchor constraints
2. Calls `instructions::process_withdraw()`
3. PDA signs transfer from platform vault to user account
4. Returns success or error

## Frontend Integration

### JavaScript/TypeScript

```typescript
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import IDL from "./rugs_fun.json";

const PROGRAM_ID = "5gs6aaY9ELfjVHKa7s8swkjLdAZgfnYMsGhm862rmkgN";

// Initialize program instance
const connection = new Connection("https://api.devnet.solana.com");
const program = new Program(IDL, PROGRAM_ID, provider);

// Call deposit instruction
await program.methods
  .deposit(new BN(1000000000)) // 1 SOL in lamports
  .accounts({
    signer: wallet.publicKey,
    mint: new PublicKey(MINT_ADDRESS),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  })
  .rpc();

// Call admin initialization (one-time)
await program.methods
  .instructions() // Note: misleading name
  .accounts({
    signer: wallet.publicKey,
    mint: new PublicKey(MINT_ADDRESS),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  })
  .rpc();

// Call withdraw instruction
await program.methods
  .withdraw(new BN(500000000)) // 0.5 SOL in lamports
  .accounts({
    signer: wallet.publicKey,
    mint: new PublicKey(MINT_ADDRESS),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  })
  .rpc();
```

## Migration to Solidity (Monad)

### Solidity Smart Contract Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title RugsFun Game Platform
 * @notice Main contract for the Rugs.Fun crash game on Monad
 * @dev Combines deposit, withdraw, and game logic
 */
contract RugsFun is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public gameToken;
    address public bankAuthority;  // Treasury/vault address
    bool public initialized;

    mapping(address => uint256) public userBalances;
    mapping(address => uint256) public userDepositedBalance;

    // ============ Events ============

    event Initialized(address indexed bankAuthority, address indexed token);
    event Deposit(address indexed user, uint256 amount, uint256 newBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 remainingBalance);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Admin Functions ============

    /**
     * @notice Initialize the platform (one-time setup)
     * @param _gameToken Address of the ERC20 game token
     * @param _bankAuthority Address of the treasury/vault
     */
    function initialize(
        address _gameToken,
        address _bankAuthority
    ) external onlyOwner {
        require(!initialized, "Already initialized");
        require(_gameToken != address(0), "Invalid token");
        require(_bankAuthority != address(0), "Invalid bank authority");

        gameToken = IERC20(_gameToken);
        bankAuthority = _bankAuthority;
        initialized = true;

        emit Initialized(_bankAuthority, _gameToken);
    }

    // ============ User Functions ============

    /**
     * @notice Deposit tokens into the platform
     * @param amount Amount of tokens to deposit
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(initialized, "Not initialized");
        require(amount > 0, "Invalid amount");

        // Transfer tokens from user to bankAuthority
        gameToken.safeTransferFrom(msg.sender, bankAuthority, amount);

        // Update balances
        userBalances[msg.sender] += amount;
        userDepositedBalance[msg.sender] += amount;

        emit Deposit(msg.sender, amount, userBalances[msg.sender]);
    }

    /**
     * @notice Withdraw tokens from the platform
     * @param amount Amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(initialized, "Not initialized");
        require(amount > 0, "Invalid amount");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");

        // Update balance BEFORE transfer (CEI pattern)
        userBalances[msg.sender] -= amount;

        // Transfer tokens from bankAuthority to user
        // Note: bankAuthority must have approved this contract
        gameToken.safeTransferFrom(bankAuthority, msg.sender, amount);

        emit Withdraw(msg.sender, amount, userBalances[msg.sender]);
    }

    // ============ View Functions ============

    /**
     * @notice Get user's balance
     * @param user Address of the user
     * @return User's current balance
     */
    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    // ============ Emergency Functions ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
```

## Key Differences: Anchor vs Solidity

| Feature                | Anchor (Rust/Solana)              | Solidity (Monad/Ethereum)             |
| ---------------------- | --------------------------------- | ------------------------------------- |
| **Program ID**         | Base58 encoded address            | 0x... Ethereum address                |
| **Initialization**     | Separate PDA creation             | `initialize()` function               |
| **Account Validation** | Anchor constraints (`#[account]`) | `require()` statements                |
| **Module System**      | Rust modules (`pub mod`)          | Import statements                     |
| **Token Transfers**    | CPI to Token Program              | ERC20 `safeTransferFrom()`            |
| **PDAs**               | Program Derived Addresses         | Not applicable (use contract address) |
| **Error Handling**     | `Result<()>` + custom errors      | `require()` + custom errors           |
| **Access Control**     | Account constraints               | Modifiers + `Ownable`                 |
| **Reentrancy**         | Not a concern                     | Requires `ReentrancyGuard`            |
| **Gas/Rent**           | Rent-exempt SOL deposits          | Gas fees only                         |

## Deployment Comparison

### Solana (Anchor)

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### Monad (Hardhat)

```typescript
// deploy.ts
import { ethers } from "hardhat";

async function main() {
  const RugsFun = await ethers.getContractFactory("RugsFun");
  const rugsFun = await RugsFun.deploy();
  await rugsFun.deployed();

  console.log("RugsFun deployed to:", rugsFun.address);

  // Initialize
  const gameToken = "0x..."; // ERC20 token address
  const bankAuthority = "0x..."; // Treasury address

  await rugsFun.initialize(gameToken, bankAuthority);
  console.log("Initialized!");
}

main();
```

## Testing

### Anchor Test

```typescript
describe("rugs_fun", () => {
  it("Initializes the program", async () => {
    await program.methods
      .instructions()
      .accounts({
        /* ... */
      })
      .rpc();
  });

  it("Deposits tokens", async () => {
    await program.methods
      .deposit(new BN(1000))
      .accounts({
        /* ... */
      })
      .rpc();
  });
});
```

### Hardhat Test

```typescript
describe("RugsFun", function () {
  it("Should initialize", async function () {
    const { rugsFun, gameToken, owner } = await loadFixture(deployFixture);
    await rugsFun.initialize(gameToken.address, owner.address);
    expect(await rugsFun.initialized()).to.equal(true);
  });

  it("Should deposit tokens", async function () {
    await gameToken.approve(rugsFun.address, 1000);
    await rugsFun.deposit(1000);
    expect(await rugsFun.getBalance(owner.address)).to.equal(1000);
  });
});
```
