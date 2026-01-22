export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "10143");
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://monad-testnet.g.alchemy.com/v2/2MhaA2rKxVwyufFUVZ1h-";

// Dynamic WebSocket URL that works on both desktop and mobile
export const getWebSocketUrl = () => {
  // Server-side rendering fallback
  if (typeof window === 'undefined') {
    return 'ws://localhost:8081';
  }
  
  // If environment variable is set, use it
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;
    console.log('Using env BACKEND_URL:', url);
    return url;
  }
  
  // Get current hostname from browser
  const hostname = window.location.hostname;
  console.log('Current hostname:', hostname);
  
  // For localhost access
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const url = 'ws://localhost:8081';
    console.log('Using localhost URL:', url);
    return url;
  }
  
  // For mobile access via local IP, use same host with port 8081
  const url = `ws://${hostname}:8081`;
  console.log('Using dynamic URL:', url);
  return url;
};

// Legacy export for backward compatibility
export const WS_URL = getWebSocketUrl();

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
