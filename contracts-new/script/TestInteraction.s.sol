// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {RugsFun} from "../src/core/RugsFun.sol";
import {GameManager} from "../src/core/GameManager.sol";
import {RugsToken} from "../src/token/RugsToken.sol";

/**
 * @title TestInteraction
 * @notice Script to test the full game cycle on Monad Testnet
 */
contract TestInteraction is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address player = vm.addr(deployerPrivateKey);
        
        // Load addresses from .env
        address tokenAddr = vm.envAddress("GAME_TOKEN_ADDRESS");
        address rugsFunAddr = vm.envAddress("RUGS_FUN_ADDRESS");
        address gameManagerAddr = vm.envAddress("GAME_MANAGER_ADDRESS");

        RugsToken token = RugsToken(tokenAddr);
        RugsFun rugsFun = RugsFun(rugsFunAddr);
        GameManager gameManager = GameManager(gameManagerAddr);

        console2.log("=== ACTUAL ON-CHAIN TEST ===");
        console2.log("Player:", player);
        console2.log("RugsFun:", rugsFunAddr);
        console2.log("GameManager:", gameManagerAddr);
        console2.log("");

        // Check initial balances
        console2.log("=== Initial State ===");
        uint256 tokenBalance = token.balanceOf(player);
        uint256 rugsFunBalance = rugsFun.balances(player);
        console2.log("RUGS balance:", tokenBalance);
        console2.log("In-game balance:", rugsFunBalance);
        console2.log("");

        uint256 depositAmount = 50 * 10**18; // 50 RUGS

        vm.startBroadcast(deployerPrivateKey);

        // 1. Faucet (if needed)
        if (tokenBalance < depositAmount) {
            console2.log("Balance low, claiming from faucet...");
            token.claimFaucet();
            console2.log("Claimed 1,000 RUGS");
        }

        // 2. Deposit
        console2.log("=== Step 1: Deposit ===");
        token.approve(address(rugsFun), depositAmount);
        rugsFun.deposit(depositAmount);
        console2.log("Deposited 50 RUGS");

        // 3. Start Game
        console2.log("=== Step 2: Start Game ===");
        uint256 gameId = gameManager.getCurrentGameId();
        gameManager.startGame(gameId);
        console2.log("Game ID", gameId, "Started");

        // 4. End Game (Crash at 2.50x)
        console2.log("=== Step 3: End Game ===");
        gameManager.endGame(gameId, 250); // 2.50x
        console2.log("Game", gameId, "Crashed at 2.50x");

        // 5. Settle Winning Trade
        // Bet 10, Cashed out at 1.80x
        console2.log("=== Step 4: Settle Trade ===");
        uint256 betAmount = 10 * 10**18;
        gameManager.settleTrade(gameId, player, betAmount, 180);
        console2.log("Trade settled at 1.80x");

        // Final State
        console2.log("");
        console2.log("=== Final State ===");
        uint256 finalTokenBal = token.balanceOf(player);
        uint256 finalGameBal = rugsFun.balances(player);
        console2.log("RUGS balance:", finalTokenBal);
        console2.log("In-game balance:", finalGameBal);

        vm.stopBroadcast();
        console2.log("=== TEST COMPLETE ===");
    }
}
