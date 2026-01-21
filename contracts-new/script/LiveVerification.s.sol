// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {RugsFun} from "../src/core/RugsFun.sol";
import {GameManager} from "../src/core/GameManager.sol";
import {RugsToken} from "../src/token/RugsToken.sol";

/**
 * @title LiveVerification
 * @notice Script to test actual on-chain game cycle on testnet
 */
contract LiveVerification is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address player = vm.addr(deployerPrivateKey);
        
        // Addresses (Set these after deployment)
        address rugsFunAddr = vm.envAddress("RUGS_FUN_ADDRESS");
        address gameManagerAddr = vm.envAddress("GAME_MANAGER_ADDRESS");
        address tokenAddr = vm.envAddress("GAME_TOKEN_ADDRESS");

        RugsToken token = RugsToken(tokenAddr);
        RugsFun rugsFun = RugsFun(rugsFunAddr);
        GameManager gameManager = GameManager(gameManagerAddr);

        vm.startBroadcast(deployerPrivateKey);

        console2.log("=== Starting Live Verification ===");
        console2.log("Player:", player);
        console2.log("Token Balance:", token.balanceOf(player));

        // 1. Claim from Faucet ONLY if balance is low
        uint256 depositAmount = 100 * 10**18;
        if (token.balanceOf(player) < depositAmount) {
            console2.log("Balance low, attempting faucet claim...");
            try token.claimFaucet() {
                console2.log("1. Claimed 1,000 RUGS from Faucet");
            } catch {
                console2.log("1. Faucet claim failed/cooldown. Procceding anyway if balance exists.");
            }
        } else {
            console2.log("1. Skipping faucet claim (sufficient balance)");
        }

        // 2. Deposit into Game
        if (token.balanceOf(player) >= depositAmount) {
            token.approve(address(rugsFun), depositAmount);
            rugsFun.deposit(depositAmount);
            console2.log("2. Deposited 100 RUGS into RugsFun");
        }

        // 3. Start Game
        uint256 gameId = gameManager.getCurrentGameId();
        gameManager.startGame(gameId);
        console2.log("3. Started Game ID:", gameId);

        // 4. End Game (Crashed at 2.0x)
        gameManager.endGame(gameId, 200);
        console2.log("4. Ended Game (2.0x Crash)");

        // 5. Settle a Winning Trade
        // Bet 10, Cashed out at 1.5x
        uint256 bet = 10 * 10**18;
        gameManager.settleTrade(gameId, player, bet, 150);
        console2.log("5. Settled winning trade (1.5x)");

        uint256 finalBal = rugsFun.balanceOf(player);
        console2.log("Final balance in-game:", finalBal);
        
        vm.stopBroadcast();
        console2.log("=== Live Verification Complete ===");
    }
}
