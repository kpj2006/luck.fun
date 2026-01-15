# Withdraw Contract Documentation

## File Location

`rugs-fun/programs/rugs-fun/src/instructions/withdraw.rs`

## Purpose

The Withdraw contract allows users to withdraw their tokens from the platform's vault back to their wallet. The platform's `bank_authority` PDA signs the transaction to authorize the transfer from the bank account to the user's account.

## Contract Structure

### Account Structure: `Withdraw<'info>`

```rust
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds=[b"bank_authority"],
        bump,
        owner= System::id()
    )]
    pub bank_authority: SystemAccount<'info>,

    #[account(
        mut,
        associated_token::mint=mint,
        associated_token::authority=bank_authority,
        associated_token::token_program=token_program
    )]
    pub bank_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint=mint,
        associated_token::authority=signer,
        associated_token::token_program=token_program
    )]
    pub user_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>
}
```

### Accounts Breakdown

| Account                    | Type          | Mutable | Description                                                                 |
| -------------------------- | ------------- | ------- | --------------------------------------------------------------------------- |
| `signer`                   | Signer        | ✅      | The user wallet requesting withdrawal. Must sign the transaction.           |
| `bank_authority`           | SystemAccount | ✅      | **PDA** derived from `"bank_authority"`. Signs CPI to authorize withdrawal. |
| `bank_account`             | TokenAccount  | ✅      | Platform's ATA holding deposited tokens. Source of withdrawal.              |
| `user_account`             | TokenAccount  | ✅      | User's ATA receiving withdrawn tokens.                                      |
| `mint`                     | Mint          | ✅      | The SPL Token 2022 mint address.                                            |
| `token_program`            | Interface     | ❌      | SPL Token 2022 program interface.                                           |
| `associated_token_program` | Program       | ❌      | ATA program reference.                                                      |

## Function: `process_withdraw`

### Signature

```rust
pub fn process_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()>
```

### Parameters

- `ctx`: Anchor context with all required accounts
- `amount`: Token amount to withdraw (in lamports/smallest unit)

### Returns

- `Result<()>`: Success or Anchor error

### Functionality

```rust
pub fn process_withdraw(ctx: Context<Withdraw>, amount:u64) -> Result<()> {
    // Create PDA signer seeds for CPI
    let signer_seeds:&[&[&[u8]]] = &[&[b"bank_authority", &[ctx.bumps.bank_authority]]];

    // Setup CPI context with PDA signer
    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            authority: ctx.accounts.bank_authority.to_account_info(),
            from: ctx.accounts.bank_account.to_account_info(),
            to: ctx.accounts.user_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info()
        },
        signer_seeds
    );

    transfer_checked(cpi_context, amount, ctx.accounts.mint.decimals)?;
    msg!("Successfully deposited user's amount to platform.");
    Ok(())
}
```

### Logic Flow

1. **Create Signer Seeds**: Constructs PDA derivation seeds for `bank_authority`
   - Seed: `b"bank_authority"`
   - Bump: Retrieved from `ctx.bumps.bank_authority`
2. **Setup CPI with Signer**: Creates Cross-Program Invocation context
   - Uses `new_with_signer` to include PDA as authority
   - Specifies transfer from `bank_account` to `user_account`
3. **Execute Transfer**: Calls `transfer_checked` with amount and decimals
4. **Log Success**: Emits log message (note: message says "deposited" but should say "withdrawn")
5. **Return**: Returns Ok on success

### Security Validations

- ✅ `signer` must sign the transaction
- ✅ `bank_authority` PDA must match derivation
- ✅ `bank_account` must be owned by `bank_authority`
- ✅ `user_account` must be owned by `signer`
- ✅ Both accounts must be for the same `mint`
- ✅ `bank_account` must have sufficient balance
- ⚠️ **No on-chain balance validation** - relies on off-chain checks

## Usage Example (Frontend Integration)

