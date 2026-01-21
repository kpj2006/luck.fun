export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "10143");
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://monad-testnet.g.alchemy.com/v2/2MhaA2rKxVwyufFUVZ1h-";
export const WS_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "ws://localhost:8080";

export const CONTRACTS = {
  RUGS_TOKEN: "0x4297F610EF0E14E988494507dF51Fb2E396A9fF3",
  RUGS_FUN: "0x497Efed09b7B193092EA50a1fffD5205a46A547c",
  GAME_MANAGER: "0x4F9859F8489CD0bB5b9Cc8dcAC952e4F4296f4A2",
  TREASURY: "0x14f432585D19dB2D1dc25996f345953384B2dE37",
} as const;

export const TOKEN_DISPLAY = {
  symbol: "RUGS",
  name: "Rugs",
  img: "https://apneajyhbpncbciasirk.supabase.co/storage/v1/object/public/nft-storage/rugs-fun/rugs-fun-logo-cropped-png.png",
};

export const BET_UNIT = 1_000_000_000;
