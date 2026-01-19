import { CONTRACTS, TOKEN_DISPLAY } from "@/constants/constants";

export const TOKENS = [
  {
    symbol: TOKEN_DISPLAY.symbol,
    name: TOKEN_DISPLAY.name,
    mint: CONTRACTS.RUGS_TOKEN,
    img: TOKEN_DISPLAY.img,
  },
] as const;

export type FaucetToken = (typeof TOKENS)[number];
