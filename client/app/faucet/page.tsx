"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Coins, Loader2 } from "lucide-react";
import { CONTRACTS } from "@/constants/constants";
import {
  addClaimRecord,
  FaucetRateStatus,
  getHistory,
  getRateStatus,
} from "../components/rate-limit";
import { toast } from "sonner";
import { FaucetTokenCard } from "../components/faucet-token-card";
import { FaucetAmounts } from "../components/faucet-amounts";
import { TOKENS } from "../components/tokens";
import { useEvmWallet } from "../hooks/evmWallet";
import { claimRugsFaucet, isUserRejection } from "@/lib/evm";

export default function FaucetPage() {
  const wallet = useEvmWallet();
  const [selectedMint] = useState<string>(CONTRACTS.RUGS_TOKEN);
  const [selectedAmount, setSelectedAmount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [rate, setRate] = useState<FaucetRateStatus | null>(null);
  const [history, setHistory] = useState<
    Array<{ mint: string; amount: number; ts: number; sig?: string }>
  >([]);

  const selectedToken = TOKENS[0];

  // refresh rate + history when wallet changes
  useEffect(() => {
    const address = wallet.address;
    if (!address) return;

    const fetchData = async () => {
      const rateStatus = await getRateStatus(address);
      const historyData = await getHistory(address);
      setRate(rateStatus);
      setHistory(historyData);
    };

    fetchData();
  }, [wallet.address]);

  const refresh = async () => {
    const address = wallet.address;
    if (!address) return;

    const rateStatus = await getRateStatus(address);
    const historyData = await getHistory(address);
    setRate(rateStatus);
    setHistory(historyData);
  };

  const handleAmountSelect = async (n: number) => {
    setSelectedAmount(n);
  };

  const handleMint = async () => {
    if (!wallet.address || !wallet.provider) {
      toast("Connect wallet");
      return;
    }

    const status = await getRateStatus(wallet.address);
    if (!status.canClaim || selectedAmount > status.remaining) {
      toast("Rate limit reached");
      return;
    }

    setIsLoading(true);

    try {
      // Add Claim Record
      const receipt = await claimRugsFaucet(wallet.provider);
      const txSig = receipt?.hash ?? receipt?.transactionHash;
      console.log(txSig, "txSig");
      if (!txSig) {
        toast("Error occured while airdrop");
        return;
      }
      addClaimRecord(wallet.address, {
        mint: selectedMint,
        amount: selectedAmount,
        ts: Date.now(),
        sig: txSig,
      });
      toast("Airdrop successful! 🎉");
      refresh();
    } catch (e: any) {
      if (isUserRejection(e)) {
        toast.info("Transaction cancelled");
        return;
      }
      console.error("Faucet Error:", e);
      toast.error("Airdrop failed");
    } finally {
      setIsLoading(false);
    }
  };

  const remainingMins = useMemo(() => {
    if (!rate) return 0;
    const ms = Math.max(0, rate.resetTime - Date.now());
    return Math.ceil(ms / 60000);
  }, [rate]);

  const canMint = useMemo(() => {
    return (
      wallet.address &&
      rate?.canClaim &&
      selectedAmount <= (rate?.remaining ?? 0) &&
      !isLoading
    );
  }, [wallet.address, rate, selectedAmount, isLoading]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 font-sans text-black">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-pretty text-2xl font-semibold text-white">
          Monad Testnet Faucet
        </h1>
        <Link href="/" className="text-sm underline">
          Back to app
        </Link>
      </header>

      {/* Educational banner */}
      <Card className="mb-8 p-5 bg-black border-none">
        <div className="space-y-2">
          <p className="text-sm text-gray-400 ">
            Welcome to our testing environment! This faucet provides free testnet
            RUGS tokens so you can explore the crash game without any risk.
          </p>
          <ul className="list-disc pl-5 text-sm text-gray-400">
            <li>Use RUGS to deposit and place bets</li>
            <li>All transactions are on Monad testnet (no real value)</li>
            <li>Perfect for testing the full gameplay loop safely</li>
          </ul>
          <ol className="list-decimal pl-5 text-sm text-gray-400">
            <li>Connect your EVM wallet</li>
            <li>Choose your desired token amount</li>
            <li>Airdrop tokens to your wallet</li>
            <li>Start playing the crash game</li>
          </ol>
        </div>
      </Card>

      {/* Wallet + Rate status */}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="p-4 bg-black border-none text-white">
          <h2 className="mb-2 text-sm font-medium">Wallet Status</h2>
          <p className="text-sm text-gray-400">
            Status:{" "}
            <span className="font-medium ">
              {wallet.isConnecting
                ? "Connecting"
                : wallet.address
                  ? "Connected"
                  : "Disconnected"}
            </span>
          </p>
          <p className="break-all text-sm text-gray-400">
            Address:{" "}
            <span className="font-mono ">
              {wallet.address || "Not connected"}
            </span>
          </p>
          <div>
            <Button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="mt-2"
            >
              {wallet.isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          </div>
        </Card>
        <Card className="p-4 bg-black border-none text-white">
          <h2 className="mb-2 text-sm font-medium">Rate Limit</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Used</span>
            <span className="font-medium ">
              {rate?.claimed ?? 0} / 10 tokens
            </span>
          </div>
          <Progress
            value={((rate?.claimed ?? 0) / 10) * 100}
            className="mb-2 mt-1"
          />
          <p className="text-xs text-gray-600">
            {rate
              ? rate.canClaim
                ? `You can claim ${rate.remaining} more token(s) this hour.`
                : `You've reached your hourly limit.`
              : "Connect your wallet to see rate limits."}
            {rate && <span> Next reset in ~{remainingMins} minute(s).</span>}
          </p>
        </Card>
      </section>

      {/* Token cards */}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        {/* @ts-ignore */}
        <FaucetTokenCard token={selectedToken} />
      </section>

      {/* Amount presets */}
      <section className="mb-6">
        <Card className="p-4 bg-black border-none text-white">
          <h2 className="mb-4 text-sm font-medium">Choose Amount</h2>
          <FaucetAmounts
            remaining={rate?.remaining ?? 0}
            disabled={!wallet.address || !(rate?.canClaim ?? false)}
            onPick={handleAmountSelect}
          />
        </Card>
      </section>

      {/* Mint Button */}
      <section className="mb-10">
        <Card className="p-6 bg-black border-none text-white">
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Ready to Mint?</h3>
              <p className="text-sm text-gray-600">
                You're about to mint{" "}
                <span className="font-medium ">
                  {selectedAmount} {selectedToken.symbol}
                </span>{" "}
                tokens to your wallet
              </p>
            </div>

            <Button
              onClick={handleMint}
              disabled={!canMint}
              size="lg"
              className="w-full md:w-auto px-8 py-3 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Minting Tokens...
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 mr-2" />
                  Mint {selectedAmount} {selectedToken.symbol} Tokens
                </>
              )}
            </Button>

            {!canMint && wallet.address && (
              <p className="text-xs text-gray-500 mt-2">
                {!rate?.canClaim
                  ? "Rate limit reached. Please wait for reset."
                  : selectedAmount > (rate?.remaining ?? 0)
                    ? `Not enough remaining tokens. You can claim ${rate?.remaining} more.`
                    : ""}
              </p>
            )}
          </div>
        </Card>
      </section>

      {/* History */}
      <section className="mb-16">
        <h2 className="mb-2 text-sm font-medium">Recent Claims</h2>
        {history.length === 0 ? (
          <Card className="p-4 text-sm bg-black border-none text-white">
            No claims yet.
          </Card>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 8).map((h, i) => (
              <Card key={i} className="flex items-center justify-between p-3">
                <span className="text-sm text-gray-600">
                  {new Date(h.ts).toLocaleString()}
                </span>
                <span className="font-medium ">
                  +{h.amount} {selectedToken.symbol}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Success pop animation */}
      <div
        id="faucet-celebrate"
        aria-hidden
        className="pointer-events-none fixed inset-0 z-10 grid place-items-center opacity-0"
      >
        <div className="rounded-full border-4 border-black/20 p-8">
          <div className="h-8 w-8 rounded-full bg-blue-600" />
        </div>
      </div>
    </main>
  );
}
