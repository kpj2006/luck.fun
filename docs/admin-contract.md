# Admin Contract Documentation

## File Location

`rugs-fun/programs/rugs-fun/src/instructions/admin.rs`

## Purpose

The Admin contract initializes the platform's core infrastructure by creating a Program Derived Address (PDA) that serves as the bank authority and its associated token vault. This is a **one-time setup** that must be executed before any deposits or withdrawals can occur.

## Contract Structure

### Account Structure: `Admin<'info>`

```rust
#[derive(Accounts)]
pub struct Admin<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
       init,
       payer=signer,
       seeds=[b"bank_authority"],
       space=8 + 8,
       bump,
       owner= System::id()
    )]
    pub bank_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer=signer,
        associated_token::mint=mint,
        associated_token::authority=bank_authority,
        associated_token::token_program=token_program
    )]
    pub bank_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>
}
```

### Accounts Breakdown

| Account                    | Type             | Mutable   | Description                                                                                                                    |
| -------------------------- | ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `signer`                   | Signer           | ✅        | The deployer/admin wallet initiating setup. Pays for account creation.                                                         |
| `bank_authority`           | UncheckedAccount | ✅ (init) | **PDA** derived from seed `"bank_authority"`. Will own the platform's token vault. Space: 16 bytes (8 discriminator + 8 data). |
| `bank_account`             | TokenAccount     | ✅ (init) | **Associated Token Account (ATA)** owned by `bank_authority`. Stores all deposited tokens.                                     |
| `mint`                     | Mint             | ✅        | The SPL Token 2022 mint address for the game token (e.g., custom SOL token).                                                   |
| `system_program`           | Program          | ❌        | Solana system program for account creation.                                                                                    |
| `token_program`            | Interface        | ❌        | SPL Token 2022 program interface.                                                                                              |
| `associated_token_program` | Program          | ❌        | ATA program for creating token accounts.                                                                                       |

## Function: `admin`

### Signature

```rust
pub fn admin(ctx: Context<Admin>) -> Result<()>
```

### Parameters

- `ctx`: The Anchor context containing all accounts

### Returns

- `Result<()>`: Success or error

### Functionality

```rust
pub fn admin(ctx:Context<Admin>)-> Result<()>{
    msg!("Initialized Admin Account!");
    Ok(())
}
```

**Logic Flow:**

1. Anchor automatically executes account initialization constraints:
   - Creates `bank_authority` PDA with specified seed
   - Creates `bank_account` ATA owned by `bank_authority`
   - Charges `signer` for rent-exempt SOL deposits
2. Logs confirmation message to transaction logs
3. Returns success

### Key Security Features

- **PDA Derivation**: `bank_authority` is derived deterministically from `b"bank_authority"` seed
- **Rent Exemption**: Accounts are funded with rent-exempt SOL to prevent deletion
- **Owner Validation**: `bank_authority` is owned by System program (standard for PDAs)
- **Immutable Setup**: Can only be called once (accounts already exist on second attempt)

## Usage Example (Frontend Integration)

```typescript
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

const MINT_ADDRESS = "J8NDF3RxtfZ5E2vks2NdchwE3PXNMNwUngCpEbMoLaoL";

async function initializeAdminAccounts(wallet, program) {
  const ix = await program.methods
    .instructions() // Corresponds to admin() function
    .accounts({
      mint: new PublicKey(MINT_ADDRESS),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      signer: wallet.publicKey,
    })
    .instruction();

  const bx = await connection.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash: bx.blockhash,
    lastValidBlockHeight: bx.lastValidBlockHeight,
  }).add(ix);

  const txSig = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(txSig);

  console.log("Admin accounts initialized:", txSig);
}
```

## Migration to Solidity (Monad)

### Solidity Equivalent

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RugsFunAdmin is Ownable {
    IERC20 public gameToken;
    address public bankAuthority;  // Multi-sig or treasury wallet

    bool public initialized;

    event AdminInitialized(address indexed bankAuthority, address indexed token);

    constructor() Ownable(msg.sender) {}

    function initialize(address _gameToken, address _bankAuthority) external onlyOwner {
        require(!initialized, "Already initialized");
        require(_gameToken != address(0), "Invalid token");
        require(_bankAuthority != address(0), "Invalid bank authority");

        gameToken = IERC20(_gameToken);
        bankAuthority = _bankAuthority;
        initialized = true;

        emit AdminInitialized(_bankAuthority, _gameToken);
    }
}
```

### Key Differences

- **No PDA**: Use a designated wallet or multi-sig address for `bankAuthority`
- **ERC-20**: Replace SPL Token 2022 with ERC-20 interface
- **Ownership**: Use OpenZeppelin's Ownable pattern
- **No Rent**: Ethereum doesn't have rent, only gas fees
- **Events**: Add explicit event emission (Solana logs vs Ethereum events)
