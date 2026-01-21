// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {GameManager} from "../../src/core/GameManager.sol";
import {RugsFun} from "../../src/core/RugsFun.sol";
import {Treasury} from "../../src/core/Treasury.sol";
import {RugsToken} from "../../src/token/RugsToken.sol";

contract GameManagerTest is Test {
    GameManager public gameManager;
    RugsFun public rugsFun;
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
        treasury.setFeeCollector(address(gameManager));
        vm.stopPrank();

        // Use Faucet to fund players
        vm.prank(player1);
        token.claimFaucet();
        
        vm.prank(player2);
        token.claimFaucet();

        vm.prank(player1);
        token.approve(address(rugsFun), type(uint256).max);
        
        vm.prank(player2);
        token.approve(address(rugsFun), type(uint256).max);
        
        // Deposit
        vm.prank(player1);
        rugsFun.deposit(100 ether);
        
        vm.prank(player2);
        rugsFun.deposit(100 ether);
    }

    function test_GameLifecycle_Integration() public {
        vm.startPrank(operator);
        
        uint256 gameId = gameManager.getCurrentGameId();
        
        // 1. Start Game
        gameManager.startGame(gameId);
        assertEq(gameManager.isGameActive(), true);

        // 2. End Game (Crash at 2.00x)
        gameManager.endGame(gameId, 200); 
        assertEq(gameManager.isGameActive(), false);
        
        // 3. Settle Player 1 (WON)
        // Bet: 10 ETH
        // Cashout: 1.50x
        // Profit (before fees): 5 ETH
        // Fees: 2% house + 1% platform = 3% of 10 ETH = 0.3 ETH
        // Net profit expected: 5 - 0.3 = 4.7 ETH
        uint256 betAmount = 10 ether;
        uint256 cashout = 150;
        
        uint256 initialBal = rugsFun.balanceOf(player1);
        uint256 initialTreasuryBal = token.balanceOf(address(treasury));
        
        uint256 initialLiabilities = rugsFun.totalUserBalances();
        gameManager.settleTrade(gameId, player1, betAmount, cashout);
        
        uint256 finalBal = rugsFun.balanceOf(player1);
        uint256 finalTreasuryBal = token.balanceOf(address(treasury));
        uint256 finalAssets = token.balanceOf(address(rugsFun));
        
        // 1. Check Player 1 Balance
        // Gross: 15.0
        // House Edge (2% of gross): 0.3
        // Result: 14.7
        // Platform Fee (1% of 4.7 profit): 0.047
        // Final Net: 14.653
        // Initial 100 + 4.653 = 104.653
        assertEq(finalBal, initialBal + 4.653 ether);
        
        // 2. Check Treasury: Should be EMPTY (Fees stay in RugsFun as surplus)
        assertEq(finalTreasuryBal, initialTreasuryBal);
        
        // 3. User 2 Loses 10 RUGS
        gameManager.settleTrade(gameId, player2, 10 ether, 0);
        
        // Final Solvency Check
        // Total Liabilities: (Player1: 104.653) + (Player2: 90.0) = 194.653
        // Total Assets in Contract: (Initial: 200) = 200
        // Expected Surplus: 200 - 194.653 = 5.347
        // (This 5.347 is: 0.347 from Win Fees + 5.0 from Player 2's direct loss surplus... wait)
        // Wait, Player 2 lost 10. Initial was 100. Balance is 90.
        // So surplus is 5.347 (Player 1 fees) + 10.0 (Player 2 Loss) = 15.347?
        // Let's verify.
        
        uint256 totalLiabilities = rugsFun.totalUserBalances();
        uint256 totalAssets = token.balanceOf(address(rugsFun));
        uint256 surplus = totalAssets - totalLiabilities;
        
        // Sweeping Surplus
        vm.stopPrank(); // Stop operator prank
        vm.prank(owner);
        rugsFun.setOperator(owner);
        vm.prank(owner);
        rugsFun.sweepSurplus();
        
        assertEq(token.balanceOf(address(treasury)), initialTreasuryBal + surplus);
        assertEq(token.balanceOf(address(rugsFun)), totalLiabilities);
        
        vm.stopPrank();

        // 5. Test Withdrawal of Winnings
        // Player 1 has 104.653 ETH. Withdraw 4.653 ETH.
        vm.startPrank(player1);
        uint256 walletBefore = token.balanceOf(player1);
        
        rugsFun.withdraw(4.653 ether);
        
        uint256 walletAfter = token.balanceOf(player1);
        assertEq(walletAfter, walletBefore + 4.653 ether);
        assertEq(rugsFun.balanceOf(player1), 100 ether);
        vm.stopPrank();
    }

    function test_Unauthorized_Settlement() public {
        // Only operator/owner should be able to settle
        vm.prank(player1);
        vm.expectRevert();
        gameManager.settleTrade(1, player1, 1 ether, 200);
    }
}
