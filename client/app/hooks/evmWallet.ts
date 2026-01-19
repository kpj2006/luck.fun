"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BrowserProvider } from "ethers";
import { CHAIN_ID } from "@/constants/constants";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type EvmWalletContextValue = {
  address: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const EvmWalletContext = createContext<EvmWalletContextValue | null>(null);

async function getChainId(provider: Eip1193Provider): Promise<number | null> {
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  if (!hex) return null;
  return Number.parseInt(hex, 16);
}

export function EvmWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("No injected wallet found");
    }

    setIsConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const nextAddress = accounts?.[0] ?? null;
      setAddress(nextAddress);

      const nextChainId = await getChainId(window.ethereum);
      setChainId(nextChainId);

      const nextProvider = new BrowserProvider(window.ethereum as any);
      setProvider(nextProvider);

      if (CHAIN_ID && nextChainId && nextChainId !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          });
          setChainId(CHAIN_ID);
        } catch {
        }
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setProvider(null);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: any) => {
      const next = Array.isArray(accounts) ? accounts[0] ?? null : null;
      setAddress(next);
    };

    const handleChainChanged = (hexChainId: any) => {
      const next = typeof hexChainId === "string" ? Number.parseInt(hexChainId, 16) : null;
      setChainId(next);
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      if (!window.ethereum) return;
      const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
      const nextAddress = accounts?.[0] ?? null;
      if (!nextAddress) return;
      setAddress(nextAddress);
      setChainId(await getChainId(window.ethereum));
      setProvider(new BrowserProvider(window.ethereum as any));
    };

    hydrate();
  }, []);

  const value = useMemo<EvmWalletContextValue>(
    () => ({
      address,
      chainId,
      provider,
      isConnecting,
      connect,
      disconnect,
    }),
    [address, chainId, provider, isConnecting, connect, disconnect]
  );

  return React.createElement(
    EvmWalletContext.Provider,
    { value },
    children
  );
}

export function useEvmWallet(): EvmWalletContextValue {
  const ctx = useContext(EvmWalletContext);
  if (!ctx) {
    throw new Error("useEvmWallet must be used within EvmWalletProvider");
  }
  return ctx;
}

export function formatAddress(addr: string, chars = 4) {
  if (!addr) return "";
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}
