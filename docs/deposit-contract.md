# Deposit Contract Documentation

## File Location

`rugs-fun/programs/rugs-fun/src/instructions/deposit.rs`

## Purpose

The Deposit contract allows users to deposit SPL Token 2022 tokens into the platform's vault. Tokens are transferred from the user's associated token account to the platform's bank account controlled by the `bank_authority` PDA.

## Contract Structure

### Account Structure: `Deposit<'info>`

```rust
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
       mut,
       seeds=[b"bank_authority"],
       bump
    )]
    pub bank_authority: UncheckedAccount<'info>,

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

| Account                    | Type             | Mutable | Description                                                       |
| -------------------------- | ---------------- | ------- | ----------------------------------------------------------------- |
| `signer`                   | Signer           | ✅      | The user wallet depositing tokens. Must sign the transaction.     |
| `bank_authority`           | UncheckedAccount | ✅      | **PDA** derived from `"bank_authority"`. Owns the platform vault. |
| `bank_account`             | TokenAccount     | ✅      | Platform's ATA for receiving deposits. Owned by `bank_authority`. |
| `user_account`             | TokenAccount     | ✅      | User's ATA for the game token. Must have sufficient balance.      |
| `mint`                     | Mint             | ✅      | The SPL Token 2022 mint address.                                  |
| `token_program`            | Interface        | ❌      | SPL Token 2022 program interface.                                 |
| `associated_token_program` | Program          | ❌      | ATA program reference.                                            |

## Function: `process_deposit`

### Signature

```rust
pub fn process_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()>
```

### Parameters

- `ctx`: Anchor context with all required accounts
- `amount`: Token amount to deposit (in lamports/smallest unit)

### Returns

- `Result<()>`: Success or Anchor error

### Functionality

```rust
pub fn process_deposit(ctx: Context<Deposit>, amount:u64) -> Result<()> {
    let cpi_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            authority: ctx.accounts.signer.to_account_info(),
            from: ctx.accounts.user_account.to_account_info(),
            to: ctx.accounts.bank_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info()
        }
    );

    transfer_checked(cpi_context, amount, ctx.accounts.mint.decimals)?;
    msg!("Successfully deposited user's amount to platform.");
    Ok(())
}
```

### Logic Flow

1. **Setup CPI Context**: Creates Cross-Program Invocation context for SPL Token program
2. **Specify Transfer Details**:
   - `authority`: User (`signer`) authorizes the transfer
   - `from`: User's token account
   - `to`: Platform's bank account
   - `mint`: Token mint to verify correct token
3. **Execute Transfer**: Calls `transfer_checked` with amount and decimals
4. **Log Success**: Emits log message
5. **Return**: Returns Ok on success

### Security Validations (Anchor Automatic)

- ✅ `signer` must sign the transaction
- ✅ `user_account` must be owned by `signer`
- ✅ `bank_account` must be owned by `bank_authority`
- ✅ Both accounts must be for the same `mint`
- ✅ `user_account` must have sufficient balance
- ✅ Decimal precision validated by `transfer_checked`

## Usage Example (Frontend Integration)

```typescript
import { BN, Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function depositTokens(wallet, program, amount) {
  const MINT_ADDRESS = "J8NDF3RxtfZ5E2vks2NdchwE3PXNMNwUngCpEbMoLaoL";

  // Get user's ATA
  const user_account = await getAssociatedTokenAddress(
    new PublicKey(MINT_ADDRESS),
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  // Convert amount to lamports (smallest unit)
  const lamportAmount = amount * LAMPORTS_PER_SOL;

  // Build transaction
  const ix = await program.methods
    .deposit(new BN(lamportAmount))
    .accountsPartial({
      mint: new PublicKey(MINT_ADDRESS),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      signer: wallet.publicKey,
      userAccount: user_account,
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

  // Update off-chain balance in database
  await updateBalance(lamportAmount, wallet.publicKey.toString());

  console.log("Deposit successful:", txSig);
}
```

## Off-Chain Integration

After successful on-chain deposit, the platform updates user balance in Supabase:

```typescript
export async function updateBalance(depositedAmount, wallet_address) {
  const supabase = await createClient();

  // Fetch current balance
  const { data: balance } = await supabase
    .from("users_rugsfun")
    .select("*")
    .eq("wallet_address", wallet_address)
    .single();

  // Update balance
  const updatedBalance = (balance?.balance ?? 0) + depositedAmount;

  await supabase
    .from("users_rugsfun")
    .update({
      balance: updatedBalance,
      depositedBalance: updatedBalance,
    })
    .eq("wallet_address", wallet_address);

  return updatedBalance;
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

contract RugsFunDeposit is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public gameToken;
    address public bankAuthority;

    // User deposits tracking (on-chain alternative to off-chain DB)
    mapping(address => uint256) public userBalances;
    mapping(address => uint256) public userDepositedBalance;

    event Deposit(address indexed user, uint256 amount, uint256 newBalance);

    constructor(address _gameToken, address _bankAuthority) {
        gameToken = IERC20(_gameToken);
        bankAuthority = _bankAuthority;
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        // Transfer tokens from user to contract
        gameToken.safeTransferFrom(msg.sender, bankAuthority, amount);

        // Update balances
        userBalances[msg.sender] += amount;
        userDepositedBalance[msg.sender] += amount;

        emit Deposit(msg.sender, amount, userBalances[msg.sender]);
    }

    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }
}
```

### Key Differences from Rust Version

- **SafeERC20**: Use OpenZeppelin's SafeERC20 for safe transfers
- **ReentrancyGuard**: Protect against reentrancy attacks
- **Mappings**: Store balances on-chain instead of off-chain database
- **Events**: Emit events for indexing and tracking
- **No CPI**: Direct ERC-20 transfer instead of cross-program invocation
- **Require Statements**: Explicit validation instead of Anchor constraints
