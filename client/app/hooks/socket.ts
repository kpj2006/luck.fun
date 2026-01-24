import { useEffect, useRef, useState } from "react";
import { getWebSocketUrl } from "@/constants/constants";
import { useUserInformation } from "./userInfo";
import { toast } from "sonner";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 5000; // 5 seconds

export default function useGameWebSocket() {
  const [userId, setUserId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [gameState, setGameState] = useState<"WAITING" | "ACTIVE" | "CRASHED">(
    "WAITING"
  );
  const { balance, setBalance, refetch } = useUserInformation();
  const [clientsConnected, setClientsConnected] = useState(0);
  const [allUserTrades, setAllUserTrades] = useState<
    {
      userId: string;
      trades: {
        id: number;
        key: String;
        userId: String;
        tradeId: String;
        buy: number;
        sell: number | null;
        pnl: number | null;
      }[];
    }[]
  >([
    // {
    //   userId: "5NHvrqoZk4ov5GvKzDpsmEeW4URwLuG6P4HrmSDTqHc7",
    //   trades: [
    //     {
    //       id: 123,
    //       key: "",
    //       userId: "",
    //       tradeId: "123",
    //       buy: 1.2,
    //       sell: 2.4,
    //       pnl: 2,
    //     },
    //   ],
    // },
  ]);
  const [previousGames, setPreviousGames] = useState<any[]>([]);
  const [globalChats, setGlobalChats] = useState<
    {
      username: string;
      message: string;
    }[]
  >([]);
  const [history, setHistory] = useState<number[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const historyRef = useRef<number[]>([]);
  const targetMultiplierRef = useRef<number>(1.0);

  useEffect(() => {
    if (typeof window === "undefined") return; // server-safe
    const storedId = localStorage.getItem("userId") || "guest";
    setUserId(storedId);
  }, []);

  // --------------------------------------------------
  // 🧩 WebSocket Connection
  // --------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    // Get WebSocket URL dynamically (client-side only)
    const url = getWebSocketUrl();

    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    console.log("Attempting to connect to:", url);
    setConnectionState("connecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnectionState("error");
      toast.error("Cannot connect to server. Please check your network.");
      return;
    }

    ws.onopen = () => {
      console.log("✅ Connected to WS");
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0; // Reset on successful connection
      ws.send(JSON.stringify({ type: "identify", userId }));
      console.log("Sent identification:", userId);
      toast.success("Connected to server");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const message = JSON.parse(event.data);

        if (message.type === "PING") {
          ws.send(
            JSON.stringify({
              type: "PONG",
              serverTimestamp: message.serverTimestamp,
            })
          );
        }

        if (message.type === "global-chat") {
          console.log("loading chats", message.chats);
          setGlobalChats(message.chats);
        }
        if (message.type === "LATENCY_UPDATE") {
          setLatency(message.latency);
        }
        // 🟢 Connected clients count
        if (data.type === "client-count") {
          setClientsConnected(data.count);
        }
        // 🔁 Restore user trades on reconnect (case-insensitive for EVM addresses)
        if (data.type === "trade-restore" && data.userId?.toLowerCase() === userId?.toLowerCase()) {
          setAllUserTrades((prev) => {
            const existing = prev.find((u) => u.userId?.toLowerCase() === data.userId?.toLowerCase());
            if (existing) {
              return prev.map((u) =>
                u.userId?.toLowerCase() === data.userId?.toLowerCase() ? { ...u, trades: data.trades } : u
              );
            } else {
              return [...prev, data];
            }
          });
        }

        // 🔁 Restore current game ticks
        if (data.type === "tick-restore") {
          historyRef.current = [...data.ticks.map((t: any) => t.value)];
          setHistory([...historyRef.current]);
        }

        // 🧭 Handle initial game state
        if (data.type === "init") {
          setGameState(data.state);
          setPreviousGames(data.previousGames || []);
          historyRef.current =
            data.currentGameTicks?.map((t: any) => t.value) || [];
          setHistory([...historyRef.current]);
        }

        // Load in global chats..

        if (data.type === "global-chat") {
        }

        // 📈 Handle tick updates
        if (data.type === "tick") {
          const state = data.state;

          targetMultiplierRef.current = Number(data.multiplier);
          historyRef.current = [
            ...historyRef.current,
            targetMultiplierRef.current,
          ].slice(-1000);
          setHistory([...historyRef.current]);
          if (state === "CRASHED") {
            targetMultiplierRef.current = Number(0);
            setGameState("CRASHED");
            refetch();
          } else if (state === "WAITING") {
            targetMultiplierRef.current = Number(0);
            setGameState("WAITING");
            setTimer(data.timer);
            setHistory([]);
            setAllUserTrades([]);
            historyRef.current = [];
          } else {
            setGameState("ACTIVE");
          }
        }

        if (data.type === "tick-restore") {
          historyRef.current = [...data.ticks.map((t: any) => t.value)];
          setHistory([...historyRef.current]);
        }

        // 💹 Handle trade updates from server (case-insensitive for EVM addresses)
        if (data.type === "trade-update") {
          console.log(`[DEBUG] Received trade-update:`, data);
          const { userId: tradeUserId, trades, new_balance } = data;
          setAllUserTrades((prev) => {
            const exists = prev.find((u) => u.userId?.toLowerCase() === tradeUserId?.toLowerCase());
            if (exists) {
              return prev.map((u) =>
                u.userId?.toLowerCase() === tradeUserId?.toLowerCase() ? { userId: tradeUserId, trades } : u
              );
            } else {
              return [...prev, { userId: tradeUserId, trades }];
            }
          });
          setBalance(Number(new_balance));
        }
        if (data.type === "withdrawal-success") {
          toast.success(`Withdrawal successful! TX: ${data.txHash.slice(0, 10)}...`);
          setBalance(Number(data.newBalance));
        }
        if (data.type === "prev-game") {
          setPreviousGames(data.data);
        }
      } catch (e) {
        console.error("Invalid WS message:", e);
      }
    };

    ws.onerror = (err) => {
      console.error("⚠️ WS error:", err);
      setConnectionState("error");

      // Don't spam toasts
      if (reconnectAttemptsRef.current === 0) {
        toast.error(`Cannot connect to backend at ${url}. Make sure it's running.`);
      }
    };

    ws.onclose = (event) => {
      console.log("🔴 WS closed", event.code, event.reason);
      setConnectionState("disconnected");

      // Only set to CRASHED if game was actually active
      if (gameState === "ACTIVE") {
        setGameState("CRASHED");
      }

      // Normal closure (1000) - don't reconnect
      if (event.code === 1000) {
        console.log("Normal WebSocket closure");
        return;
      }

      // Check reconnection attempts
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(`Reconnection attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);

        toast.info(`Reconnecting... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

        // Schedule reconnection
        reconnectTimeoutRef.current = setTimeout(() => {
          // Trigger re-render to reconnect
          setUserId(userId);
        }, RECONNECT_DELAY);
      } else {
        toast.error("Could not connect to server. Please refresh the page or check if backend is running.", {
          duration: 10000,
        });
      }
    };

    return () => {
      // Clean up
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, "Component unmounting");
      }
    };
  }, [userId]);

  return {
    gameState,
    history,
    allUserTrades,
    clientsConnected,
    previousGames,
    wsRef,
    historyRef,
    targetMultiplierRef,
    timer,
    userId,
    latency,
    globalChats,
    connectionState,
    setUserId,
    setGlobalChats,
    setGameState,
  };
}
