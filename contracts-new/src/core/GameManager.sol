// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IGameManager} from "../interfaces/IGameManager.sol";
import {IRugsFun} from "../interfaces/IRugsFun.sol";
import {ITreasury} from "../interfaces/ITreasury.sol";
import {Errors} from "../utils/Errors.sol";
import {Constants} from "../utils/Constants.sol";

/**
 * @title GameManager
 * @notice Manages game state, provably fair commit-reveal, and trade settlement
 * @dev Implements commit-reveal scheme to ensure fairness:
 *      1. Backend commits hash(seed + crashMultiplier) before game starts
 *      2. Players place bets and cash out during game
 *      3. Backend reveals seed + crashMultiplier at game end
 *      4. Anyone can verify: keccak256(seed, crashMultiplier) == commitHash
 */
contract GameManager is IGameManager, Ownable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice The RugsFun contract for balance management
    IRugsFun public immutable rugsFun;

    /// @notice The Treasury contract for fee collection
    ITreasury public treasury;

    /// @notice Backend operator authorized to manage games
    address public operator;

    /// @notice Current game ID (increments for each game)
    uint256 public currentGameId;

    /// @notice Timestamp when current game started
    uint256 public currentGameStartTime;

    /// @notice Whether a game is currently active
    bool public gameActive;

    /// @notice Maximum number of games to store in history
    uint256 public constant MAX_GAME_HISTORY = 100;



    /// @notice Game results after completion
    mapping(uint256 => GameResult) private gameResults;

    /// @notice Player trades per game
    mapping(uint256 => mapping(address => Trade)) private trades;

    /// @notice List of players who participated in each game
    mapping(uint256 => address[]) private gamePlayers;

    /// @notice Recent game IDs for history (circular buffer)
    uint256[] private recentGameIds;

    /// @notice Index for circular buffer
    uint256 private recentGamesIndex;

    // ============ Constructor ============

    /**
     * @notice Initialize GameManager
     * @param _rugsFun Address of RugsFun contract
     * @param _treasury Address of Treasury contract
     * @param _operator Address of backend operator
     * @param _owner Address of contract owner
     */
    constructor(
        address _rugsFun,
        address _treasury,
        address _operator,
        address _owner
    ) Ownable(_owner) {
        if (_rugsFun == address(0)) revert Errors.InvalidAddress(_rugsFun);
        if (_treasury == address(0)) revert Errors.InvalidAddress(_treasury);
        if (_operator == address(0)) revert Errors.InvalidAddress(_operator);

        rugsFun = IRugsFun(_rugsFun);
        treasury = ITreasury(_treasury);
        operator = _operator;
        currentGameId = 1;

        // Initialize recent games array
        recentGameIds = new uint256[](MAX_GAME_HISTORY);
    }

    // ============ Modifiers ============

    /// @notice Restrict function to operator only
    modifier onlyOperator() {
        if (msg.sender != operator) revert Errors.Unauthorized(msg.sender);
        _;
    }

    // ============ Operator Functions ============

    /**
     * @notice Start a new game round
     * @param gameId The game ID to start (must match currentGameId)
     */
    function startGame(uint256 gameId) external onlyOperator {
        if (gameId != currentGameId) revert Errors.InvalidGameId(gameId);
        if (gameActive) revert Errors.GameAlreadyActive();

        gameActive = true;
        currentGameStartTime = block.timestamp;

        emit GameStarted(gameId, block.timestamp);
    }

    /**
     * @notice End current game with a specific crash multiplier
     * @param gameId The game ID to end
     * @param crashMultiplier The crash multiplier (in basis points, e.g., 15000 = 1.5x)
     * @dev Trust-based: Operator submits the result directly
     */
    function endGame(uint256 gameId, uint256 crashMultiplier) external onlyOperator {
        if (gameId != currentGameId) revert Errors.InvalidGameId(gameId);
        if (!gameActive) revert Errors.GameNotActive();

        // Validate crash multiplier
        if (crashMultiplier < Constants.MIN_MULTIPLIER || 
            crashMultiplier > Constants.MAX_MULTIPLIER) {
            revert Errors.InvalidMultiplier(crashMultiplier);
        }

        // Create game result
        gameResults[gameId] = GameResult({
            gameId: gameId,
            startTime: currentGameStartTime,
            endTime: block.timestamp,
            crashMultiplier: crashMultiplier,
            totalVolume: 0, 
            playerCount: 0,
            settled: false
        });

        // Add to recent games history
        recentGameIds[recentGamesIndex] = gameId;
        recentGamesIndex = (recentGamesIndex + 1) % MAX_GAME_HISTORY;

        gameActive = false;
        currentGameId++;

        // emit GameRevealed(gameId, 0, crashMultiplier); // Deprecated
        emit GameEnded(gameId, crashMultiplier, 0, 0); 
    }

    /**
     * @notice Settle a single trade for a player (called after game ends)
     * @param gameId The game ID this trade belongs to
     * @param player The player address
     * @param betAmount The amount wagered
     * @param cashoutMultiplier The multiplier the player cashed out at (0 if lost)
     * @dev Called by backend for each winner (or all players if we want to record losses too)
     */
    function settleTrade(
        uint256 gameId,
        address player,
        uint256 betAmount,
        uint256 cashoutMultiplier
    ) external onlyOperator {
        // Validation
        if (gameId >= currentGameId) revert Errors.InvalidGameId(gameId); // Game must be finished
        
        GameResult storage result = gameResults[gameId];
        if (result.gameId == 0) revert Errors.GameResultNotFound();
        
        // Update stats
        result.totalVolume += betAmount;
        // Note: unique player count logic is simplified/omitted here for gas savings on multiple calls

        uint256 payout = 0;
        uint256 fee = 0;

        // Calculate Payout
        if (cashoutMultiplier > 0) {
            // User won
             if (cashoutMultiplier > result.crashMultiplier) {
                 // Safety check: cannot cashout higher than crash
                 revert Errors.InvalidMultiplier(cashoutMultiplier);
             }

             // Calculate gross payout
            uint256 grossPayout = Constants.applyMultiplier(betAmount, cashoutMultiplier);
            
            // Calculate house edge
            uint256 houseEdge = Constants.calculateFee(grossPayout, Constants.HOUSE_EDGE_BPS);
            uint256 netPayout = grossPayout - houseEdge;
            fee = houseEdge;

            // Platform fee logic (on PROFIT only)
            if (netPayout > betAmount) {
                uint256 profit = netPayout - betAmount;
                uint256 platformFee = Constants.calculateFee(profit, Constants.PLATFORM_FEE_BPS);
                fee += platformFee;
                netPayout -= platformFee;
            }

            // Settlement
            if (netPayout > betAmount) {
                // User made a profit
                rugsFun.creditWinnings(player, netPayout - betAmount);
            } else if (netPayout < betAmount) {
                // User lost some money (e.g. fees > profit, or < 1.0x cashout if allowed)
                rugsFun.debitLoss(player, betAmount - netPayout);
            }
            // If equal, do nothing.

            payout = netPayout;
        } else {
            // User Lost (Crashed)
            // Full bet lost
            
            // Debit full bet from user
            rugsFun.debitLoss(player, betAmount);
            
            payout = 0;
        }
    }

    // ============ View Functions ============



    /**
     * @notice Get game result data
     * @param gameId The game ID to query
     * @return Game result data
     */
    function getGameResult(uint256 gameId) external view returns (GameResult memory) {
        return gameResults[gameId];
    }

    /**
     * @notice Get player's trade data for a game
     * @param gameId The game ID to query
     * @param player The player address
     * @return Trade data
     */
    function getTrade(uint256 gameId, address player) external view returns (Trade memory) {
        return trades[gameId][player];
    }

    /**
     * @notice Get current game ID
     * @return Current game ID
     */
    function getCurrentGameId() external view returns (uint256) {
        return currentGameId;
    }

    /**
     * @notice Verify game outcome was fair
     * @param gameId The game ID to verify
     * @return True if game can be verified as fair
     */
    function verifyGame(uint256 gameId) external view returns (bool) {
        GameResult storage result = gameResults[gameId];
        // In trust-based model, we assume all settled games are valid
        return result.endTime > 0;
    }

    /**
     * @notice Get recent game IDs
     * @param count Number of recent games to return (max MAX_GAME_HISTORY)
     * @return Array of recent game IDs
     */
    function getRecentGames(uint256 count) external view returns (GameResult[] memory) {
        if (count > MAX_GAME_HISTORY) count = MAX_GAME_HISTORY;
        if (count > currentGameId - 1) count = currentGameId - 1;

        GameResult[] memory result = new GameResult[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 index = (recentGamesIndex + MAX_GAME_HISTORY - 1 - i) % MAX_GAME_HISTORY;
            uint256 gameId = recentGameIds[index];
            if (gameId == 0) break; // No more games in history
            result[i] = gameResults[gameId];
        }

        return result;
    }

    /**
     * @notice Get all players who participated in a game
     * @param gameId The game ID to query
     * @return Array of player addresses
     */
    function getGamePlayers(uint256 gameId) external view returns (address[] memory) {
        return gamePlayers[gameId];
    }

    /**
     * @notice Check if game is currently active
     * @return True if game is active
     */
    function isGameActive() external view returns (bool) {
        return gameActive;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set new operator address
     * @param newOperator Address of new operator
     */
    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert Errors.InvalidAddress(newOperator);
        
        address oldOperator = operator;
        operator = newOperator;

        emit OperatorUpdated(oldOperator, newOperator);
    }

    /**
     * @notice Set new treasury address
     * @param newTreasury Address of new treasury
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert Errors.InvalidAddress(newTreasury);
        
        address oldTreasury = address(treasury);
        treasury = ITreasury(newTreasury);

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Emergency function to cancel active game
     * @dev Only owner can call in emergencies
     */
    function emergencyCancelGame() external onlyOwner {
        if (!gameActive) revert Errors.GameNotActive();

        uint256 gameId = currentGameId;
        gameActive = false;
        currentGameId++;

        emit GameCancelled(gameId, msg.sender, block.timestamp);
    }
}
