// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGameManager
 * @notice Interface for game state and provably fair logic
 * @dev Handles commit-reveal, game history, and settlement coordination
 */
interface IGameManager {
    // ============ Structs ============
    
    /// @notice Game result data
    struct GameResult {
        uint256 gameId;          // Unique game identifier
        uint256 startTime;       // When game started
        uint256 endTime;         // When game crashed
        uint256 crashMultiplier; // Final crash multiplier
        uint256 totalVolume;     // Total bet volume
        uint256 playerCount;     // Number of players
        bool settled;            // Whether payouts are settled
    }
    
    /// @notice Player trade data
    struct Trade {
        address player;          // Player address
        uint256 betAmount;       // Amount bet
        uint256 buyMultiplier;   // Multiplier when bought in
        uint256 sellMultiplier;  // Multiplier when cashed out (0 if crashed)
        uint256 payout;          // Final payout amount
        bool settled;            // Whether payout is settled
    }

    // ============ Events ============
    
    /// @notice Emitted when a game starts
    /// @param gameId Game identifier
    /// @param startTime Start timestamp
    event GameStarted(uint256 indexed gameId, uint256 startTime);
    
    /// @notice Emitted when a game ends
    /// @param gameId Game identifier
    /// @param crashMultiplier Final crash multiplier
    /// @param totalVolume Total bet volume
    /// @param playerCount Number of players
    event GameEnded(
        uint256 indexed gameId,
        uint256 crashMultiplier,
        uint256 totalVolume,
        uint256 playerCount
    );
    
    /// @notice Emitted when a player places a bet
    /// @param gameId Game identifier
    /// @param player Player address
    /// @param amount Bet amount
    /// @param multiplier Current multiplier
    event BetPlaced(
        uint256 indexed gameId,
        address indexed player,
        uint256 amount,
        uint256 multiplier
    );
    
    /// @notice Emitted when a player cashes out
    /// @param gameId Game identifier
    /// @param player Player address
    /// @param multiplier Cashout multiplier
    /// @param payout Payout amount
    event CashedOut(
        uint256 indexed gameId,
        address indexed player,
        uint256 multiplier,
        uint256 payout
    );
    
    /// @notice Emitted when trades are settled
    /// @param gameId Game identifier
    /// @param settledCount Number of trades settled
    /// @param totalVolume Total volume traded
    /// @param totalFees Total fees collected
    event TradesSettled(
        uint256 indexed gameId,
        uint256 settledCount,
        uint256 totalVolume,
        uint256 totalFees
    );

    /// @notice Emitted when operator is updated
    /// @param oldOperator Previous operator
    /// @param newOperator New operator
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);

    /// @notice Emitted when treasury is updated
    /// @param oldTreasury Previous treasury
    /// @param newTreasury New treasury
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Emitted when game is cancelled
    /// @param gameId Game identifier
    /// @param cancelledBy Address that cancelled
    /// @param timestamp Cancellation timestamp
    event GameCancelled(uint256 indexed gameId, address indexed cancelledBy, uint256 timestamp);

    // ============ Operator Functions ============
    
    /// @notice Start a game (trust-based)
    /// @param gameId Game identifier
    function startGame(uint256 gameId) external;
    
    /// @notice End a game and set the crash point
    /// @param gameId Game identifier
    /// @param crashMultiplier Crash multiplier
    function endGame(uint256 gameId, uint256 crashMultiplier) external;
    
    /// @notice Settle a single trade for a player
    /// @param gameId Game identifier
    /// @param player Player address
    /// @param betAmount Bet amount
    /// @param cashoutMultiplier Multiplier at cashout (0 if lost)
    function settleTrade(
        uint256 gameId,
        address player,
        uint256 betAmount,
        uint256 cashoutMultiplier
    ) external;

    // ============ View Functions ============
    

    
    /// @notice Get game result data
    /// @param gameId Game identifier
    /// @return GameResult struct
    function getGameResult(uint256 gameId) external view returns (GameResult memory);
    
    /// @notice Get player's trade for a game
    /// @param gameId Game identifier
    /// @param player Player address
    /// @return Trade struct
    function getTrade(uint256 gameId, address player) external view returns (Trade memory);
    
    /// @notice Verify a game's fairness
    /// @param gameId Game identifier
    /// @return isValid True if commit/reveal match
    function verifyGame(uint256 gameId) external view returns (bool isValid);
    
    /// @notice Get recent game history
    /// @param count Number of recent games to retrieve
    /// @return Array of GameResult structs
    function getRecentGames(uint256 count) external view returns (GameResult[] memory);
    
    /// @notice Get current active game ID
    /// @return gameId Current game identifier (or 0 if none active)
    function getCurrentGameId() external view returns (uint256 gameId);
}
