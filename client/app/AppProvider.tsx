"use client";

import React from "react";
import { EvmWalletProvider } from "./hooks/evmWallet";
import { useServiceWorker } from "./hooks/useServiceWorker";
import { usePWAInstallTracking } from "../lib/analytics";

const AppProvider = ({ children }: { children: React.ReactNode }) => {
  useServiceWorker();
  usePWAInstallTracking();
  
  return <EvmWalletProvider>{children}</EvmWalletProvider>;
};

export default AppProvider;
