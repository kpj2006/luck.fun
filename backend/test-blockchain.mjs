// Quick test script for blockchain integration
import pkg from "./dist/lib/contracts.js";
const { 
  getPlayerBalance, 
  processWithdrawal, 
  onChainStartGame, 
  onChainEndGame, 
  onChainSettleTrade, 
  gameManagerContract,
  rugsFunContract,
  rugsTokenContract,
  claimFaucet,
  syncBalance
} = pkg;
import { ethers } from "ethers";
import WebSocket from 'ws';

const testWallet = "0x14c6782a775f504843BD5059F97A329Ac37e17c6";
const SERVER_URL = "ws://localhost:8080";

console.log("🧪 Testing Blockchain Integration\n");

/**
 * Ensures the test wallet has enough in-game balance.
 */
async function ensureBalance(requiredRugs = 10) {
  const inGameBal = await getPlayerBalance(testWallet);
  console.log(`   Current in-game balance: ${inGameBal} RUGS`);

  if (parseFloat(inGameBal) < requiredRugs) {
    console.log(`\n💰 Balance low (< ${requiredRugs}). Checking wallet...`);
    
    const walletWei = await rugsTokenContract.balanceOf(testWallet);
    const walletEth = ethers.formatEther(walletWei);
    console.log(`   Wallet balance: ${walletEth} RUGS`);

    if (parseFloat(walletEth) < 50) {
      console.log("   Wallet balance low, attempting faucet claim...");
      try {
        await claimFaucet(testWallet);
        console.log("   ✅ Faucet claim attempted.");
      } catch (err) {
        console.log("   ℹ️ Faucet claim skipped (likely cooldown).");
      }
    }
    
    console.log("   Depositing 50 RUGS into game...");
    const depositAmount = ethers.parseEther("50");
    
    // 1. Approve
    console.log("   Approving RUGS...");
    const approveTx = await rugsTokenContract.approve(await rugsFunContract.getAddress(), depositAmount);
    await approveTx.wait();
    
    // 2. Deposit
    const depositTx = await rugsFunContract.deposit(depositAmount);
    await depositTx.wait();
    console.log("   ✅ Deposited 50 RUGS into game.");
    await syncBalance(testWallet);
    
    const finalInGame = await getPlayerBalance(testWallet);
    console.log(`   ✅ Final in-game balance: ${finalInGame} RUGS\n`);
  }
}

async function runTests() {
  try {
    // 1. Ensure Balance
    console.log("--- 1. Balance Checks ---");
    await ensureBalance(10);
    
    // 2. Game Lifecycle
    console.log("--- 2. Game Lifecycle ---");
    const gameId = await gameManagerContract.currentGameId();
    const gameActive = await gameManagerContract.gameActive();
    console.log(`   On-chain Current Game ID: ${gameId}`);
    console.log(`   Game Active: ${gameActive}`);

    if (!gameActive) {
        console.log(`   Starting Game ${gameId}...`);
        const startRes = await onChainStartGame(Number(gameId));
        if (startRes.success) console.log(`   ✅ Game Started: ${startRes.txHash}`);
    } else {
        console.log("   (Game already active)");
    }
    
    console.log(`   Ending Game ${gameId} (Crashed at 2.50x)...`);
    const endRes = await onChainEndGame(Number(gameId), 2.5);
    if (endRes.success) console.log(`   ✅ Game Ended: ${endRes.txHash}`);
    
    console.log(`   Settling winning trade (Bet 10, payout 1.8x)...`);
    // Scale 9 decimals (client units)
    const betAmountUnits = "10000000000"; // 10 RUGS in 9-decimal units
    const settleRes = await onChainSettleTrade(Number(gameId), testWallet, betAmountUnits, 1.8);
    if (settleRes.success) console.log(`   ✅ Trade Settled: ${settleRes.txHash}\n`);

    // 3. Withdrawal
    console.log("--- 3. Withdrawal ---");
    const finalBal = await getPlayerBalance(testWallet);
    console.log(`   Final In-game balance: ${finalBal} RUGS`);
    
    if (parseFloat(finalBal) > 1) {
      console.log("   Withdrawing 1 RUGS...");
      const result = await processWithdrawal(testWallet, "1");
      if (result.success) {
        console.log(`   ✅ Withdrawal successful! TX Hash: ${result.txHash}\n`);
      } else {
        console.log(`   ❌ Withdrawal failed: ${result.error}\n`);
      }
    }

    console.log("🎉 All tests complete!");
  } catch (error) {
    console.error("❌ Test Error:", error);
    process.exit(1);
  }
}

async function runLiveTest() {
  // 1. Ensure Balance before joining server
  console.log("--- Pre-Live Check ---");
  await ensureBalance(10);

  console.log(`🔗 Connecting to Live Server at ${SERVER_URL}...`);
  const ws = new WebSocket(SERVER_URL);
  const betAmountRugs = 10;
  let liveGameId = 0;
  let betPlaced = false;
  let cashedOut = false;
  let cashoutMultiplierAt = 0;

  ws.on('open', () => {
    console.log("✅ Connected to Server! Identifying...");
    ws.send(JSON.stringify({ type: 'identify', userId: testWallet }));
    ws.send(JSON.stringify({ type: 'get-balance', userId: testWallet }));
  });

  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'balance') {
      console.log(`💰 Server Balance: ${msg.balance} RUGS`);
    }

    if (msg.type === 'tick') {
      if (msg.gameId !== undefined) liveGameId = msg.gameId;
      
      if (msg.state === 'ACTIVE') {
        // Place bet early
        if (msg.multiplier < 1.05 && !betPlaced) {
          console.log(`🚀 Live Game ${liveGameId} Active! Placing ${betAmountRugs} RUGS Bet...`);
          ws.send(JSON.stringify({
            type: 'buy',
            userId: testWallet,
            buyAmount: betAmountRugs * 1000000000, // 9 decimals
            buy: msg.multiplier
          }));
          betPlaced = true;
        }

        // Cash out at 1.5x
        if (msg.multiplier >= 1.50 && betPlaced && !cashedOut) {
          cashoutMultiplierAt = msg.multiplier;
          console.log(`🎯 Multiplier reached ${cashoutMultiplierAt}x! Sending Cashout for Game ${liveGameId}...`);
          ws.send(JSON.stringify({
            type: 'sell',
            userId: testWallet,
            sell: cashoutMultiplierAt
          }));
          cashedOut = true;
        }
      }

      if (msg.state === 'CRASHED') {
        if (betPlaced) {
          const outcome = cashedOut ? "🟢 WIN" : "🔴 LOSS";
          const amountChange = cashedOut 
            ? (betAmountRugs * (cashoutMultiplierAt - 1)).toFixed(4) 
            : `-${betAmountRugs}`;
            
          console.log(`\n💥 Live Game ${liveGameId} Crashed at ${msg.multiplier}x`);
          console.log(`--- Round Outcome: ${outcome} (${cashedOut ? '+' : ''}${amountChange} RUGS) ---`);
          
          // Small delay to let syncBalance hit
          setTimeout(async () => {
            const finalBal = await getPlayerBalance(testWallet);
            console.log(`📊 Final On-Chain Balance: ${finalBal} RUGS`);
            console.log("Round Complete. Closing...");
            ws.close();
            process.exit(0);
          }, 5000);
        }
        // Reset for next round if we didn't bet
        betPlaced = false;
        cashedOut = false;
      }
    }

    if (msg.type === 'trade-update') {
      if (msg.trades && msg.trades.some(t => t.sell)) {
        console.log(`✅ Trade Settled Success! New Server Balance: ${msg.new_balance}`);
      }
    }

    if (msg.type === 'error') {
      console.error(`❌ Server Error: ${msg.message}`);
    }
  });

  ws.on('error', (err) => {
    console.error("❌ WebSocket Error:", err.message);
    console.log("Make sure you ran 'npm run dev' in another terminal!");
  });
}

if (process.argv.includes('--live')) {
  runLiveTest();
} else {
  runTests();
}
