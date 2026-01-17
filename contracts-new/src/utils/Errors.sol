// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Errors
 * @notice Custom error definitions for Rugs.Fun contracts
 * @dev Using custom errors saves gas compared to require strings
 */
library Errors {
    // ============ Admin & Initialization Errors (0-99) ============
    
    /// @notice Thrown when contract is already initialized
    error AlreadyInitialized();
    
    /// @notice Thrown when contract is not initialized
    error NotInitialized();
    
    /// @notice Thrown when caller is not authorized
    /// @param caller Address that attempted the unauthorized action
    error Unauthorized(address caller);
    
    /// @notice Thrown when provided address is invalid (zero address)
    /// @param addr The invalid address
    error InvalidAddress(address addr);
    
    /// @notice Thrown when contract is paused
    error ContractPaused();
    
    /// @notice Thrown when contract is not paused
    error ContractNotPaused();

    // ============ Deposit Errors (100-199) ============
    
    /// @notice Thrown when deposit amount is invalid (zero or exceeds limits)
    /// @param amount The invalid deposit amount
    error InvalidDepositAmount(uint256 amount);
    
    /// @notice Thrown when deposit is below minimum
    /// @param amount Attempted deposit amount
    /// @param minimum Minimum required amount
    error DepositBelowMinimum(uint256 amount, uint256 minimum);
    
    /// @notice Thrown when deposit exceeds maximum
    /// @param amount Attempted deposit amount
    /// @param maximum Maximum allowed amount
    error DepositExceedsMaximum(uint256 amount, uint256 maximum);
    
    /// @notice Thrown when deposit fails
    /// @param user User address
    /// @param amount Deposit amount
    error DepositFailed(address user, uint256 amount);
    
    /// @notice Thrown when token transfer fails
    error TokenTransferFailed();

    // ============ Withdrawal Errors (200-299) ============
    
    /// @notice Thrown when withdrawal amount is invalid
    /// @param amount The invalid withdrawal amount
    error InvalidWithdrawalAmount(uint256 amount);
    
    /// @notice Thrown when user has insufficient balance
    /// @param available User's available balance
    /// @param required Required amount for withdrawal
    error InsufficientBalance(uint256 available, uint256 required);
    
    /// @notice Thrown when withdrawal exceeds per-transaction limit
    /// @param amount Attempted withdrawal amount
    /// @param limit Maximum allowed per transaction
    error WithdrawalLimitExceeded(uint256 amount, uint256 limit);
    
    /// @notice Thrown when daily withdrawal limit is exceeded
    /// @param dailyLimit Daily withdrawal limit
    /// @param totalWithdrawn Total already withdrawn today
    /// @param attemptedAmount Amount attempting to withdraw
    error DailyLimitExceeded(uint256 dailyLimit, uint256 totalWithdrawn, uint256 attemptedAmount);
    
    /// @notice Thrown when withdrawal fails
    /// @param user User address
    /// @param amount Withdrawal amount
    error WithdrawalFailed(address user, uint256 amount);

    // ============ Game Logic Errors (300-399) ============
    
    /// @notice Thrown when game is not in active state
    error GameNotActive();
    
    /// @notice Thrown when game has already started
    error GameAlreadyStarted();
    
    /// @notice Thrown when bet amount is too low
    /// @param minimum Minimum bet amount
    /// @param provided Provided bet amount
    error BetTooLow(uint256 minimum, uint256 provided);
    
    /// @notice Thrown when bet amount is too high
    /// @param maximum Maximum bet amount
    /// @param provided Provided bet amount
    error BetTooHigh(uint256 maximum, uint256 provided);
    
    /// @notice Thrown when multiplier is invalid
    /// @param multiplier The invalid multiplier
    error InvalidMultiplier(uint256 multiplier);
    
    /// @notice Thrown when game ID is invalid
    /// @param gameId The invalid game ID
    error InvalidGameId(uint256 gameId);
    
    /// @notice Thrown when game has already ended
    /// @param gameId The game ID
    error GameAlreadyEnded(bytes32 gameId);
    
    /// @notice Thrown when user has no active trade
    /// @param user User address
    error NoActiveTrade(address user);
    
    /// @notice Thrown when user already has an active trade
    /// @param user User address
    error TradeAlreadyActive(address user);

    // ============ Provably Fair Errors (400-499) ============
    
    /// @notice Thrown when commit hash is invalid
    /// @param commitHash The invalid commit hash
    error InvalidCommitHash(bytes32 commitHash);
    
    /// @notice Thrown when reveal data doesn't match commit
    /// @param expected Expected hash from reveal
    /// @param actual Actual commit hash
    error RevealMismatch(bytes32 expected, bytes32 actual);
    
    /// @notice Thrown when game has not been committed
    /// @param gameId The game ID
    error GameNotCommitted(uint256 gameId);
    
    /// @notice Thrown when game has already been revealed
    /// @param gameId The game ID
    error GameAlreadyRevealed(uint256 gameId);
    
    /// @notice Thrown when reveal is attempted too early
    /// @param gameId The game ID
    /// @param minTime Minimum time required
    error RevealTooEarly(bytes32 gameId, uint256 minTime);

    // ============ General Errors (500+) ============
    
    /// @notice Thrown when amount is zero
    error ZeroAmount();
    
    /// @notice Thrown when array lengths don't match
    /// @param length1 First array length
    /// @param length2 Second array length
    error ArrayLengthMismatch(uint256 length1, uint256 length2);
    
    /// @notice Thrown when operation would cause overflow
    error ArithmeticOverflow();
    
    /// @notice Thrown when operation would cause underflow
    error ArithmeticUnderflow();
    
    /// @notice Thrown when reentrancy is detected
    error ReentrancyDetected();

    /// @notice Thrown when fee percentage is invalid
    /// @param feePercentage The invalid fee percentage
    error InvalidFeePercentage(uint256 feePercentage);

    /// @notice Thrown when trying to recover game token
    error CannotRecoverGameToken();

    /// @notice Thrown when game result not found
    error GameResultNotFound();

    /// @notice Thrown when trades are already settled
    error TradesAlreadySettled();

    /// @notice Thrown when player already has active trade
    /// @param player Player address
    error PlayerAlreadyInGame(address player);

    /// @notice Thrown when player already cashed out
    /// @param player Player address
    error AlreadyCashedOut(address player);

    /// @notice Thrown when cooldown period not elapsed
    /// @param requiredTime Required timestamp
    /// @param currentTime Current timestamp
    error CooldownNotElapsed(uint256 requiredTime, uint256 currentTime);

    /// @notice Thrown when game already active
    error GameAlreadyActive();

    /// @notice Thrown when game not revealed
    error GameNotRevealed();
}
