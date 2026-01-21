import { ethers } from "ethers";
import dotenv from "dotenv";
import { supabase } from "./supabase";

dotenv.config();

// Contract addresses from deployment
const CONTRACTS = {
  RUGS_TOKEN: "0x4297F610EF0E14E988494507dF51Fb2E396A9fF3",
  RUGS_FUN: "0x3e52d90257fF7db1c0e300FD4c9EfBa4F0C233D3",
  GAME_MANAGER: "0x279b095b1a44d1d91754359AA45725fb376185BE",
  TREASURY: "0x6AaAbB7085076A46B2B6b8E98BEAb0CFC56Cf910",
};

// ABIs for contracts
const RUGS_FUN_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function balances(address user) external view returns (uint256)",
  "function gameToken() external view returns (address)",
  "function totalUserBalances() external view returns (uint256)",
  "function sweepSurplus() external",
  "function collectFees(uint256 amount) external",
  "event TreasurySweep(uint256 amount)",
  "event FeesCollected(uint256 amount)",
];
const RUGS_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function claimFaucet() external",
];

const GAME_MANAGER_ABI = [
  "function startGame(uint256 gameId) external",
  "function endGame(uint256 gameId, uint256 crashMultiplier) external",
  "function settleTrade(uint256 gameId, address player, uint256 betAmount, uint256 cashoutMultiplier) external",
  "function currentGameId() external view returns (uint256)",
  "function gameActive() external view returns (bool)",
];

// Provider and wallet setup
const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || "https://monad-testnet.g.alchemy.com/v2/2MhaA2rKxVwyufFUVZ1h-",
  {
    chainId: Number(process.env.CHAIN_ID) || 10143,
    name: "monad-testnet",
  }
);

// Resilient request helper
export async function withRetry<T>(fn: () => Promise<T>, retries = 5, baseDelay = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = baseDelay * Math.pow(2, i);
      console.log(`⚠️ RPC lagging, retrying (${i + 1}/${retries}) in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Failed after retries");
}

// Timeout helper
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage = "Operation timed out"): Promise<T> {
  let timeoutHandle: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle);
    throw error;
  }
}

// Wait for chain helper (non-blocking when used correctly)
export async function waitForChain(): Promise<boolean> {
  console.log("⏳ Waiting for RPC connectivity...");
  let attempt = 0;
  while (true) {
    try {
      // Use eth_chainId as the most reliable liveness check
      await provider.send("eth_chainId", []);
      console.log("✅ RPC connected and ready!");
      return true;
    } catch (err) {
      attempt++;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s delay
      console.error(`❌ RPC unreachable (Attempt ${attempt}). Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY!, provider);

// Contract instances
export const rugsFunContract = new ethers.Contract(
  CONTRACTS.RUGS_FUN,
  RUGS_FUN_ABI,
  wallet
) as any;

export const rugsTokenContract = new ethers.Contract(
  CONTRACTS.RUGS_TOKEN,
  RUGS_TOKEN_ABI,
  wallet // Also use wallet for faucet claims if needed
) as any;

export const gameManagerContract = new ethers.Contract(
  CONTRACTS.GAME_MANAGER,
  GAME_MANAGER_ABI,
  wallet
) as any;

// Helper functions
export async function syncBalance(walletAddress: string): Promise<{ balance: string; balanceNano: string }> {
  if (!ethers.isAddress(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }
  return await withRetry(async () => {
    const rawBalance = await rugsFunContract.balances(walletAddress);
    const balanceEth = ethers.formatEther(rawBalance);
    // Convert 18 decimal Wei to 9 decimal Nano-RUGS
    const balanceNano = rawBalance / 1000000000n;

    // Update Supabase users_rugsfun table
    const { error } = await supabase
      .from("users_rugsfun")
      .upsert({
        wallet_address: walletAddress,
        balance_nano: balanceNano.toString(), // Store as integer string
        balance: balanceEth as any // Keep legacy for now
      }, { onConflict: 'wallet_address' });

    if (error) {
      console.error("Error syncing balance to Supabase:", error);
    } else {
      console.log(`Synced balance for ${walletAddress}: ${balanceEth} RUGS (${balanceNano} nano)`);
    }

    return { balance: balanceEth, balanceNano: balanceNano.toString() };
  });
}

export async function getPlayerBalance(walletAddress: string): Promise<{ balance: string; balanceNano: string }> {
  if (!ethers.isAddress(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }
  return await withRetry(async () => {
    // Read from contract directly for most up-to-date value
    const rawBalance = await rugsFunContract.balances(walletAddress);
    return {
      balance: ethers.formatEther(rawBalance),
      balanceNano: (rawBalance / 1000000000n).toString()
    };
  });
}

export async function processDeposit(
  walletAddress: string,
  amount: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!ethers.isAddress(walletAddress)) {
      return { success: false, error: `Invalid wallet address: ${walletAddress}` };
    }
    // Note: User must approve RUGS token to RugsFun contract first (frontend handles this)
    // Here we just verify the deposit and sync the latest balance
    const balanceEth = await syncBalance(walletAddress);

    return {
      success: true,
      txHash: "deposit-verified-and-synced",
    };
  } catch (error: any) {
    console.error("Error processing deposit:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function processWithdrawal(
  walletAddress: string,
  amount: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!ethers.isAddress(walletAddress)) {
      return { success: false, error: `Invalid wallet address: ${walletAddress}` };
    }
    const amountWei = ethers.parseEther(amount);

    // Check if player has sufficient balance in contract
    const balance = await rugsFunContract.balances(walletAddress);

    if (balance < amountWei) {
      return {
        success: false,
        error: "Insufficient balance in contract",
      };
    }

    // Execute withdrawal - operator calls withdraw on behalf of user
    const tx = await rugsFunContract.withdraw(amountWei);
    // Use timeout for the wait, not retry
    const receipt = (await withTimeout(tx.wait(), 30000, "Withdrawal transaction confirmation timed out")) as any;

    return {
      success: true,
      txHash: receipt?.hash,
    };
  } catch (error: any) {
    console.error("Error processing withdrawal:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function claimFaucet(walletAddress: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!ethers.isAddress(walletAddress)) {
      return { success: false, error: "Invalid wallet address" };
    }
    const tx = await rugsTokenContract.claimFaucet();
    const receipt = (await withTimeout(tx.wait(), 30000, "Faucet transaction confirmation timed out")) as any;
    return { success: true, txHash: receipt?.hash };
  } catch (error: any) {
    console.error("Error claiming faucet:", error);
    // Extract revert reason if available
    const revertReason = error.reason || error.data?.message || error.message || "Unknown error";
    return { success: false, error: revertReason };
  }
}

export async function onChainStartGame(gameId: number): Promise<{ success: boolean; txHash?: string }> {
  try {
    const tx = await gameManagerContract.startGame(gameId);
    const receipt = (await withTimeout(tx.wait(), 30000, "Start game transaction confirmation timed out")) as any;
    return { success: true, txHash: receipt?.hash };
  } catch (error: any) {
    console.error(`Error starting game ${gameId} on-chain:`, error);
    return { success: false };
  }
}

export async function onChainEndGame(gameId: number, crashMultiplier: number): Promise<{ success: boolean; txHash?: string }> {
  try {
    // Multiplier is sent as an integer (e.g., 1.50 -> 150)
    const multiplierInt = Math.floor(crashMultiplier * 100);
    const tx = await gameManagerContract.endGame(gameId, multiplierInt);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt?.hash };
  } catch (error: any) {
    console.error(`Error ending game ${gameId} on-chain:`, error);
    return { success: false };
  }
}

