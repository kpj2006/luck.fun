"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useUserInformation } from "../hooks/userInfo";
import { useEvmWallet } from "../hooks/evmWallet";
import { supabase } from "@/supabase/client";
import { depositRugs, withdrawRugs, isUserRejection } from "@/lib/evm";
import { TOKEN_DISPLAY } from "@/constants/constants";
// Note: toast replaced with alert for preview, but logic remains.
import { toast } from "sonner";

export default function NeoNavbar() {
  const wallet = useEvmWallet();
  const { balance, setUserName, userName, refetch } = useUserInformation();
  const isConnected = Boolean(wallet.address);

  // Local State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  const [changeusername, setchangeusername] = useState(userName);
  const [tokenamount, setTokenAmount] = useState("");
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [loadingWithdraw, setLoadingWithdraw] = useState(false);

  // Sync local username state when context changes
  useEffect(() => {
    setchangeusername(userName);
  }, [userName]);

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

  // ——————————————————————————————————————————
  // USER CREATION HANDLER
  useEffect(() => {
    if (wallet.address) {
      handleUser(wallet.address);
    }
  }, [wallet.address]);

  const handleUser = async (walletAddress: string) => {
    try {
      await supabase.from("users_rugsfun").upsert(
        { wallet_address: walletAddress },
        { onConflict: "wallet_address" }
      );
    } catch (err) {
      console.error("Failed to create user:", err);
      toast.error("Could not initialize your account.");
    }
  };

  // ——————————————————————————————————————————
  // DEPOSIT FUNCTION
  const depositFunds = async () => {
    if (!wallet.address || !wallet.provider) {
      toast.error("Wallet not connected");
      return;
    }
    if (!tokenamount || Number(tokenamount) <= 0) {
      toast.warning("Enter a valid amount to deposit");
      return;
    }

    try {
      setLoadingDeposit(true);
      await depositRugs(wallet.provider, tokenamount);
      await refetch();
      toast.success(`Deposit successful! ✅`);
      setTokenAmount("");
      setIsMenuOpen(false);
    } catch (error: any) {
      if (isUserRejection(error)) {
        toast.info("Transaction cancelled");
        return;
      }
      console.error("Deposit Error:", error);
      toast.error("Deposit failed. Please try again.");
    } finally {
      setLoadingDeposit(false);
    }
  };

  // ——————————————————————————————————————————
  // WITHDRAW FUNCTION
  const withdrawFunds = async () => {
    if (!wallet.address || !wallet.provider) {
      toast.error("Wallet not connected");
      return;
    }
    if (!tokenamount || Number(tokenamount) <= 0) {
      toast.warning("Enter a valid amount to withdraw");
      return;
    }

    try {
      setLoadingWithdraw(true);
      if (balance !== null && Number(tokenamount) > balance) {
        toast.error("Cannot withdraw more than available balance.");
        return;
      }

      await withdrawRugs(wallet.provider, tokenamount);
      await refetch();
      toast.success("Withdrawal successful! ✅");
      setTokenAmount("");
      setIsMenuOpen(false);
    } catch (error: any) {
      if (isUserRejection(error)) {
        toast.info("Transaction cancelled");
        return;
      }
      console.error("Withdrawal Error:", error);
      toast.error("Withdrawal failed. Please try again.");
    } finally {
      setLoadingWithdraw(false);
    }
  };

  // ——————————————————————————————————————————
  // USERNAME UPDATE FUNCTION
  const handleUsernameUpdate = async () => {
    // Skip username update since table doesn't have user_name column
    // if (!changeusername?.trim() || !wallet.address) return;
    // const { data, error } = await supabase
    //   .from("users_rugsfun")
    //     .update({ user_name: changeusername.trim() })
    //     .eq("wallet_address", wallet.address)
    //     .select("user_name")
    //     .single();

    // if (error) {
    //   console.error("Failed to update username:", error);
    //   return;
    // }

    // if (data?.user_name) setUserName(data.user_name);
  };

  return (
    <>
      {/* NAVBAR CONTAINER */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={cn(
          "sticky top-0 z-50 w-full bg-zinc-950 border-b-4 border-yellow-400",
          "shadow-[0px_4px_0px_0px_rgba(0,0,0,0.5)]"
        )}
      >
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex justify-between items-center">
          {/* LEFT: LOGO */}
          <div className="flex items-center gap-4">
            <a href="/" className="block group relative">
              <div className="absolute inset-0 bg-yellow-400 translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
              <div className="relative border-2 border-black bg-zinc-900 p-1">
                <img
                  src="https://apneajyhbpncbciasirk.supabase.co/storage/v1/object/public/nft-storage/rugs-fun/rugs-fun-logo-cropped-png.png"
                  alt="Logo"
                  className="h-10 w-auto object-contain"
                />
              </div>
            </a>
          </div>

          {/* RIGHT: CONTROLS */}
          <div className="flex items-center gap-4">
            {isConnected ? (
              <>
                {/* 1. Username Input */}
                <div className="hidden md:flex relative group">
                  <div className="absolute inset-0 bg-yellow-400 translate-x-1 translate-y-1" />
                  <div className="relative flex items-center bg-zinc-900 border-2 border-black p-1">
                    <input
                      type="text"
                      value={changeusername || ""}
                      onChange={(e) => setchangeusername(e.target.value)}
                      placeholder={
                        userName === "guest"
                          ? "SET USERNAME"
                          : userName || "SET USERNAME"
                      }
                      className="bg-transparent text-white font-mono text-sm px-2 outline-none w-32 placeholder:text-zinc-600 uppercase"
                    />
                    {(userName === "guest" ||
                      !userName ||
                      changeusername !== userName) && (
                        <button
                          onClick={handleUsernameUpdate}
                          className="bg-yellow-400 text-black p-1 hover:bg-white transition-colors border-l-2 border-black"
                        >
                          <Check size={16} strokeWidth={3} />
                        </button>
                      )}
                  </div>
                </div>

                {/* 2. Menu Trigger (Deposit/Withdraw) */}
                <button
                  onClick={() => setIsMenuOpen(true)}
                  className="relative group outline-none"
                >
                  <div className="absolute inset-0 bg-white translate-x-1 translate-y-1 group-hover:translate-x-1.5 group-hover:translate-y-1.5 transition-transform" />
                  <div className="relative bg-yellow-400 border-2 border-black p-2 flex items-center gap-2 group-active:translate-x-0.5 group-active:translate-y-0.5 transition-transform">
                    <Menu size={24} className="text-black" strokeWidth={3} />
                    <span className="hidden sm:block font-black text-black text-sm uppercase">
                      Menu
                    </span>
                  </div>
                </button>
              </>
            ) : (
              /* Connect Button Wrapper */
              <button
                onClick={wallet.connect}
                disabled={wallet.isConnecting}
                className="relative group !bg-transparent !p-0 !border-0 !h-auto"
              >
                <div className="absolute inset-0 bg-red-500 translate-x-1 translate-y-1 group-hover:translate-x-1.5 group-hover:translate-y-1.5 transition-transform" />
                <div className="relative bg-zinc-900 border-2 border-white text-white px-6 py-2 font-black uppercase tracking-wider hover:bg-zinc-800 transition-colors">
                  {wallet.isConnecting ? "Connecting..." : "Connect Wallet"}
                </div>
              </button>
            )}
          </div>
        </div>
      </motion.nav>

      {/* MODAL OVERLAY */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border-4 border-yellow-400 shadow-[12px_12px_0px_0px_#000]"
            >
              {/* Modal Header */}
              <div className="bg-yellow-400 p-4 border-b-4 border-black flex justify-between items-center">
                <h2 className="text-xl font-black text-black uppercase tracking-tighter">
                  Manage Funds
                </h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="bg-black text-yellow-400 p-1 hover:bg-white hover:text-black transition-colors"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b-4 border-black bg-zinc-800">
                <button
                  onClick={() => setActiveTab("deposit")}
                  className={cn(
                    "flex-1 py-3 font-mono font-bold uppercase transition-colors flex items-center justify-center gap-2",
                    activeTab === "deposit"
                      ? "bg-zinc-900 text-yellow-400 shadow-[inset_0_-4px_0_0_#facc15]"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                  )}
                >
                  <ArrowDownCircle size={18} /> Deposit
                </button>
                <div className="w-1 bg-black"></div>
                <button
                  onClick={() => setActiveTab("withdraw")}
                  className={cn(
                    "flex-1 py-3 font-mono font-bold uppercase transition-colors flex items-center justify-center gap-2",
                    activeTab === "withdraw"
                      ? "bg-zinc-900 text-yellow-400 shadow-[inset_0_-4px_0_0_#facc15]"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                  )}
                >
                  <ArrowUpCircle size={18} /> Withdraw
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col gap-6">
                {/* Balance Display */}
                <div className="bg-zinc-950 border-2 border-zinc-800 p-3 flex justify-between items-center">
                  <span className="text-zinc-500 font-mono text-xs uppercase">
                    Available Balance
                  </span>
                  <span className="text-white font-mono font-bold">
                    {formattedBalance} {TOKEN_DISPLAY.symbol}
                  </span>
                </div>

                {/* Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-yellow-400 uppercase tracking-widest">
                    Amount ({TOKEN_DISPLAY.symbol})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={tokenamount}
                      onChange={(e) => setTokenAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-zinc-800 border-2 border-zinc-600 p-4 text-white font-mono text-xl outline-none focus:border-yellow-400 focus:bg-zinc-900 transition-colors"
                    />
                    <button
                      onClick={() => {
                        if (activeTab === "withdraw") {
                          setTokenAmount(balance ? balance.toString() : "0");
                        } else {
                          setTokenAmount("1.0"); // Default example
                        }
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold bg-zinc-700 text-white px-2 py-1 hover:bg-yellow-400 hover:text-black transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                  {activeTab === "withdraw" && (
                    <div className="text-[10px] text-zinc-500 text-right">
                      Max withdrawable:{" "}
                      {formattedBalance}
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={
                    activeTab === "deposit" ? depositFunds : withdrawFunds
                  }
                  disabled={loadingDeposit || loadingWithdraw || !tokenamount}
                  className={cn(
                    "w-full py-4 font-black uppercase tracking-wider text-lg border-2 border-black shadow-[4px_4px_0px_0px_#000] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] transition-all flex justify-center items-center gap-2",
                    (loadingDeposit || loadingWithdraw) &&
                    "opacity-70 cursor-wait",
                    activeTab === "deposit"
                      ? "bg-green-500 hover:bg-green-400 text-black"
                      : "bg-red-500 hover:bg-red-400 text-white"
                  )}
                >
                  {loadingDeposit || loadingWithdraw ? (
                    <Loader2 className="animate-spin" />
                  ) : activeTab === "deposit" ? (
                    "DEPOSIT FUNDS"
                  ) : (
                    "WITHDRAW FUNDS"
                  )}
                </button>

                {/* Footer Actions */}
                <div className="pt-4 border-t-2 border-zinc-800 flex justify-between items-center text-xs">
                  <button
                    onClick={() => wallet.disconnect()}
                    className="text-red-500 hover:text-red-400 font-bold flex items-center gap-1 uppercase"
                  >
                    <LogOut size={14} /> Disconnect
                  </button>

                  <a
                    href="/faucet"
                    className="text-zinc-500 hover:text-yellow-400 underline decoration-dashed underline-offset-4"
                  >
                    Need testnet {TOKEN_DISPLAY.symbol}?
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
