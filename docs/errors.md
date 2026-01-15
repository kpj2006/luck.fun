# Error Codes Documentation

## File Location

`rugs-fun/programs/rugs-fun/src/error.rs`

## Purpose

Defines custom error codes for the Rugs.Fun smart contracts. These errors provide specific feedback when contract execution fails.

## Error Enum Definition

```rust
use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,
}
```

## Error Codes

| Code | Name          | Message                | Description                                             |
| ---- | ------------- | ---------------------- | ------------------------------------------------------- |
| 6000 | `CustomError` | "Custom error message" | Generic custom error (placeholder - not currently used) |

## Usage in Contracts

### Throwing Custom Errors

```rust
use crate::error::ErrorCode;

pub fn some_function(ctx: Context<SomeContext>) -> Result<()> {
    if some_condition {
        return Err(ErrorCode::CustomError.into());
    }
    Ok(())
}
```

### Common Anchor Errors

While the contract only defines one custom error, Anchor framework provides built-in errors:

#### Account Validation Errors

- **`AccountNotMutable`** (3000): Account marked immutable but requires mutation
- **`AccountNotInitialized`** (3001): Account not initialized but expected to be
- **`AccountOwnedByWrongProgram`** (3007): Account owned by different program
- **`ConstraintSeeds`** (2006): PDA seeds don't match expected derivation
- **`ConstraintSigner`** (2009): Expected account to sign but didn't

#### CPI (Cross-Program Invocation) Errors

- **`InsufficientFunds`** (1): Account doesn't have enough lamports/tokens
- **`InvalidAccountData`** (17): Account data format is invalid

#### Token Program Errors (SPL Token 2022)

- **`InsufficientFunds`**: Not enough tokens in source account
- **`InvalidAuthorityType`**: Wrong authority type for operation
- **`OwnerMismatch`**: Token account owner doesn't match expected

## Error Handling in Frontend

```typescript
try {
  await depositTokens(wallet, program, amount);
} catch (error: any) {
  console.error("Transaction failed:", error);

  // Parse Anchor error
  if (error.code) {
    switch (error.code) {
      case 6000:
        alert("Custom error occurred");
        break;
      case 2009:
        alert("Transaction must be signed");
        break;
      case 3000:
        alert("Account cannot be modified");
        break;
      default:
        alert(`Error ${error.code}: ${error.msg}`);
    }
  } else {
    alert("Transaction failed. Please try again.");
  }
}
```

## Migration to Solidity (Monad)

### Solidity Custom Errors (Gas-Efficient)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Custom errors (more gas-efficient than require strings)
error InsufficientBalance(uint256 available, uint256 required);
error InvalidAmount(uint256 amount);
error Unauthorized(address caller);
error AlreadyInitialized();
error NotInitialized();
error WithdrawalLimitExceeded(uint256 limit, uint256 attempted);
error InvalidAddress(address addr);

contract RugsFunErrors {
    mapping(address => uint256) public balances;
    bool public initialized;
    address public owner;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
        _;
    }

    modifier onlyInitialized() {
        if (!initialized) revert NotInitialized();
        _;
    }

    function deposit(uint256 amount) external {
        if (amount == 0) revert InvalidAmount(amount);
        // ... deposit logic
    }

    function withdraw(uint256 amount) external onlyInitialized {
        if (amount == 0) revert InvalidAmount(amount);
        if (balances[msg.sender] < amount) {
            revert InsufficientBalance(balances[msg.sender], amount);
        }
        // ... withdrawal logic
    }

    function initialize(address _owner) external {
        if (initialized) revert AlreadyInitialized();
        if (_owner == address(0)) revert InvalidAddress(_owner);

        owner = _owner;
        initialized = true;
    }
}
```

### Solidity Require Statements (Alternative)

```solidity
contract RugsFunErrorsRequire {
    mapping(address => uint256) public balances;

    function deposit(uint256 amount) external {
        require(amount > 0, "Invalid amount");
        require(msg.sender != address(0), "Invalid sender");
        // ... deposit logic
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "Invalid amount");
        require(
            balances[msg.sender] >= amount,
            "Insufficient balance"
        );
        // ... withdrawal logic
    }
}
```

## Recommended Error Structure for Monad Migration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RugsFun Error Definitions
 * @notice Custom errors for the Rugs.Fun game platform
 */
library RugsFunErrors {
    // Admin & Initialization Errors (0-99)
    error AlreadyInitialized();
    error NotInitialized();
    error Unauthorized(address caller);
    error InvalidOwner(address owner);

    // Deposit Errors (100-199)
    error InvalidDepositAmount(uint256 amount);
    error DepositFailed(address user, uint256 amount);
    error TokenTransferFailed();

    // Withdrawal Errors (200-299)
    error InvalidWithdrawalAmount(uint256 amount);
    error InsufficientBalance(uint256 available, uint256 required);
    error WithdrawalLimitExceeded(uint256 limit, uint256 attempted);
    error DailyLimitExceeded(uint256 dailyLimit, uint256 totalWithdrawn);
    error WithdrawalFailed(address user, uint256 amount);

    // Game Logic Errors (300-399)
    error GameNotActive();
    error GameAlreadyStarted();
    error BetTooLow(uint256 minimum, uint256 provided);
    error BetTooHigh(uint256 maximum, uint256 provided);

    // General Errors (400+)
    error InvalidAddress(address addr);
    error ZeroAmount();
    error ContractPaused();
}
```

## Error Handling Best Practices

### Solidity

1. **Use Custom Errors** (Solidity 0.8.4+): More gas-efficient
2. **Provide Context**: Include relevant values in error parameters
3. **Descriptive Names**: Clear error names (e.g., `InsufficientBalance` not `Error1`)
4. **Error Libraries**: Organize errors in dedicated library file
5. **Modifiers**: Use modifiers for common validation patterns

### Frontend Integration

```typescript
// Solidity error parsing
const parseContractError = (error: any) => {
  // Custom error format: "execution reverted: InsufficientBalance(100, 500)"
  const errorRegex = /InsufficientBalance\((\d+), (\d+)\)/;
  const match = error.message?.match(errorRegex);

  if (match) {
    const [, available, required] = match;
    return `Insufficient balance. Available: ${available}, Required: ${required}`;
  }

  return error.message || "Transaction failed";
};
```
