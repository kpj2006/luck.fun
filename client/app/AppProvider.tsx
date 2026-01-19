"use client";

import React from "react";
import { EvmWalletProvider } from "./hooks/evmWallet";

const AppProvider = ({ children }: { children: React.ReactNode }) => {
  return <EvmWalletProvider>{children}</EvmWalletProvider>;
};

export default AppProvider;
