import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  parseEther,
} from "ethers";
import { CHAIN_ID, CONTRACTS, RPC_URL } from "@/constants/constants";

const RUGS_FUN_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function balances(address user) external view returns (uint256)",
];

const RUGS_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function claimFaucet() external",
];

export const getReadProvider = () =>
  new JsonRpcProvider(RPC_URL, CHAIN_ID ? { chainId: CHAIN_ID, name: "monad-testnet" } : undefined);

export const getRugsFunContract = (signerOrProvider: BrowserProvider | JsonRpcProvider | any) =>
  new Contract(CONTRACTS.RUGS_FUN, RUGS_FUN_ABI, signerOrProvider);

export const getRugsTokenContract = (signerOrProvider: BrowserProvider | JsonRpcProvider | any) =>
  new Contract(CONTRACTS.RUGS_TOKEN, RUGS_TOKEN_ABI, signerOrProvider);

export async function readRugsBalance(address: string): Promise<number> {
  const provider = getReadProvider();
  const rugsFun = getRugsFunContract(provider);
  const raw = (await rugsFun.balances(address)) as bigint;
  return Number.parseFloat(formatEther(raw));
}

export async function approveIfNeeded(
  provider: BrowserProvider,
  amountWei: bigint
) {
  const signer = await provider.getSigner();
  const token = getRugsTokenContract(signer);
  const owner = await signer.getAddress();
  const allowance = (await token.allowance(owner, CONTRACTS.RUGS_FUN)) as bigint;
  if (allowance < amountWei) {
    const tx = await token.approve(CONTRACTS.RUGS_FUN, amountWei);
    await tx.wait();
  }
}

export async function depositRugs(
  provider: BrowserProvider,
  amount: string
) {
  const amountWei = parseEther(amount);
  await approveIfNeeded(provider, amountWei);
  const signer = await provider.getSigner();
  const rugsFun = getRugsFunContract(signer);
  const tx = await rugsFun.deposit(amountWei);
  return tx.wait();
}

export async function withdrawRugs(
  provider: BrowserProvider,
  amount: string
) {
  const signer = await provider.getSigner();
  const rugsFun = getRugsFunContract(signer);
  const tx = await rugsFun.withdraw(parseEther(amount));
  return tx.wait();
}

export async function claimRugsFaucet(provider: BrowserProvider) {
  const signer = await provider.getSigner();
  const token = getRugsTokenContract(signer);
  const tx = await token.claimFaucet();
  return tx.wait();
}

export function isUserRejection(error: any): boolean {
  if (!error) return false;

  const code = error.code || error.error?.code || error.info?.error?.code;
  const message = (error.message || "").toLowerCase();
  const reason = error.reason?.toLowerCase() || "";

  return (
    code === "ACTION_REJECTED" ||
    code === 4001 ||
    reason.includes("rejected") ||
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected by user")
  );
}
