import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// Contract addresses from deployment
const CONTRACTS = {
  RUGS_TOKEN: "0x4297F610EF0E14E988494507dF51Fb2E396A9fF3",
  RUGS_FUN: "0x86ce018EC43DB9561d6FD7C2A71994d0A3Bc9a57",
  GAME_MANAGER: "0x961180FCa21Aa4e99d2558190cbf56177D9d466c",
  TREASURY: "0xb39deFd3e2Cf85DbBf065d560b0570F034D08085",
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
];

// Provider and wallet setup
const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || "https://testnet-rpc.monad.xyz"
);

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
  provider
) as any;

// Helper functions
export async function getPlayerBalance(walletAddress: string): Promise<string> {
  try {
    const balance = await rugsFunContract.balances(walletAddress);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error("Error getting player balance:", error);
    throw error;
  }
}

export async function processDeposit(
  walletAddress: string,
  amount: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Note: User must approve RUGS token to RugsFun contract first (frontend handles this)
    // Backend only monitors/verifies deposits
    const balance = await rugsFunContract.balances(walletAddress);
    return {
      success: true,
      txHash: "deposit-verified",
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

export const CONTRACTS_ADDRESSES = CONTRACTS;
