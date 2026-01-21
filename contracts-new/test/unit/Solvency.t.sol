// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {RugsFun} from "../../src/core/RugsFun.sol";
import {GameManager} from "../../src/core/GameManager.sol";
import {Treasury} from "../../src/core/Treasury.sol";
import {RugsToken} from "../../src/token/RugsToken.sol";
import {Errors} from "../../src/utils/Errors.sol";
import {Constants} from "../../src/utils/Constants.sol";

contract SolvencyTest is Test {
    RugsFun public rugsFun;
    GameManager public gameManager;
    Treasury public treasury;
    RugsToken public token;

    address public owner = address(0x1);
    address public operator = address(0x2);
    address public player1 = address(0x3);
    address public player2 = address(0x4);

    function setUp() public {
        vm.startPrank(owner);
        token = new RugsToken(owner);
        treasury = new Treasury(address(token), owner, owner);
        rugsFun = new RugsFun(address(token), address(treasury), owner);
        gameManager = new GameManager(address(rugsFun), address(treasury), operator, owner);

        rugsFun.setGameManager(address(gameManager));
        rugsFun.setOperator(operator);
        treasury.setFeeCollector(address(gameManager));
        vm.stopPrank();

        // Fund players
        vm.prank(player1);
        token.claimFaucet();
        vm.prank(player2);
        token.claimFaucet();

        // 3. Fund House Liquidity
        vm.prank(owner);
        token.claimFaucet(); // Get 1k
        vm.prank(owner);
        token.transfer(address(rugsFun), 1000 ether);
        // Note: totalUserBalances remains 0, as this is surplus.

        vm.prank(player1);
        token.approve(address(rugsFun), type(uint256).max);
        vm.prank(player2);
        token.approve(address(rugsFun), type(uint256).max);
    }

    function test_Solvency_Invariant_Holds() public {
        // 1. Initial State
        assertEq(rugsFun.totalUserBalances(), 0);
        assertEq(token.balanceOf(address(rugsFun)), 1000 ether);

        // 2. Deposits
        vm.prank(player1);
        rugsFun.deposit(100 ether);
        vm.prank(player2);
        rugsFun.deposit(100 ether);

        assertEq(rugsFun.totalUserBalances(), 200 ether);
        assertEq(token.balanceOf(address(rugsFun)), 1200 ether);


       // 3. Game Settlement - Player 1 Solvency
        vm.startPrank(operator);
        uint256 gameId = gameManager.getCurrentGameId();
        gameManager.startGame(gameId);
        gameManager.endGame(gameId, 200); // 2.00x crash

        // Player 1 Wins (1.50x)
        // Bet: 10 ether. 
        // We now check if totalUserBalances increases correctly to reflect payout liability.
        uint256 balanceBefore = rugsFun.totalUserBalances();
        gameManager.settleTrade(gameId, player1, 10 ether, 150);
        uint256 balanceAfter = rugsFun.totalUserBalances();
        
        // Payout logic in GameManager settled net profit.
        // For 1.50x on 10 ether:
        // Gross: 15.0
        // Fees: ~0.347
        // Net win credited to balances[user]: 4.653
        
        assertEq(balanceAfter, balanceBefore + 4.653 ether);
        assertTrue(token.balanceOf(address(rugsFun)) >= rugsFun.totalUserBalances(), "Insolvent after win");

        // 4. Player 2 Loses
        // Bet: 20 ether. Crashed.
        // Result: balances[user] -= 20. totalUserBalances -= 20.
        // Tokens remain in contract (House surplus).
        
        uint256 liabilitiesBeforeLoss = rugsFun.totalUserBalances();
        uint256 assetsBeforeLoss = token.balanceOf(address(rugsFun));
        
        gameManager.settleTrade(gameId, player2, 20 ether, 0); // Full Loss
        
        uint256 liabilitiesAfterLoss = rugsFun.totalUserBalances();
        uint256 assetsAfterLoss = token.balanceOf(address(rugsFun));
        
        assertEq(liabilitiesAfterLoss, liabilitiesBeforeLoss - 20 ether);
        assertEq(assetsAfterLoss, assetsBeforeLoss); // Assets don't move on loss anymore!
        assertTrue(assetsAfterLoss > liabilitiesAfterLoss, "Should have surplus after loss");
        
        // 5. Sweep Surplus
        uint256 surplus = assetsAfterLoss - liabilitiesAfterLoss;
        uint256 treasuryBefore = token.balanceOf(address(treasury));
        
        rugsFun.sweepSurplus();
        
        assertEq(token.balanceOf(address(treasury)), treasuryBefore + surplus);
        assertEq(token.balanceOf(address(rugsFun)), liabilitiesAfterLoss);
        assertEq(rugsFun.totalUserBalances(), liabilitiesAfterLoss);
        vm.stopPrank();
    }

    function test_Sweep_Fails_If_No_Surplus() public {
        // Initial surplus is 1000.
        vm.prank(operator);
        rugsFun.sweepSurplus(); 

        vm.prank(player1);
        rugsFun.deposit(100 ether);
        
        // Liabilities = 100, Assets = 100. Surplus = 0.
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.InsufficientBalance.selector, 100 ether, 100 ether));
        rugsFun.sweepSurplus();
    }

    function test_Sweep_Gated_By_Operator() public {
        vm.prank(player2);
        rugsFun.deposit(50 ether);
        
        vm.startPrank(operator);
        uint256 gameId = gameManager.getCurrentGameId();
        gameManager.startGame(gameId);
        gameManager.endGame(gameId, 100);
        gameManager.settleTrade(gameId, player2, 10 ether, 0); // Surplus of 10
        vm.stopPrank();

        // Unauthorized user attempts sweep
        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSelector(Errors.Unauthorized.selector, player1));
        rugsFun.sweepSurplus();
    }
}
