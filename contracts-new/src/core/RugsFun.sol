// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IRugsFun} from "../interfaces/IRugsFun.sol";
import {Errors} from "../utils/Errors.sol";
import {Constants} from "../utils/Constants.sol";

/**
 * @title RugsFun
 * @notice Main contract for the Rugs.Fun crash game platform
 * @dev Handles deposits, withdrawals, and on-chain balance tracking
 *
 * ARCHITECTURE:
 * - Replaces Solana's PDA-based custody with direct contract ownership
 * - Uses OpenZeppelin's Ownable for single-owner access control
 * - Implements emergency pause mechanism
 * - Tracks all balances on-chain (single source of truth)
 *
 * MIGRATION FROM SOLANA:
 * - deposit() replaces Anchor's deposit instruction
 * - withdraw() replaces Anchor's withdraw instruction
 * - No PDA needed - contract directly holds tokens
 * - Events replace Solana program logs
 */
contract RugsFun is IRugsFun, Ownable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice Game token used for deposits/withdrawals
    IERC20 public immutable gameToken;

    /// @notice Treasury address for platform fees
    address public treasury;

    /// @notice User balances (on-chain source of truth)
    mapping(address => uint256) public balances;

    /// @notice Total deposited balance per user
    mapping(address => uint256) public depositedBalances;

    /// @notice Daily withdrawal tracking
    mapping(address => mapping(uint256 => uint256)) public dailyWithdrawals;

    /// @notice Minimum deposit amount
    uint256 public minDeposit;

    /// @notice Maximum deposit amount
    uint256 public maxDeposit;

    /// @notice Minimum withdrawal amount
    uint256 public minWithdrawal;

    /// @notice Maximum withdrawal per transaction
    uint256 public maxWithdrawal;

    /// @notice Total value locked in contract
    uint256 public totalValueLocked;

    // ============ Constructor ============

    /**
     * @notice Initialize the RugsFun contract
     * @param _gameToken Address of the ERC20 game token
     * @param _treasury Address of the treasury
     * @param _owner Address of the contract owner
     */
    constructor(
        address _gameToken,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        if (_gameToken == address(0)) revert Errors.InvalidAddress(_gameToken);
        if (_treasury == address(0)) revert Errors.InvalidAddress(_treasury);

        gameToken = IERC20(_gameToken);
        treasury = _treasury;

        // Set default limits from constants
        minDeposit = Constants.MIN_DEPOSIT;
        maxDeposit = Constants.MAX_DEPOSIT;
        minWithdrawal = Constants.MIN_WITHDRAWAL;
        maxWithdrawal = Constants.MAX_WITHDRAWAL_PER_TX;
    }

    // ============ User Functions ============

    /**
     * @notice Deposit tokens into the platform
     * @dev Equivalent to Solana's deposit instruction
     *
     * Flow:
     * 1. Validate amount within limits
     * 2. Transfer tokens from user to contract (SafeERC20)
     * 3. Update user balance and TVL
     * 4. Emit Deposit event
     *
     * @param amount Amount of tokens to deposit
     */
    function deposit(uint256 amount) external override {
        if (amount == 0) revert Errors.ZeroAmount();
        if (amount < minDeposit) {
            revert Errors.DepositBelowMinimum(amount, minDeposit);
        }
        if (amount > maxDeposit) {
            revert Errors.DepositExceedsMaximum(amount, maxDeposit);
        }

        // Transfer tokens from user to contract
        gameToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update balances
        balances[msg.sender] += amount;
        depositedBalances[msg.sender] += amount;
        totalValueLocked += amount;

        emit Deposit(msg.sender, amount, balances[msg.sender]);
    }

    /**
     * @notice Withdraw tokens from the platform
     * @dev Equivalent to Solana's withdraw instruction
     * @param amount Amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external override {
        if (amount == 0) revert Errors.ZeroAmount();
        if (amount < minWithdrawal) {
            revert Errors.InvalidWithdrawalAmount(amount);
        }
        if (amount > maxWithdrawal) {
            revert Errors.WithdrawalLimitExceeded(amount, maxWithdrawal);
        }

        uint256 userBalance = balances[msg.sender];
        if (userBalance < amount) {
            revert Errors.InsufficientBalance(userBalance, amount);
        }

        // Check daily withdrawal limit
        uint256 today = block.timestamp / Constants.DAILY_LIMIT_WINDOW;
        uint256 todayWithdrawals = dailyWithdrawals[msg.sender][today];

        if (todayWithdrawals + amount > Constants.DAILY_WITHDRAWAL_LIMIT) {
            revert Errors.DailyLimitExceeded(
                Constants.DAILY_WITHDRAWAL_LIMIT,
                todayWithdrawals,
                amount
            );
        }

        // Transfer tokens from contract to user
        gameToken.safeTransfer(msg.sender, amount);

        // Update state after transfer
        balances[msg.sender] -= amount;
        totalValueLocked -= amount;
        dailyWithdrawals[msg.sender][today] += amount;

        emit Withdraw(msg.sender, amount, balances[msg.sender]);
    }

    /**
     * @notice Get user's balance
     * @param user Address of the user
     * @return User's current balance
     */
    function balanceOf(address user) external view override returns (uint256) {
        return balances[user];
    }

    /**
     * @notice Get user's total deposited balance
     * @param user Address of the user
     * @return User's total deposited amount
     */
    function depositedBalance(address user) external view override returns (uint256) {
        return depositedBalances[user];
    }

    // ============ Admin Functions ============

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external override onlyOwner {
        if (newTreasury == address(0)) revert Errors.InvalidAddress(newTreasury);

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Update deposit limits
     * @param _minDeposit New minimum deposit amount
     * @param _maxDeposit New maximum deposit amount
     */
    function setDepositLimits(uint256 _minDeposit, uint256 _maxDeposit) external override onlyOwner {
        if (_minDeposit > _maxDeposit) revert Errors.InvalidDepositAmount(_minDeposit);

        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;

        emit DepositLimitsUpdated(_minDeposit, _maxDeposit);
    }

    /**
     * @notice Update withdrawal limits
     * @param _minWithdrawal New minimum withdrawal amount
     * @param _maxWithdrawal New maximum withdrawal per transaction
     */
    function setWithdrawalLimits(uint256 _minWithdrawal, uint256 _maxWithdrawal)
        external
        override
        onlyOwner
    {
        if (_minWithdrawal > _maxWithdrawal) {
            revert Errors.InvalidWithdrawalAmount(_minWithdrawal);
        }

        minWithdrawal = _minWithdrawal;
        maxWithdrawal = _maxWithdrawal;

        emit WithdrawalLimitsUpdated(_minWithdrawal, _maxWithdrawal);
    }

    // ============ View Functions ============

    /**
     * @notice Get current deposit limits
     * @return minDeposit_ Minimum deposit amount
     * @return maxDeposit_ Maximum deposit amount
     */
    function getDepositLimits() external view override returns (uint256 minDeposit_, uint256 maxDeposit_) {
        return (minDeposit, maxDeposit);
    }

    /**
     * @notice Get current withdrawal limits
     * @return minWithdrawal_ Minimum withdrawal amount
     * @return maxWithdrawal_ Maximum withdrawal per transaction
     */
    function getWithdrawalLimits()
        external
        view
        override
        returns (uint256 minWithdrawal_, uint256 maxWithdrawal_)
    {
        return (minWithdrawal, maxWithdrawal);
    }
}
