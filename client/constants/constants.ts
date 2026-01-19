export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "10143");
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";
export const WS_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "ws://localhost:8080";

export const CONTRACTS = {
  RUGS_TOKEN: "0x4297F610EF0E14E988494507dF51Fb2E396A9fF3",
  RUGS_FUN: "0x64a1ab8072B0b912124739c150d5cD309B1797E1",
  GAME_MANAGER: "0x8ed4C9D0DEB8e74d770712437d7731CA1975039e",
  TREASURY: "0xe576A8Cdd8D805C780244D93d792564fDCf1A8a1",
} as const;

export const TOKEN_DISPLAY = {
  symbol: "RUGS",
  name: "Rugs",
  img: "https://apneajyhbpncbciasirk.supabase.co/storage/v1/object/public/nft-storage/rugs-fun/rugs-fun-logo-cropped-png.png",
};

export const BET_UNIT = 1_000_000_000;
