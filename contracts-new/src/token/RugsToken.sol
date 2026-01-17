// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RugsToken
 * @notice Official game token for rugs.fun
 * @dev Features:
 *  - Owner minting for rewards/events
 *  - Public faucet with daily limits (testnet)
 *  - Pausable faucet for mainnet
 *  - Max supply cap
 */
contract RugsToken is ERC20, Ownable {
    // ============ Constants ============

    /// @notice Maximum total supply (100M tokens)
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;

    /// @notice Faucet amount per claim (1,000 tokens)
    uint256 public constant FAUCET_AMOUNT = 1_000 * 10**18;

    /// @notice Faucet cooldown period (24 hours)
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    // ============ State Variables ============

    /// @notice Whether the faucet is enabled
    bool public faucetEnabled;

    /// @notice Last faucet claim timestamp per user
    mapping(address => uint256) public lastFaucetClaim;

    // ============ Events ============

    event FaucetClaimed(address indexed user, uint256 amount);
    event FaucetToggled(bool enabled);

    // ============ Errors ============

    error MaxSupplyExceeded();
    error FaucetDisabled();
    error FaucetCooldownActive(uint256 timeRemaining);

    // ============ Constructor ============

    constructor(address initialOwner) ERC20("Rugs Fun Token", "RUGS") Ownable(initialOwner) {
        faucetEnabled = true;
        
        // Mint initial supply to owner (10M for liquidity/distribution)
        _mint(initialOwner, 10_000_000 * 10**18);
    }

    // ============ Owner Functions ============

    /**
     * @notice Mint tokens (owner only)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        _mint(to, amount);
    }

    /**
     * @notice Toggle faucet on/off
     * @param enabled New faucet state
     */
    function setFaucetEnabled(bool enabled) external onlyOwner {
        faucetEnabled = enabled;
        emit FaucetToggled(enabled);
    }

    // ============ Public Functions ============

    /**
     * @notice Claim tokens from faucet
     * @dev Can be called once per 24 hours per address
     */
    function claimFaucet() external {
        if (!faucetEnabled) revert FaucetDisabled();

        uint256 lastClaim = lastFaucetClaim[msg.sender];
        if (lastClaim != 0) {
            uint256 timeSinceLastClaim = block.timestamp - lastClaim;
            if (timeSinceLastClaim < FAUCET_COOLDOWN) {
                revert FaucetCooldownActive(FAUCET_COOLDOWN - timeSinceLastClaim);
            }
        }

        if (totalSupply() + FAUCET_AMOUNT > MAX_SUPPLY) revert MaxSupplyExceeded();

        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);

        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    /**
     * @notice Get time until user can claim from faucet again
     * @param user Address to check
     * @return seconds until next claim (0 if can claim now)
     */
    function timeUntilNextClaim(address user) external view returns (uint256) {
        uint256 lastClaim = lastFaucetClaim[user];
        if (lastClaim == 0) return 0;

        uint256 timeSinceLastClaim = block.timestamp - lastClaim;
        if (timeSinceLastClaim >= FAUCET_COOLDOWN) return 0;

        return FAUCET_COOLDOWN - timeSinceLastClaim;
    }
}
