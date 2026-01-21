// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IRugsFun
 * @notice Interface for the main RugsFun contract
 * @dev Defines core deposit/withdrawal and balance management functions
 */
interface IRugsFun {
    // ============ Events ============
    
    /// @notice Emitted when a user deposits tokens
    /// @param user Address of the user
    /// @param amount Amount deposited
    /// @param newBalance User's new balance
    event Deposit(address indexed user, uint256 amount, uint256 newBalance);
    
    /// @notice Emitted when a user withdraws tokens
    /// @param user Address of the user
    /// @param amount Amount withdrawn
    /// @param newBalance User's remaining balance
    event Withdraw(address indexed user, uint256 amount, uint256 newBalance);
    
    /// @notice Emitted when contract is paused
    /// @param by Address that paused the contract
    event Paused(address indexed by);
    
    /// @notice Emitted when contract is unpaused
    /// @param by Address that unpaused the contract
    event Unpaused(address indexed by);
    
    /// @notice Emitted when treasury address is updated
    /// @param oldTreasury Previous treasury address
    /// @param newTreasury New treasury address
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    
    /// @notice Emitted when deposit limits are updated
    /// @param minDeposit New minimum deposit amount
    /// @param maxDeposit New maximum deposit amount
    event DepositLimitsUpdated(uint256 minDeposit, uint256 maxDeposit);
    
    /// @notice Emitted when withdrawal limits are updated
    /// @param minWithdrawal New minimum withdrawal amount
    /// @param maxWithdrawal New maximum withdrawal per transaction
    event WithdrawalLimitsUpdated(uint256 minWithdrawal, uint256 maxWithdrawal);

    /// @notice Emitted when winnings are credited to a user
    /// @param user Address of the user
    /// @param amount Amount credited
    event WinningsCredited(address indexed user, uint256 amount);

    /// @notice Emitted when a user's balance is debited (loss)
    /// @param user Address of the user
    /// @param amount Amount debited
    event LossDebited(address indexed user, uint256 amount);

    /// @notice Emitted when platform profit is swept to treasury
    /// @param amount Amount swept
    event TreasurySweep(uint256 amount);

    /// @notice Emitted when manual fees are collected
    /// @param amount Amount collected
    event FeesCollected(uint256 amount);

    /// @notice Emitted when operator address is updated
    /// @param oldOperator Previous operator address
    /// @param newOperator New operator address
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);

    // ============ User Functions ============
    
    /// @notice Deposit tokens into the platform
    /// @param amount Amount of tokens to deposit
    function deposit(uint256 amount) external;
    
    /// @notice Withdraw tokens from the platform
    /// @param amount Amount of tokens to withdraw
    function withdraw(uint256 amount) external;

    /// @notice Credit winnings to a user's balance
    /// @param user Address of the user to credit
    /// @param amount Amount of tokens to credit
    function creditWinnings(address user, uint256 amount) external;

    /// @notice Debit loss from a user's balance
    /// @param user Address of the user to debit
    /// @param amount Amount of tokens to debit
    function debitLoss(address user, uint256 amount) external;

    /// @notice Transfer collected fees to treasury
    /// @param amount Amount of tokens to transfer
    function collectFees(uint256 amount) external;

    /// @notice Transfer platform surplus (profit) to treasury
    /// @dev Only callable by operator
    function sweepSurplus() external;
    
    /// @notice Get user's balance
    /// @param user Address of the user
    /// @return User's current balance
    function balanceOf(address user) external view returns (uint256);
    
    /// @notice Get total deposited balance for a user
    /// @param user Address of the user
    /// @return User's total deposited amount
    function depositedBalance(address user) external view returns (uint256);

    // ============ Admin Functions ============
    

    /// @notice Update treasury address
    /// @param newTreasury New treasury address
    function setTreasury(address newTreasury) external;

    /// @notice Update game manager address
    /// @param newGameManager New game manager address
    function setGameManager(address newGameManager) external;
    
    /// @notice Update operator address
    /// @param newOperator New operator address
    function setOperator(address newOperator) external;
    
    /// @notice Update deposit limits
    /// @param minDeposit New minimum deposit amount
    /// @param maxDeposit New maximum deposit amount
    function setDepositLimits(uint256 minDeposit, uint256 maxDeposit) external;
    
    /// @notice Update withdrawal limits
    /// @param minWithdrawal New minimum withdrawal amount
    /// @param maxWithdrawal New maximum withdrawal per transaction
    function setWithdrawalLimits(uint256 minWithdrawal, uint256 maxWithdrawal) external;

    // ============ View Functions ============
    
    /// @notice Get the game token address
    /// @return Address of the ERC20 game token
    function gameToken() external view returns (IERC20);
    
    /// @notice Get the treasury address
    /// @return Address of the treasury
    function treasury() external view returns (address);
    
    /// @notice Get current deposit limits
    /// @return minDeposit Minimum deposit amount
    /// @return maxDeposit Maximum deposit amount
    function getDepositLimits() external view returns (uint256 minDeposit, uint256 maxDeposit);
    
    /// @notice Get current withdrawal limits
    /// @return minWithdrawal Minimum withdrawal amount
    /// @return maxWithdrawal Maximum withdrawal per transaction
    function getWithdrawalLimits() external view returns (uint256 minWithdrawal, uint256 maxWithdrawal);
    
    /// @notice Get total value locked in contract
    /// @return Total TVL in tokens
    function totalValueLocked() external view returns (uint256);

    /// @notice Get total liabilities (sum of all user balances)
    /// @return Total liabilities in tokens
    function totalUserBalances() external view returns (uint256);
}
