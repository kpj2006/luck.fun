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

    /// @notice Game commits for provably fair verification
    mapping(uint256 => GameCommit) private gameCommits;

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
     * @notice Commit to next game's outcome (provably fair)
     * @param commitHash Hash of keccak256(abi.encodePacked(seed, crashMultiplier))
     * @dev Must be called before startGame()
     */
    function commitGame(bytes32 commitHash) external onlyOperator {
        if (gameActive) revert Errors.GameAlreadyActive();
        if (commitHash == bytes32(0)) revert Errors.InvalidCommitHash(commitHash);

        uint256 gameId = currentGameId;
        
        gameCommits[gameId] = GameCommit({
            commitHash: commitHash,
            timestamp: block.timestamp,
            revealed: false,
            seed: 0,
            crashMultiplier: 0
        });

        emit GameCommitted(gameId, commitHash, block.timestamp);
    }

    /**
     * @notice Start a new game round
     * @param gameId The game ID to start (must match currentGameId)
     * @dev Can only start if game was committed and cooldown passed
     */
    function startGame(uint256 gameId) external onlyOperator {
if (gameId != currentGameId) revert Errors.InvalidGameId(gameId);
        if (gameActive) revert Errors.GameAlreadyActive();

        GameCommit storage commit = gameCommits[gameId];
        if (commit.commitHash == bytes32(0)) revert Errors.GameNotCommitted(gameId);
        
        // Ensure cooldown period has passed since commit
        if (block.timestamp < commit.timestamp + Constants.COOLDOWN_PERIOD) {
            revert Errors.CooldownNotElapsed(
                commit.timestamp + Constants.COOLDOWN_PERIOD,
                block.timestamp
            );
        }

        gameActive = true;
        currentGameStartTime = block.timestamp;

        emit GameStarted(gameId, block.timestamp);
    }

    /**
     * @notice End current game and reveal outcome
     * @param gameId The game ID to end
     * @param seed Random seed used for crash calculation
     * @param crashMultiplier The crash multiplier (in basis points, e.g., 15000 = 1.5x)
     * @dev Verifies that keccak256(seed, crashMultiplier) == commitHash
     */
    function endGame(
        uint256 gameId,
        bytes32 seed,
        uint256 crashMultiplier
    ) external onlyOperator {
        if (gameId != currentGameId) revert Errors.InvalidGameId(gameId);
        if (!gameActive) revert Errors.GameNotActive();

        GameCommit storage commit = gameCommits[gameId];
        if (commit.revealed) revert Errors.GameAlreadyRevealed(gameId);

        // Verify provably fair commitment
        bytes32 actualHash = keccak256(abi.encodePacked(seed, crashMultiplier));
        if (actualHash != commit.commitHash) {
            revert Errors.RevealMismatch(commit.commitHash, actualHash);
        }

        // Validate crash multiplier
        if (crashMultiplier < Constants.MIN_MULTIPLIER || 
            crashMultiplier > Constants.MAX_MULTIPLIER) {
            revert Errors.InvalidMultiplier(crashMultiplier);
        }

        // Store reveal data
        commit.revealed = true;
        commit.seed = seed;
        commit.crashMultiplier = crashMultiplier;

        // Create game result
        gameResults[gameId] = GameResult({
            gameId: gameId,
            startTime: currentGameStartTime,
            endTime: block.timestamp,
            crashMultiplier: crashMultiplier,
            totalVolume: 0, // Will be updated during settlement
            playerCount: 0, // Will be updated during settlement
            settled: false
        });

        // Add to recent games history
        recentGameIds[recentGamesIndex] = gameId;
        recentGamesIndex = (recentGamesIndex + 1) % MAX_GAME_HISTORY;

        gameActive = false;
        currentGameId++;

        emit GameRevealed(gameId, seed, crashMultiplier);
        emit GameEnded(gameId, crashMultiplier, 0, 0); // totalVolume and playerCount will be set during settlement
    }

    /**
     * @notice Record a player's bet for current game
     * @param player Address of the player
     * @param betAmount Amount wagered
     * @param targetMultiplier Target cashout multiplier (in basis points)
     * @dev Called by backend when player places bet
     */
    function recordBet(
        uint256 gameId,
        address player,
        uint256 betAmount,
        uint256 targetMultiplier
    ) external onlyOperator {
        if (gameId != currentGameId) revert Errors.InvalidGameId(gameId);
        if (!gameActive) revert Errors.GameNotActive();
        
        // Validate bet amount
        if (betAmount < Constants.MIN_BET) {
            revert Errors.BetTooLow(Constants.MIN_BET, betAmount);
        }
        if (betAmount > Constants.MAX_BET) {
            revert Errors.BetTooHigh(Constants.MAX_BET, betAmount);
        }

        // Check player has sufficient balance
        uint256 playerBalance = rugsFun.balanceOf(player);
        if (playerBalance < betAmount) {
            revert Errors.InsufficientBalance(playerBalance, betAmount);
        }

        // Validate target multiplier
        if (targetMultiplier < Constants.MIN_MULTIPLIER) {
            revert Errors.InvalidMultiplier(targetMultiplier);
        }

        Trade storage trade = trades[gameId][player];
        
        // Check if player already has active trade
        if (trade.betAmount > 0) revert Errors.PlayerAlreadyInGame(player);

        // Record trade
        trade.player = player;
        trade.betAmount = betAmount;
        trade.buyMultiplier = targetMultiplier;
        trade.sellMultiplier = 0;
        trade.payout = 0;
        trade.settled = false;

        // Add player to game participants
        gamePlayers[gameId].push(player);

        emit BetPlaced(gameId, player, betAmount, targetMultiplier);
    }

    /**
     * @notice Record a player's cashout
     * @param player Address of the player
     * @param cashoutMultiplier Multiplier at cashout time (in basis points)
     * @dev Called by backend when player cashes out
     */
    function recordCashout(
        uint256 gameId,
        address player,
        uint256 cashoutMultiplier
    ) external onlyOperator {
        if (gameId != currentGameId) revert Errors.InvalidGameId(gameId);
        if (!gameActive) revert Errors.GameNotActive();
        
        Trade storage trade = trades[gameId][player];

        if (trade.betAmount == 0) revert Errors.NoActiveTrade(player);
        if (trade.settled) revert Errors.AlreadyCashedOut(player);

        // Validate cashout multiplier
        if (cashoutMultiplier < Constants.MIN_MULTIPLIER) {
            revert Errors.InvalidMultiplier(cashoutMultiplier);
        }

        // Calculate payout (betAmount * multiplier - house edge)
        uint256 grossPayout = Constants.applyMultiplier(trade.betAmount, cashoutMultiplier);
        uint256 houseEdge = Constants.calculateFee(grossPayout, Constants.HOUSE_EDGE_BPS);
        uint256 netPayout = grossPayout - houseEdge;

        trade.sellMultiplier = cashoutMultiplier;
        trade.payout = netPayout;
        trade.settled = true;

        emit CashedOut(gameId, player, cashoutMultiplier, netPayout);
    }

    /**
     * @notice Settle all trades for a completed game
     * @param gameId The game ID to settle
     * @dev Processes all player trades and updates balances
     */
    function settleTrades(
        uint256 gameId,
        address[] calldata players,
        uint256[] calldata payouts
    ) external onlyOperator {
        if (gameId >= currentGameId) revert Errors.InvalidGameId(gameId);
        
        GameResult storage result = gameResults[gameId];
        if (result.gameId == 0) revert Errors.GameResultNotFound();
        if (result.settled) revert Errors.TradesAlreadySettled();

        GameCommit storage commit = gameCommits[gameId];
        if (!commit.revealed) revert Errors.GameNotRevealed();

        if (players.length != payouts.length) {
            revert Errors.ArrayLengthMismatch(players.length, payouts.length);
        }

        uint256 crashMultiplier = commit.crashMultiplier;
        uint256 totalVolume = 0;
        uint256 totalFees = 0;

        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            Trade storage trade = trades[gameId][player];

            if (trade.betAmount == 0) continue;

            totalVolume += trade.betAmount;
            uint256 payout;

            if (trade.settled) {
                // Player cashed out before crash
                payout = trade.payout;
            } else {
                // Player didn't cash out - check if they would have won
                if (trade.buyMultiplier <= crashMultiplier) {
                    // Auto-cashout at target multiplier
                    uint256 grossPayout = Constants.applyMultiplier(trade.betAmount, trade.buyMultiplier);
                    uint256 houseEdge = Constants.calculateFee(grossPayout, Constants.HOUSE_EDGE_BPS);
                    payout = grossPayout - houseEdge;
                    trade.sellMultiplier = trade.buyMultiplier;
                } else {
                    // Lost - crashed before target
                    payout = 0;
                }
                trade.payout = payout;
            }

            // Calculate platform fee and house profit
            if (payout > trade.betAmount) {
                uint256 profit = payout - trade.betAmount;
                uint256 platformFee = Constants.calculateFee(profit, Constants.PLATFORM_FEE_BPS);
                totalFees += platformFee;
                
                // Deduct platform fee from payout
                payout -= platformFee;
            } else if (payout == 0) {
                // Player lost - entire bet goes to fees/house
                uint256 platformFee = Constants.calculateFee(trade.betAmount, Constants.PLATFORM_FEE_BPS);
                totalFees += platformFee;
            }

            // Note: Actual balance updates handled by backend via RugsFun contract
        }

        // Collect fees to treasury
        if (totalFees > 0) {
            treasury.collectFees(totalFees);
        }

        result.totalVolume = totalVolume;
        result.settled = true;

        emit TradesSettled(gameId, players.length, totalVolume, totalFees);
    }

    // ============ View Functions ============

    /**
     * @notice Get game commit data
     * @param gameId The game ID to query
     * @return Game commit data
     */
    function getGameCommit(uint256 gameId) external view returns (GameCommit memory) {
        return gameCommits[gameId];
    }

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
        GameCommit storage commit = gameCommits[gameId];
        
        if (!commit.revealed) return false;
        if (commit.commitHash == bytes32(0)) return false;

        bytes32 computedHash = keccak256(abi.encodePacked(commit.seed, commit.crashMultiplier));
        return computedHash == commit.commitHash;
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
