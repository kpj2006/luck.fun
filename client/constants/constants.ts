export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "10143");
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://monad-testnet.g.alchemy.com/v2/2MhaA2rKxVwyufFUVZ1h-";
export const WS_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "ws://localhost:8080";

export const CONTRACTS = {
  RUGS_TOKEN: "0x4297F610EF0E14E988494507dF51Fb2E396A9fF3",
  RUGS_FUN: "0x3e52d90257fF7db1c0e300FD4c9EfBa4F0C233D3",
  GAME_MANAGER: "0x279b095b1a44d1d91754359AA45725fb376185BE",
  TREASURY: "0x6AaAbB7085076A46B2B6b8E98BEAb0CFC56Cf910",
} as const;

export const TOKEN_DISPLAY = {
  symbol: "RUGS",
  name: "Rugs",
  img: "https://apneajyhbpncbciasirk.supabase.co/storage/v1/object/public/nft-storage/rugs-fun/rugs-fun-logo-cropped-png.png",
};

export const BET_UNIT = 1_000_000_000;
