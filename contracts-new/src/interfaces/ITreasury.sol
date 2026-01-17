// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ITreasury
 * @notice Interface for platform fee collection and management
 * @dev Handles platform revenue and fee withdrawals
 */
interface ITreasury {
    // ============ Events ============
    
    /// @notice Emitted when fees are collected
    /// @param from Source of fees (game contract)
    /// @param amount Amount of fees collected
    /// @param totalCollected New total collected amount
    event FeesCollected(address indexed from, uint256 amount, uint256 totalCollected);
    
    /// @notice Emitted when fees are withdrawn
    /// @param to Recipient address
    /// @param amount Amount withdrawn
    event FeesWithdrawn(address indexed to, uint256 amount);
    
    /// @notice Emitted when fee percentage is updated
    /// @param oldFeeBps Previous fee in basis points
    /// @param newFeeBps New fee in basis points
    event FeePercentageUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    /// @notice Emitted when fee collector is updated
    /// @param oldFeeCollector Previous fee collector
    /// @param newFeeCollector New fee collector
    event FeeCollectorUpdated(address indexed oldFeeCollector, address indexed newFeeCollector);

    /// @notice Emitted when tokens are recovered in emergency
    /// @param token Token address
    /// @param to Recipient address
    /// @param amount Amount recovered
    event EmergencyTokenRecovery(address indexed token, address indexed to, uint256 amount);

    // ============ Core Functions ============
    
    /// @notice Collect fees from game activity
    /// @param amount Amount of fees to collect
    function collectFees(uint256 amount) external;
    
    /// @notice Withdraw collected fees (owner only)
    /// @param amount Amount to withdraw
    /// @param to Recipient address
    function withdrawFees(uint256 amount, address to) external;
    
    /// @notice Withdraw all collected fees (owner only)
    /// @param to Recipient address
    function withdrawAllFees(address to) external;

    // ============ Admin Functions ============
    
    /// @notice Update platform fee percentage
    /// @param newFeeBps New fee in basis points (e.g., 100 = 1%)
    function setFeePercentage(uint256 newFeeBps) external;

    // ============ View Functions ============
    
    /// @notice Get the game token address
    /// @return Address of the ERC20 game token
    function gameToken() external view returns (IERC20);
    
    /// @notice Get total fees collected
    /// @return Total amount of fees collected
    function totalFeesCollected() external view returns (uint256);
    
    /// @notice Get current fee balance
    /// @return Current balance of fees in treasury
    function feeBalance() external view returns (uint256);
    
    /// @notice Get current fee percentage
    /// @return Fee in basis points
    function feePercentageBps() external view returns (uint256);
    
    /// @notice Calculate fee for a given amount
    /// @param amount Base amount
    /// @return Fee amount
    function calculateFee(uint256 amount) external view returns (uint256);
}