```typescript
import { BN, Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function withdrawTokens(wallet, program, amount) {
  const MINT_ADDRESS = "J8NDF3RxtfZ5E2vks2NdchwE3PXNMNwUngCpEbMoLaoL";

  // Check maximum withdrawable amount from off-chain database
  const maxWithdrawAmount = await MaxWithdrawAmountAllowed(
    wallet.publicKey.toString()
  );

  const lamportAmount = amount * LAMPORTS_PER_SOL;

  // Validate withdrawal amount
  if (lamportAmount > Number(maxWithdrawAmount ?? 0)) {
    throw new Error("Cannot withdraw more than available balance");
  }

  // Build transaction
  const ix = await program.methods
    .withdraw(new BN(lamportAmount))
    .accountsPartial({
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

  // Update off-chain balance (negative amount for withdrawal)
  await updateBalance(-lamportAmount, wallet.publicKey.toString());

  console.log("Withdrawal successful:", txSig);
}
```

## Off-Chain Balance Validation

The contract relies on off-chain validation before withdrawal:

```typescript
export async function MaxWithdrawAmountAllowed(wallet_address: string) {
  const supabase = await createClient();

  const { data: balance, error } = await supabase
    .from("users_rugsfun")
    .select("*")
    .eq("wallet_address", wallet_address)
    .single();

  if (!balance || error) {
    return 0;
  }

  return balance.balance; // Maximum withdrawable amount
}
```

## Migration to Solidity (Monad)

### Solidity Equivalent

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RugsFunWithdraw is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public gameToken;
    address public bankAuthority;

    mapping(address => uint256) public userBalances;

    event Withdraw(address indexed user, uint256 amount, uint256 remainingBalance);

    constructor(address _gameToken, address _bankAuthority) {
        gameToken = IERC20(_gameToken);
        bankAuthority = _bankAuthority;
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");

        // Update balance BEFORE transfer (Checks-Effects-Interactions pattern)
        userBalances[msg.sender] -= amount;

        // Transfer tokens from bankAuthority to user
        // Note: bankAuthority must have approved this contract
        gameToken.safeTransferFrom(bankAuthority, msg.sender, amount);

        emit Withdraw(msg.sender, amount, userBalances[msg.sender]);
    }

    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    // Alternative: Pull pattern where contract holds tokens
    function withdrawDirect(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");

        // Update balance BEFORE transfer
        userBalances[msg.sender] -= amount;

        // Transfer from contract to user
        gameToken.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount, userBalances[msg.sender]);
    }
}
```

### Key Differences from Rust Version

- **On-Chain Balance Validation**: Solidity version validates balance on-chain
- **Checks-Effects-Interactions**: Update state before external calls
- **No PDA Signing**: Contract directly holds/transfers tokens
- **SafeERC20**: Use safe transfer methods to handle tokens properly
- **ReentrancyGuard**: Protect against reentrancy attacks
- **Events**: Emit withdrawal events for transparency
- **Require Statements**: Explicit validation instead of Anchor constraints
- **Two Patterns Available**:
  1. Transfer from approved `bankAuthority` address
  2. Contract directly holds tokens (simpler, recommended)

### Security Improvements for Solidity

```solidity
// Add withdrawal limits
uint256 public constant MAX_WITHDRAWAL_PER_TX = 1000000 * 10**18;
uint256 public constant DAILY_WITHDRAWAL_LIMIT = 10000000 * 10**18;

mapping(address => uint256) public lastWithdrawalTime;
mapping(address => uint256) public dailyWithdrawn;

function withdrawWithLimits(uint256 amount) external nonReentrant {
    require(amount > 0 && amount <= MAX_WITHDRAWAL_PER_TX, "Invalid amount");
    require(userBalances[msg.sender] >= amount, "Insufficient balance");

    // Reset daily limit if 24 hours passed
    if (block.timestamp > lastWithdrawalTime[msg.sender] + 1 days) {
        dailyWithdrawn[msg.sender] = 0;
    }

    require(
        dailyWithdrawn[msg.sender] + amount <= DAILY_WITHDRAWAL_LIMIT,
        "Daily limit exceeded"
    );

    // Update state
    userBalances[msg.sender] -= amount;
    dailyWithdrawn[msg.sender] += amount;
    lastWithdrawalTime[msg.sender] = block.timestamp;

    // Transfer
    gameToken.safeTransfer(msg.sender, amount);

    emit Withdraw(msg.sender, amount, userBalances[msg.sender]);
}
```
