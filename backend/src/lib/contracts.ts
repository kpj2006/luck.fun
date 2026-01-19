import { ethers } from "ethers";
import dotenv from "dotenv";
import { supabase } from "./supabase";

dotenv.config();

// Contract addresses from deployment
const CONTRACTS = {
  RUGS_TOKEN: "0x4297F610EF0E14E988494507dF51Fb2E396A9fF3",
  RUGS_FUN: "0x64a1ab8072B0b912124739c150d5cD309B1797E1",
  GAME_MANAGER: "0x8ed4C9D0DEB8e74d770712437d7731CA1975039e",
  TREASURY: "0xe576A8Cdd8D805C780244D93d792564fDCf1A8a1",
};

// ABIs for contracts
const RUGS_FUN_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function balances(address user) external view returns (uint256)",
  "function gameToken() external view returns (address)",
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
  process.env.RPC_URL || "https://testnet-rpc.monad.xyz",
  {
    chainId: Number(process.env.CHAIN_ID) || 10143,
    name: "monad-testnet",
    ensAddress: null as any, // Force-disable ENS for ethers v6
  },
  { 
    staticNetwork: true,
    batchMaxCount: 1,
    pollingInterval: 6000,
  }
);

// Resilient request helper
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`⚠️ RPC lagging, retrying (${i + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Failed after retries");
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
export async function syncBalance(walletAddress: string): Promise<string> {
  if (!ethers.isAddress(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }
  return await withRetry(async () => {
    const rawBalance = await rugsFunContract.balances(walletAddress);
    const balanceEth = ethers.formatEther(rawBalance);

    // Update Supabase users_rugsfun table
    const { error } = await supabase
      .from("users_rugsfun")
      .upsert({
        wallet_address: walletAddress,
        balance: parseFloat(balanceEth)
      }, { onConflict: 'wallet_address' });

    if (error) {
      console.error("Error syncing balance to Supabase:", error);
    } else {
      console.log(`Synced balance for ${walletAddress}: ${balanceEth} RUGS`);
    }

    return balanceEth;
  });
}

export async function getPlayerBalance(walletAddress: string): Promise<string> {
  if (!ethers.isAddress(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }
  return await withRetry(async () => {
    // Read from contract directly for most up-to-date value
    const balance = await rugsFunContract.balances(walletAddress);
    return ethers.formatEther(balance);
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
    const receipt = await tx.wait();

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
    const receipt = await tx.wait();
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
    const receipt = await tx.wait();
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
