// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ITreasury} from "../interfaces/ITreasury.sol";
import {Errors} from "../utils/Errors.sol";
import {Constants} from "../utils/Constants.sol";

/**
 * @title Treasury
 * @notice Manages platform fees collected from game activity
 * @dev Receives fees from GameManager and allows owner to withdraw
 */
contract Treasury is ITreasury, Ownable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice The game token used for fees
    IERC20 public immutable gameToken;

    /// @notice Total fees collected (cumulative)
    uint256 public totalFeesCollected;

    /// @notice Platform fee percentage in basis points
    uint256 public feePercentageBps;

    /// @notice Address authorized to collect fees (GameManager)
    address public feeCollector;

    // ============ Constructor ============

    /**
     * @notice Initialize Treasury
     * @param _gameToken Address of game token
     * @param _feeCollector Address authorized to collect fees (GameManager)
     * @param _owner Address of contract owner
     */
    constructor(
        address _gameToken,
        address _feeCollector,
        address _owner
    ) Ownable(_owner) {
        if (_gameToken == address(0)) revert Errors.InvalidAddress(_gameToken);
        if (_feeCollector == address(0)) revert Errors.InvalidAddress(_feeCollector);

        gameToken = IERC20(_gameToken);
        feeCollector = _feeCollector;
        feePercentageBps = Constants.PLATFORM_FEE_BPS;
    }

    // ============ Modifiers ============

    /// @notice Restrict function to fee collector only
    modifier onlyFeeCollector() {
        if (msg.sender != feeCollector) revert Errors.Unauthorized(msg.sender);
        _;
    }

    // ============ Fee Collection Functions ============

    /**
     * @notice Collect fees from game activity
     * @param amount Amount of fees to collect
     * @dev Only callable by authorized fee collector (GameManager)
     */
    function collectFees(uint256 amount) external onlyFeeCollector {
        if (amount == 0) revert Errors.ZeroAmount();

        totalFeesCollected += amount;

        emit FeesCollected(msg.sender, amount, totalFeesCollected);
    }

    // ============ Withdrawal Functions ============

    /**
     * @notice Withdraw fees to specified address
     * @param amount Amount to withdraw
     * @param to Recipient address
     * @dev Only owner can withdraw fees
     */
    function withdrawFees(uint256 amount, address to) external onlyOwner {
        if (amount == 0) revert Errors.ZeroAmount();
        if (to == address(0)) revert Errors.InvalidAddress(to);

        uint256 balance = feeBalance();
        if (balance < amount) {
            revert Errors.InsufficientBalance(balance, amount);
        }

        gameToken.safeTransfer(to, amount);

        emit FeesWithdrawn(to, amount);
    }

    /**
     * @notice Withdraw all available fees to specified address
     * @param to Recipient address
     * @dev Convenience function to withdraw entire balance
     */
    function withdrawAllFees(address to) external onlyOwner {
        if (to == address(0)) revert Errors.InvalidAddress(to);

        uint256 balance = feeBalance();
        if (balance == 0) revert Errors.ZeroAmount();

        gameToken.safeTransfer(to, balance);

        emit FeesWithdrawn(to, balance);
    }

    // ============ Admin Functions ============

    /**
     * @notice Set new fee percentage
     * @param newFeeBps New fee percentage in basis points
     * @dev Fee percentage affects future fee calculations
     */
    function setFeePercentage(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > Constants.BPS_DENOMINATOR) {
            revert Errors.InvalidFeePercentage(newFeeBps);
        }

        uint256 oldFeeBps = feePercentageBps;
        feePercentageBps = newFeeBps;

        emit FeePercentageUpdated(oldFeeBps, newFeeBps);
    }

    /**
     * @notice Set new fee collector address
     * @param newFeeCollector Address of new fee collector
     * @dev Only owner can update fee collector
     */
    function setFeeCollector(address newFeeCollector) external onlyOwner {
        if (newFeeCollector == address(0)) revert Errors.InvalidAddress(newFeeCollector);

        address oldFeeCollector = feeCollector;
        feeCollector = newFeeCollector;

        emit FeeCollectorUpdated(oldFeeCollector, newFeeCollector);
    }

    // ============ View Functions ============

    /**
     * @notice Get current fee balance
     * @return Current token balance held by treasury
     */
    function feeBalance() public view returns (uint256) {
        return gameToken.balanceOf(address(this));
    }

    /**
     * @notice Calculate fee for a given amount
     * @param amount Amount to calculate fee for
     * @return Fee amount
     */
    function calculateFee(uint256 amount) public view returns (uint256) {
        return Constants.calculateFee(amount, feePercentageBps);
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency token recovery
     * @param token Address of token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     * @dev Only for recovering accidentally sent tokens (not game token)
     */
    function emergencyTokenRecovery(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (token == address(gameToken)) {
            revert Errors.CannotRecoverGameToken();
        }
        if (to == address(0)) revert Errors.InvalidAddress(to);
        if (amount == 0) revert Errors.ZeroAmount();

        IERC20(token).safeTransfer(to, amount);

        emit EmergencyTokenRecovery(token, to, amount);
    }
}