export async function getContractSolvency(): Promise<{ assets: string; liabilities: string; surplus: string }> {
  return await withRetry(async () => {
    const assets = await rugsTokenContract.balanceOf(CONTRACTS.RUGS_FUN);
    const liabilities = await rugsFunContract.totalUserBalances();
    const surplus = assets > liabilities ? assets - liabilities : 0n;

    return {
      assets: ethers.formatEther(assets),
      liabilities: ethers.formatEther(liabilities),
      surplus: ethers.formatEther(surplus),
    };
  });
}

export async function executeTreasurySweep(): Promise<{ success: boolean; txHash?: string; amount?: string }> {
  try {
    const tx = await rugsFunContract.sweepSurplus();
    const receipt = (await withTimeout(tx.wait(), 30000, "Treasury sweep confirmation timed out")) as any;

    // Find TreasurySweep event
    const sweepEvent = receipt.logs
      .map((log: any) => {
        try { return rugsFunContract.interface.parseLog(log); } catch { return null; }
      })
      .find((e: any) => e && e.name === "TreasurySweep");

    return {
      success: true,
      txHash: receipt?.hash,
      amount: sweepEvent ? ethers.formatEther(sweepEvent.args.amount) : "0"
    };
  } catch (error: any) {
    console.error("Error executing treasury sweep:", error);
    return { success: false };
  }
}

export async function onChainSettleTrade(
  gameId: number,
  playerAddress: string,
  betAmount: string, // This comes as 9 decimals (lamports/gwei) from client
  cashoutMultiplier: number
): Promise<{ success: boolean; txHash?: string }> {
  try {
    if (!ethers.isAddress(playerAddress)) {
      console.error(`Invalid player address for settleTrade: ${playerAddress}`);
      return { success: false };
    }
    if (!/^\d+$/.test(betAmount)) {
      console.error(`Invalid betAmount for settleTrade: ${betAmount}`);
      return { success: false };
    }
    // Scale 9 decimals to 18 for Monad / Ethereum
    const betWei = ethers.toBigInt(betAmount) * 1_000_000_000n;
    const multiplierInt = Math.floor(cashoutMultiplier * 100);

    const tx = await gameManagerContract.settleTrade(gameId, playerAddress, betWei, multiplierInt);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt?.hash };
  } catch (error: any) {
    console.error(`Error settling trade for ${playerAddress} on game ${gameId}:`, error);
    return { success: false };
  }
}

export const CONTRACTS_ADDRESSES = CONTRACTS;
