// Quick test script for blockchain integration
import { getPlayerBalance, processWithdrawal } from "./dist/lib/contracts.js";

const testWallet = "0x14c6782a775f504843BD5059F97A329Ac37e17c6";

console.log("🧪 Testing Blockchain Integration\n");

// Test 1: Get Balance
console.log("Test 1: Getting player balance from contract...");
getPlayerBalance(testWallet)
  .then((balance) => {
    console.log(`✅ Balance: ${balance} RUGS\n`);

    // Test 2: Process Withdrawal (only if balance > 0)
    if (parseFloat(balance) > 0) {
      console.log("Test 2: Processing withdrawal (0.1 RUGS)...");
      return processWithdrawal(testWallet, "0.1");
    } else {
      console.log("⚠️  Skipping withdrawal test - zero balance\n");
      return null;
    }
  })
  .then((result) => {
    if (result) {
      if (result.success) {
        console.log(`✅ Withdrawal successful!`);
        console.log(`   TX Hash: ${result.txHash}\n`);
      } else {
        console.log(`❌ Withdrawal failed: ${result.error}\n`);
      }
    }

    // Test 3: Verify new balance
    console.log("Test 3: Verifying balance after withdrawal...");
    return getPlayerBalance(testWallet);
  })
  .then((newBalance) => {
    if (newBalance) {
      console.log(`✅ New Balance: ${newBalance} RUGS\n`);
    }
    console.log("🎉 All tests complete!");
  })
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });
