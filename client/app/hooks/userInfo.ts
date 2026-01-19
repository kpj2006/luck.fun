import { create } from "zustand";
import { useEffect } from "react";
import { supabase } from "@/supabase/client";
import { readRugsBalance } from "@/lib/evm";
import { useEvmWallet } from "./evmWallet";

interface UserInformationStore {
  balance: number | null;
  userName: string | null;
  loading: boolean;
  error: any;
  isApplied: boolean;
  setBalance: (balance: number | null) => void;
  setUserName: (userName: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: any) => void;
  setisApplied: (isApplied: boolean) => void;
  fetchBalance: (publicKey: string) => Promise<void>;
  fetchUsernameClient: (publicKey: string) => Promise<void>;
  refetch: (publicKey: string) => Promise<void>;
  reset: () => void;
}

export const useUserInformationStore = create<UserInformationStore>(
  (set, get) => ({
    balance: null,
    userName: null,
    loading: false,
    error: null,
    isApplied: false,

    setBalance: (balance: number | null) => set({ balance }),
    setUserName: (userName: string | null) => set({ userName }),
    setLoading: (loading: boolean) => set({ loading }),
    setError: (error: any) => set({ error }),
    setisApplied: (isApplied: boolean) => set({ isApplied }),

    fetchBalance: async (address: string) => {
      set({ loading: true, error: null });
      try {
        const balance = await readRugsBalance(address);
        set({ balance });
      } catch (err) {
        console.error("Error fetching balance:", err);
        set({ error: err });
      } finally {
        set({ loading: false });
      }
    },

    fetchUsernameClient: async (address: string) => {
      // Skip username fetch since table doesn't have user_name column
      // try {
      //   await supabase.from("users_rugsfun").upsert(
      //     { wallet_address: address },
      //     { onConflict: "wallet_address" }
      //   );

      //   const { data, error } = await supabase
      //     .from("users_rugsfun")
      //     .select("user_name")
      //     .eq("wallet_address", address)
      //     .single();

      //   if (error) {
      //     console.error("Error fetching username:", error);
      //     return;
      //   }

      //   set({ userName: data?.user_name ?? "guest" });
      // } catch (err) {
      //   console.error("Error fetching username:", err);
      // }
    },

    updateUsername: async (newName: string) => {
      // Skip username update since table doesn't have user_name column
      // try {
      //   const { error } = await supabase
      //     .from("users_rugsfun")
      //     .update({ user_name: newName })
      //     .eq("wallet_address", get().publicKey);

      //   if (error) {
      //     console.error("Failed to update username:", error);
      //     return;
      //   }
      // } catch (err) {
      //   console.error("Failed to update username:", err);
      // }
    },

    refetch: async (publicKey: string) => {
      await get().fetchBalance(publicKey);
    },

    reset: () =>
      set({
        balance: null,
        userName: null,
        loading: false,
        error: null,
        isApplied: false,
      }),
  })
);

// Hook to automatically sync with wallet
export const useUserInformation = () => {
  const wallet = useEvmWallet();
  const store = useUserInformationStore();

  useEffect(() => {
    if (wallet.address) {
      store.fetchBalance(wallet.address);
      store.fetchUsernameClient(wallet.address);
    } else {
      store.reset();
    }
  }, [wallet.address]);

  return {
    balance: store.balance,
    setBalance: store.setBalance,
    userName: store.userName,
    setUserName: store.setUserName,
    loading: store.loading,
    error: store.error,
    isApplied: store.isApplied,
    setisApplied: store.setisApplied,
    refetch: () => wallet.address && store.refetch(wallet.address),
  };
};
