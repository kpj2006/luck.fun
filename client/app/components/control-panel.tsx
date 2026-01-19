import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { cn } from "../../lib/utils";
import { X, Wallet, Zap, Lock, DollarSign, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BET_UNIT, TOKEN_DISPLAY } from "@/constants/constants";

interface NeoBetInterfaceProps {
  className?: string;

  // --- Controlled Props (Lifted State) ---
  amount: number;
  setAmount: (val: number) => void;
  balance: number;
  setBalance: (val: number) => void;
  autosell: number | null;
  setAutoSellAmount: (val: number | null) => void;
  isApplied: boolean;
  setisApplied: (val: boolean) => void;

  // --- Context / Logic Props ---
  wsRef?: React.MutableRefObject<WebSocket | null>;
  publicKey?: string | null;
  gameState: "WAITING" | "ACTIVE" | "CRASHED";
  currentMultiplier?: number;
  currentMultiplierRef?: React.MutableRefObject<number>;
  userHasBet?: boolean;
  onTrade?: () => void;
}

export const NeoBetInterface: React.FC<NeoBetInterfaceProps> = ({
  className,
  amount,
  setAmount,
  balance,
  setBalance,
  autosell,
  setAutoSellAmount,
  isApplied,
  setisApplied,
  wsRef,
  publicKey,
  gameState = "WAITING",
  currentMultiplier = 1.0,
  currentMultiplierRef,
  userHasBet = false,
  onTrade,
}) => {
  // --- Local UI State ---
  const [localAmountStr, setLocalAmountStr] = useState<string>(
    amount > 0 ? amount.toString() : ""
  );
  const [message, setMessage] = useState<string>("");

  // Sync local string when parent prop changes externally
  useEffect(() => {
    if (amount !== parseFloat(localAmountStr)) {
      setLocalAmountStr(amount > 0 ? amount.toString() : "");
    }
  }, [amount]);

  // Defensive balance formatting
  const formattedBalance = React.useMemo(() => {
    try {
      if (balance === null || balance === undefined) return "0.0000";
      const num = Number(balance);
      if (isNaN(num)) return "0.0000";
      return num.toFixed(4);
    } catch (e) {
      console.error("Error formatting balance:", balance, e);
      return "0.0000";
    }
  }, [balance]);

  const amountPresets = ["0.1", "0.25", "0.5", "1.0", "2.5", "5.0", "MAX"];

  const handleAmountInput = (val: string) => {
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setLocalAmountStr(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        setAmount(parsed);
      } else {
        setAmount(0);
      }
    }
  };

  const applyPreset = (preset: string) => {
    if (preset === "MAX") {
      const maxVal = parseFloat(formattedBalance);
      setAmount(maxVal);
      setLocalAmountStr(maxVal.toString());
    } else if (preset === "X") {
      setAmount(0);
      setLocalAmountStr("");
    } else {
      const val = parseFloat(preset);
      setAmount(val);
      setLocalAmountStr(preset);
    }
  };

  const toggleAutoSell = () => {
    if (autosell && autosell > 0 && !isApplied) {
      toast.success("Auto-sell activated");
      setisApplied(true);
    } else if (isApplied) {
      setisApplied(false);
    } else {
      toast.warning("Enter a valid multiplier");
      setisApplied(false);
    }
  };

  // --- Buy / Sell Logic ---
  const handleBuy = () => {
    console.log(`Coming in buy`);
    if (amount <= 0) {
      toast.warning("Invalid Amount");
      return;
    }

    if (!publicKey || publicKey === "guest") {
      toast.error("Connect Wallet");
      return;
    }

    const rawMult = currentMultiplierRef
      ? currentMultiplierRef.current
      : currentMultiplier;
    const buyPrice = parseFloat(rawMult.toFixed(4));
    const buyAmountUnits = Math.round(amount * BET_UNIT);

    if (wsRef?.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "buy",
          userId: publicKey,
          buy: buyPrice,
          buyAmount: buyAmountUnits,
        })
      );
    }

    // Optimistic balance update
    if (balance !== undefined) {
      setBalance(balance - amount);
    }

    if (onTrade) onTrade();
    toast.success("Bet Placed! 🚀");
  };

  const handleSell = () => {
    if (!publicKey || publicKey === "guest") return;

    const rawMult = currentMultiplierRef
      ? currentMultiplierRef.current
      : currentMultiplier;
    const sellPrice = parseFloat(rawMult.toFixed(4));

    if (wsRef?.current) {
      wsRef.current.send(
        JSON.stringify({ type: "sell", userId: publicKey, sell: sellPrice })
      );
    }

    console.log(`Sold at: ${sellPrice}`);
    if (onTrade) onTrade();
    toast.success(`Cashed out @ ${sellPrice}x 💰`);
  };

  const isBuyDisabled =
    !publicKey ||
    publicKey === "guest" ||
    gameState === "CRASHED" ||
    gameState === "WAITING" ||
    amount <= 0;
  const isSellDisabled =
    !publicKey ||
    publicKey === "guest" ||
    gameState === "CRASHED" ||
    gameState === "WAITING" ||
    !userHasBet;

  return (
    <div className={cn("w-full relative z-30", className)}>
      {/* NEO-BRUTALIST CONTAINER */}
      <div
        className={cn(
          "bg-zinc-950 border-t-4 border-yellow-400 md:border-4 md:shadow-[4px_4px_0px_0px_rgba(250,204,21,1)]",
          "flex flex-col overflow-hidden"
        )}
      >
        {/* TOP SECTION: CONTROLS */}
        <div className="flex flex-col md:flex-row md:items-stretch">
          {/* --- LEFT: BETTING INPUTS --- */}
          <div className="flex-1 p-3 flex flex-col gap-2 relative border-b-4 md:border-b-0 md:border-r-4 border-yellow-400/20 md:border-yellow-400">
            <div className="flex flex-col gap-2">
              <div className="relative group">
                <div className="absolute top-0.5 left-0 text-yellow-400/50 font-mono text-[10px] font-bold">
                  WAGER ({TOKEN_DISPLAY.symbol})
                </div>
                <input
                  inputMode="decimal"
                  type="text"
                  value={localAmountStr}
                  onChange={(e) => handleAmountInput(e.target.value)}
                  placeholder="0.0000"
                  className={cn(
                    "w-full bg-transparent text-right font-mono text-3xl md:text-4xl font-bold text-yellow-400 outline-none placeholder:text-zinc-800",
                    "border-b-4 border-zinc-800 focus:border-yellow-400 transition-colors py-1 h-12"
                  )}
                />
                <button
                  onClick={() => applyPreset("X")}
                  className="absolute right-0 bottom-2 text-zinc-600 hover:text-red-500 transition-colors"
                >
                  <X size={16} strokeWidth={4} />
                </button>
              </div>

              <div className="flex justify-between items-center gap-2">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {amountPresets.map((p) => (
                    <button
                      key={p}
                      onClick={() => applyPreset(p)}
                      className={cn(
                        "px-2 py-0.5 font-mono font-bold text-[10px] md:text-xs border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black transition-colors min-w-[40px]",
                        "active:translate-y-[1px]"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 bg-zinc-900 border-2 border-zinc-800 px-2 py-0.5 shrink-0">
                  <Wallet size={12} className="text-zinc-500" />
                  <span className="font-mono text-yellow-400 text-xs md:text-sm">
                    {formattedBalance}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* --- RIGHT: AUTO SELL CONFIG --- */}
          <div className="flex md:w-[35%] bg-zinc-900/50 p-3 flex-row md:flex-col justify-between items-center md:items-start gap-2 relative">
            <div className="hidden md:flex items-center gap-2 text-yellow-400 mb-1">
              <Zap size={14} fill="currentColor" />
              <h3 className="font-bold text-xs uppercase tracking-tight">
                Auto Sell
              </h3>
            </div>
            <div className="flex gap-2 w-full items-center">
              <div className="relative w-full">
                <div className="md:hidden absolute top-1/2 -translate-y-1/2 left-2 text-yellow-400/50 text-[10px] font-bold pointer-events-none">
                  AUTO (X)
                </div>
                <input
                  inputMode="decimal"
                  type="number"
                  value={autosell ?? ""}
                  onChange={(e) => setAutoSellAmount(Number(e.target.value))}
                  placeholder="TARGET"
                  disabled={isApplied}
                  className={cn(
                    "w-full bg-zinc-950 px-2 py-1 font-mono text-lg text-right text-white outline-none border-2 border-zinc-800 focus:border-yellow-400 transition-all placeholder:text-zinc-700 h-10",
                    isApplied && "opacity-50 cursor-not-allowed"
                  )}
                />
              </div>
              <button
                onClick={toggleAutoSell}
                className={cn(
                  "px-3 h-10 font-bold uppercase tracking-wider text-[10px] border-2 transition-all flex items-center justify-center whitespace-nowrap min-w-[60px]",
                  isApplied
                    ? "bg-red-500/10 text-red-500 border-red-500 hover:bg-red-500 hover:text-black"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-yellow-400 hover:text-yellow-400"
                )}
              >
                {isApplied ? "STOP" : "SET"}
              </button>
            </div>
          </div>
        </div>

        {/* --- BOTTOM SECTION: BUY / SELL ACTION BAR --- */}
        <div className="border-t-4 border-yellow-400 bg-zinc-900 p-2 md:p-3">
          <div className="flex flex-row gap-3 justify-center items-center w-full">
            {/* BUY BUTTON */}
            <button
              onClick={handleBuy}
              disabled={isBuyDisabled}
              className={cn(
                "flex-1 h-14 md:h-16 text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center justify-center gap-2 border-b-4 border-r-4 border-black transition-all",
                "active:border-b-0 active:border-r-0 active:translate-y-[2px] active:translate-x-[2px]",
                isBuyDisabled
                  ? "bg-zinc-800 text-zinc-600 border-zinc-700 cursor-not-allowed active:border-zinc-700 active:translate-y-0 active:translate-x-0"
                  : "bg-green-500 text-black hover:bg-green-400 border-green-700"
              )}
            >
              {isBuyDisabled && gameState === "ACTIVE" ? (
                <>
                  Wait <Lock size={18} />
                </>
              ) : (
                <>
                  BET <DollarSign size={20} strokeWidth={3} />
                </>
              )}
            </button>

            {/* SELL BUTTON */}
            <button
              onClick={handleSell}
              disabled={isSellDisabled}
              className={cn(
                "flex-1 h-14 md:h-16 text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center justify-center gap-2 border-b-4 border-r-4 border-black transition-all",
                "active:border-b-0 active:border-r-0 active:translate-y-[2px] active:translate-x-[2px]",
                isSellDisabled
                  ? "bg-zinc-800 text-zinc-600 border-zinc-700 cursor-not-allowed opacity-50 active:border-zinc-700 active:translate-y-0 active:translate-x-0"
                  : "bg-red-500 text-white hover:bg-red-600 border-red-800"
              )}
            >
              CASHOUT
            </button>
          </div>
        </div>

        {/* Removed Floating Message Toast in favor of sonner */}
      </div>
    </div>
  );
};
