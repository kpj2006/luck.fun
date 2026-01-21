// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Constants
 * @notice Platform-wide constant values for Rugs.Fun
 * @dev All constants are public for easy access across contracts
 */
library Constants {
    // ============ Token & Financial Constants ============
    
    /// @notice Standard ERC20 decimals (matches most tokens)
    uint256 public constant DECIMALS = 18;
    
    /// @notice One token unit (10^18)
    uint256 public constant ONE_TOKEN = 10 ** DECIMALS;
    
    /// @notice Minimum deposit amount (0.01 tokens)
    uint256 public constant MIN_DEPOSIT = 0.01 ether;
    
    /// @notice Maximum deposit amount per transaction (1000 tokens)
    uint256 public constant MAX_DEPOSIT = 1000 ether;
    
    /// @notice Minimum withdrawal amount (0.01 tokens)
    uint256 public constant MIN_WITHDRAWAL = 0.01 ether;
    
    /// @notice Maximum withdrawal per transaction (1000 tokens)
    uint256 public constant MAX_WITHDRAWAL_PER_TX = 1000 ether;
    
    /// @notice Daily withdrawal limit per user (10000 tokens)
    uint256 public constant DAILY_WITHDRAWAL_LIMIT = 10000 ether;

    // ============ Game Constants ============
    
    /// @notice Minimum bet amount (0.001 tokens)
    uint256 public constant MIN_BET = 0.001 ether;
    
    /// @notice Maximum bet amount (100 tokens)
    uint256 public constant MAX_BET = 100 ether;
    
    /// @notice Minimum multiplier (0.00x - allows instant crashes)
    uint256 public constant MIN_MULTIPLIER = 0;
    
    /// @notice Maximum multiplier achievable (1000x)
    uint256 public constant MAX_MULTIPLIER = 100000;
    
    /// @notice House edge percentage in basis points (2% = 200 bps)
    uint256 public constant HOUSE_EDGE_BPS = 200;
    
    /// @notice Platform fee percentage in basis points (1% = 100 bps)
    uint256 public constant PLATFORM_FEE_BPS = 100;

    // ============ Time Constants ============
    
    /// @notice Game duration before auto-crash (30 seconds)
    uint256 public constant GAME_DURATION = 30 seconds;
    
    /// @notice Cooldown period between games (10 seconds)
    uint256 public constant COOLDOWN_PERIOD = 10 seconds;
    
    /// @notice Daily limit reset window (1 day)
    uint256 public constant DAILY_LIMIT_WINDOW = 1 days;
    
    /// @notice Minimum time before reveal (prevents front-running)
    uint256 public constant MIN_REVEAL_TIME = 30 seconds;

    // ============ Limits ============
    
    /// @notice Maximum number of players per game
    uint256 public constant MAX_PLAYERS_PER_GAME = 1000;
    
    /// @notice Maximum number of games to store in history
    uint256 public constant MAX_GAME_HISTORY = 100;
    
    /// @notice Maximum batch size for settlements
    uint256 public constant MAX_SETTLEMENT_BATCH = 100;

    // ============ Precision ============
    
    /// @notice Basis points denominator (100% = 10000 bps)
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Multiplier precision (1.00x = 100)
    uint256 public constant MULTIPLIER_PRECISION = 100;
    
    /// @notice Percentage precision (for calculations)
    uint256 public constant PERCENTAGE_PRECISION = 100;

    // ============ Game States ============
    
    /// @notice Game state: Waiting for players
    uint8 public constant STATE_WAITING = 0;
    
    /// @notice Game state: Active/running
    uint8 public constant STATE_ACTIVE = 1;
    
    /// @notice Game state: Crashed/ended
    uint8 public constant STATE_CRASHED = 2;

    // ============ Roles (for future access control) ============
    
    /// @notice Admin role hash
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    /// @notice Operator role hash (for backend server)
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    /// @notice Pauser role hash
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ Conversion Helpers ============
    
    /// @notice Convert basis points to percentage
    /// @param bps Basis points value
    /// @return Percentage value (scaled by PERCENTAGE_PRECISION)
    function bpsToPercentage(uint256 bps) internal pure returns (uint256) {
        return (bps * PERCENTAGE_PRECISION) / BPS_DENOMINATOR;
    }
    
    /// @notice Convert percentage to basis points
    /// @param percentage Percentage value (scaled by PERCENTAGE_PRECISION)
    /// @return Basis points value
    function percentageToBps(uint256 percentage) internal pure returns (uint256) {
        return (percentage * BPS_DENOMINATOR) / PERCENTAGE_PRECISION;
    }
    
    /// @notice Calculate fee amount from basis points
    /// @param amount Base amount
    /// @param feeBps Fee in basis points
    /// @return Fee amount
    function calculateFee(uint256 amount, uint256 feeBps) internal pure returns (uint256) {
        return (amount * feeBps) / BPS_DENOMINATOR;
    }
    
    /// @notice Apply multiplier to amount
    /// @param amount Base amount
    /// @param multiplier Multiplier (scaled by MULTIPLIER_PRECISION)
    /// @return Result after applying multiplier
    function applyMultiplier(uint256 amount, uint256 multiplier) internal pure returns (uint256) {
        return (amount * multiplier) / MULTIPLIER_PRECISION;
    }
}
