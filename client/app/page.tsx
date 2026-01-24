"use client";
export const dynamic = "force-dynamic";
import { Label } from "@/components/ui/label";
import { useEvmWallet } from "./hooks/evmWallet";
import { useCallback, useEffect, useRef, useState } from "react";
// import Leaderboard from "./components/leaderboard"; // Replaced
import useGameWebSocket from "./hooks/socket";
import { Button } from "@/components/ui/button";
// import SummaryPrevGames from "./components/summary-data"; // Replaced
import { useUserInformation } from "./hooks/userInfo";
// import BetStopLossControl from "./components/control-panel"; // Replaced
import { Menu, RefreshCcw, Send, Wifi, Users, Wallet } from "lucide-react";
import { NeoChatSidebar } from "./components/chat-sidebar"; // Updated
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NeoLeaderboardSection } from "./components/leaderboard-components"; // Updated
import { NeoBetInterface } from "./components/control-panel"; // Updated
import { cn } from "@/lib/utils";
import NeoNavbar from "./components/navbar";
import { TOKEN_DISPLAY } from "@/constants/constants";
import { ConnectionStatus } from "./components/connection-status";
import { DebugPanel } from "./components/debug-panel";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [internalAmount, setInternalAmount] = useState<number>(0);
  const [autoSellAmount, setAutoSellAmount] = useState<number | null>(null);
  // constants
  const CANDLE_WIDTH = 30;
  const GAP = 6;
  const LEFT_PADDING = 60;
  const MAX_VISIBLE_CANDLES = 20;
  const wallet = useEvmWallet();
  // animation refs
  const animatedMultiplierRef = useRef<number>(1.0);
  const animatedMinRef = useRef<number>(0.2);
  const animatedMaxRef = useRef<number>(2.0);

  const {
    allUserTrades,
    gameState,
    previousGames,
    timer,
    historyRef,
    targetMultiplierRef,
    userId,
    setUserId,
    clientsConnected,
    wsRef,
    latency,
    globalChats,
    setGlobalChats,
    connectionState,
  } = useGameWebSocket();

  const { balance, setBalance, refetch, isApplied, setisApplied } =
    useUserInformation();

  // store gameState in a ref that updates each render
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  const timerRef = useRef(timer);
  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);
  const prevGameRef = useRef(previousGames);
  useEffect(() => {
    prevGameRef.current = previousGames;
  }, [previousGames]);

  // Handling Auto Sell
  useEffect(() => {
    const autoSell = async () => {
      const myTrades = allUserTrades.find((data) => data.userId?.toLowerCase() === userId?.toLowerCase());
      const sellPrice = parseFloat(animatedMultiplierRef.current.toFixed(4));
      if (
        isApplied &&
        autoSellAmount &&
        targetMultiplierRef.current >= autoSellAmount &&
        myTrades?.trades.find((dt) => dt.buy !== 0 && !dt.sell) &&
        wallet.address
      ) {
        wsRef.current?.send(
          JSON.stringify({ type: "sell", userId, sell: sellPrice })
        );
        console.log(`Auto Sold at: ${sellPrice}`);
        refetch();
      }
    };
    autoSell();
  }, [targetMultiplierRef.current]);

  // Calculate if the user has an active bet for the current UI state
  // Use toLowerCase() for EVM address comparison (checksummed vs lowercase)
  const myData = allUserTrades.find((d) => d.userId?.toLowerCase() === userId?.toLowerCase());
  const userHasBet = myData
    ? myData.trades.some((t) => t.buy > 0 && !t.sell)
    : false;

  // Debug: Log when userHasBet changes
  console.log(`[DEBUG] userHasBet=${userHasBet}, userId=${userId}, myData=`, myData);

  // helper: rounded rect (cross-browser)
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  };

  // Main draw function — contains candles + fluid curve + dotted label
  const drawChart = useCallback(() => {
    // console.log("draw");
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas) return;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Advance animated multiplier toward target (smooth)
    animatedMultiplierRef.current +=
      (targetMultiplierRef.current - animatedMultiplierRef.current) * 0.08;
    const current = animatedMultiplierRef.current;

    // background
    ctx.clearRect(0, 0, width, height);
    // Updated background to Zinc-900 (#18181b) to match Neo-Brutalist container
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, width, height);
    const currentGameState = gameStateRef.current;

    if (currentGameState === "CRASHED") {
      ctx.save();

      // 1️⃣ Draw red gradient overlay first
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(239, 68, 68, 0.1)");
      gradient.addColorStop(0.5, "rgba(239, 68, 68, 0.2)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0.3)");
      ctx.fillStyle = gradient;
      ctx.fillRect(LEFT_PADDING, 0, width - LEFT_PADDING, height);

      // 2️⃣ Then draw bright, glowing "RUGGED!"
      const pulse = 0.05 * Math.sin(Date.now() / 120) + 1; // subtle pulse
      ctx.globalAlpha = 1;
      ctx.font = `900 ${Math.floor(
        height * 0.14
      )}px 'Space Grotesk', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Outer glow shadow
      ctx.shadowColor = "rgba(255, 30, 30, 0.8)";
      ctx.shadowBlur = 0; // Hard shadow for brutalism
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;

      // Core text color — bright red
      ctx.fillStyle = "#ef4444";
      ctx.fillText("CRASHED!", width / 2, height / 2);

      // 4️⃣ Add laughing emoji — slightly below the text
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.font = `bold ${Math.floor(
        height * 0.1
      )}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

      // make it bounce a bit for fun
      const bounce = Math.sin(Date.now() / 300) * 8;
      ctx.fillText("💥", width / 2, height / 2 + height * 0.18 + bounce);

      ctx.restore();
    }

    // If waiting (post-crash), render the big centered countdown and return early
    if (currentGameState === "WAITING") {
      // draw faint grid behind timer for context
      ctx.strokeStyle = "#27272a"; // Zinc-800
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(LEFT_PADDING, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // center big countdown like multiplier
      const label = timerRef.current != null ? `${timerRef.current}s` : "";
      ctx.save();

      // subtle pulsing using time
      const pulse = 0.08 * Math.sin(Date.now() / 200) + 0.92;

      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // big number
      ctx.font = `bold ${Math.floor(height * 0.12)}px 'JetBrains Mono'`;
      ctx.fillStyle = "#facc15"; // Yellow-400
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;

      ctx.translate(width / 2, height / 2);
      ctx.scale(pulse, pulse);
      ctx.fillText(String(label), 0, 0);

      // subtitle below
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
      ctx.font = "600 18px 'Space Grotesk'";
      ctx.fillStyle = "#a1a1aa";
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.textAlign = "center";
      ctx.fillText(
        "NEXT ROUND STARTING...",
        width / 2,
        height / 2 + Math.floor(height * 0.12) / 1.6
      );
      ctx.restore();

      return;
    }
    // continue drawing chart when not WAITING
    const data = historyRef.current;
    // if no data, draw grid and return (no candles)
    if (!data.length) {
      ctx.strokeStyle = "#27272a";
      ctx.fillStyle = "#52525b";
      ctx.font = "14px 'JetBrains Mono'";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(LEFT_PADDING, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      return;
    }

    // Dynamic Y-axis (default 0.2 - 2.0), smooth expand/contract
    const DEFAULT_MIN = 0.2;
    const DEFAULT_MAX = 2.0;
    const rawMax = Math.max(...data, current);
    const rawMin = Math.min(...data, current);
    const padding = (rawMax - rawMin) * 0.1 || 0.1;
    const targetMin = Math.min(DEFAULT_MIN, rawMin - padding);
    const targetMax = Math.max(DEFAULT_MAX, rawMax + padding);

    animatedMinRef.current += (targetMin - animatedMinRef.current) * 0.06;
    animatedMaxRef.current += (targetMax - animatedMaxRef.current) * 0.06;

    const minMultiplier = animatedMinRef.current;
    const maxMultiplier = animatedMaxRef.current;
    const denom = maxMultiplier - minMultiplier || 1e-6;

    const scaleY = (val: number) =>
      height - ((val - minMultiplier) / denom) * height;

    // Grid + Y labels
    ctx.strokeStyle = "#27272a"; // Zinc-800
    ctx.fillStyle = "#71717a"; // Zinc-500
    ctx.font = "12px 'JetBrains Mono'";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      const value = maxMultiplier - (i / 5) * (maxMultiplier - minMultiplier);
      ctx.beginPath();
      ctx.moveTo(LEFT_PADDING, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(value.toFixed(2) + "x", LEFT_PADDING - 10, y);
    }

    // Prepare visible candles. Determine an appropriate start value for "open" of first visible candle.
    const visibleData = data.slice(-MAX_VISIBLE_CANDLES);
    const startIndex = Math.max(0, data.length - visibleData.length);
    const prevBeforeVisible =
      startIndex - 1 >= 0 ? data[startIndex - 1] : visibleData[0];
    let lastValue = prevBeforeVisible;

    // Draw candles (rounded)
    for (let i = 0; i < visibleData.length; i++) {
      const val = visibleData[i];
      const open = lastValue;
      const close = val;
      const high = Math.max(open, close);
      const low = Math.min(open, close);

      const x = LEFT_PADDING + i * (CANDLE_WIDTH + GAP);

      const yOpen = scaleY(open);
      const yClose = scaleY(close);
      const yHigh = scaleY(high);
      const yLow = scaleY(low);

      const color = close >= open ? "#22c55e" : "#ef4444";

      // draw wick
      ctx.beginPath();
      ctx.moveTo(x + CANDLE_WIDTH / 2, yHigh);
      ctx.lineTo(x + CANDLE_WIDTH / 2, yLow);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // body (rounded)
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(Math.abs(yClose - yOpen), 2);
      ctx.fillStyle = color;

      // Removed rounded rect for stricter brutalist feel
      ctx.fillRect(x, bodyTop, CANDLE_WIDTH - 2, bodyHeight);

      // Add border to candles
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, bodyTop, CANDLE_WIDTH - 2, bodyHeight);

      lastValue = val;
    }

    // --- draw marker for buy/sell points ---
    const drawTradeMarker = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      type: "buy" | "sell",
      label: string
    ) => {
      ctx.save();
      ctx.beginPath();

      if (type === "buy") {
        ctx.fillStyle = "#22c55e"; // green
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x - 6, y + 6);
        ctx.lineTo(x + 6, y + 6);
      } else {
        ctx.fillStyle = "#ef4444"; // red
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x - 6, y - 6);
        ctx.lineTo(x + 6, y - 6);
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Add outline

      // label
      ctx.font = "bold 10px 'JetBrains Mono'";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(label, x, type === "buy" ? y + 10 : y - 20);

      ctx.restore();
    };

    // Adding Marker
    // --- draw trade markers for user trades ---
    const trades = allUserTrades || [];

    trades.forEach((trade: any) => {
      const { buy, sell, userId } = trade;
      // find approximate candle X position
      const buyIndex = data.findIndex((d) => d >= buy);
      const sellIndex = data.findIndex((d) => d >= sell);
      const markerLabel = userId ? userId.toString().slice(0, 4) : "";

      if (buy) {
        const x =
          LEFT_PADDING +
          (buyIndex >= 0 ? buyIndex : visibleData.length - 1) *
          (CANDLE_WIDTH + GAP) +
          CANDLE_WIDTH / 2;
        const y = scaleY(buy);
        drawTradeMarker(ctx, x, y, "buy", markerLabel);
      }

      if (sell) {
        const x =
          LEFT_PADDING +
          (sellIndex >= 0 ? sellIndex : visibleData.length) *
          (CANDLE_WIDTH + GAP) +
          CANDLE_WIDTH / 2;
        const y = scaleY(sell);
        drawTradeMarker(ctx, x, y, "sell", markerLabel);
      }
    });

    // Forming candle (animated growth from lastValue -> current)
    const formingX = LEFT_PADDING + visibleData.length * (CANDLE_WIDTH + GAP);
    const formingOpen = lastValue;
    const formingClose = current;
    const formingHigh = Math.max(formingOpen, formingClose);
    const formingLow = Math.min(formingOpen, formingClose);

    // wick
    ctx.beginPath();
    ctx.moveTo(formingX + CANDLE_WIDTH / 2, scaleY(formingHigh));
    ctx.lineTo(formingX + CANDLE_WIDTH / 2, scaleY(formingLow));
    ctx.strokeStyle = formingClose >= formingOpen ? "#22c55e" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();

    // animate body growth for forming candle: interpolate between prev close and current
    const prevCloseY = scaleY(formingOpen);
    const targetCloseY = scaleY(formingClose);
    const animY = prevCloseY + (targetCloseY - prevCloseY) * 0.22;
    const bodyTopForm = Math.min(prevCloseY, animY);
    const bodyHForm = Math.max(Math.abs(animY - prevCloseY), 2);

    ctx.fillStyle = formingClose >= formingOpen ? "#22c55e" : "#ef4444";
    ctx.fillRect(formingX, bodyTopForm, CANDLE_WIDTH - 2, bodyHForm);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(formingX, bodyTopForm, CANDLE_WIDTH - 2, bodyHForm);

    // --- Fluid curve over points (Bezier) ---
    const centersX: number[] = [];
    const centersY: number[] = [];
    for (let i = 0; i < visibleData.length; i++) {
      const cx = LEFT_PADDING + i * (CANDLE_WIDTH + GAP) + CANDLE_WIDTH / 2;
      centersX.push(cx);
      centersY.push(scaleY(visibleData[i]));
    }
    const formingCenterX =
      LEFT_PADDING +
      visibleData.length * (CANDLE_WIDTH + GAP) +
      CANDLE_WIDTH / 2;
    centersX.push(formingCenterX);
    centersY.push(scaleY(current));

    if (centersX.length > 1) {
      ctx.beginPath();
      ctx.moveTo(centersX[0], centersY[0]);
      for (let i = 1; i < centersX.length; i++) {
        const prevX = centersX[i - 1];
        const prevY = centersY[i - 1];
        const currX = centersX[i];
        const currY = centersY[i];
        const cpX = (prevX + currX) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, currY, currX, currY);
      }
      ctx.strokeStyle = "rgba(250, 204, 21, 0.3)"; // Faint Yellow
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // --- Dotted line and label (label sits to right of last candle) ---
    const yCurrent = scaleY(current);
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(LEFT_PADDING, yCurrent);
    ctx.lineTo(width, yCurrent);
    ctx.strokeStyle = "#facc15"; // Yellow
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // label next to the active forming candle (clamped)
    const label = `${current.toFixed(3)}x`;
    ctx.font = "bold 20px 'JetBrains Mono'";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    const estX = Math.min(
      LEFT_PADDING +
      visibleData.length * (CANDLE_WIDTH + GAP) +
      CANDLE_WIDTH +
      8,
      width - 12 - ctx.measureText(label).width
    );

    const textWidth = ctx.measureText(label).width;
    // Box background for text
    ctx.fillStyle = "#facc15";
    ctx.fillRect(estX - 4, yCurrent - 14, textWidth + 8, 28);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(estX - 4, yCurrent - 14, textWidth + 8, 28);

    ctx.fillStyle = "#000000";
    ctx.fillText(label, estX, yCurrent);
  }, [gameState]);

  const animationStarted = useRef(false);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      drawChart();
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      animationStarted.current = false; // allow restart on real unmount
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return; // ensure browser only

    if (wallet.address) {
      localStorage.setItem("userId", wallet.address);
      setUserId(wallet.address);
    } else {
      localStorage.setItem("userId", "guest");
      setUserId("guest");
    }
  }, [wallet.address]); // runs when wallet changes

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const updateCanvasSize = () => {
      // Get the actual display size of the canvas
      const rect = container.getBoundingClientRect();

      // Set the canvas internal resolution
      // Use devicePixelRatio for sharp rendering on high-DPI displays
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale the canvas context to match the device pixel ratio
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      // Redraw your canvas content here after resizing
      // For example: drawChart();
    };

    // Initial size
    updateCanvasSize();

    // Create ResizeObserver to watch for container size changes
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });

    resizeObserver.observe(container);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="h-screen bg-zinc-950 font-sans text-zinc-200 selection:bg-yellow-400 selection:text-black flex flex-col overflow-hidden ">
      <ConnectionStatus wsState={connectionState} />
      <DebugPanel />
      <NeoNavbar />
      {/* 2. MAIN LAYOUT (Sidebar + Content) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Chat Sidebar (Fixed/Visible on lg screens) */}
        <aside className="hidden lg:flex w-80 xl:w-96 flex-col border-r-4 border-yellow-400 bg-zinc-950 shrink-0">
          <NeoChatSidebar
            // @ts-ignore
            globalChats={globalChats}
            // @ts-ignore
            setGlobalChats={setGlobalChats}
            wsRef={wsRef}
          />
        </aside>

        {/* RIGHT: Scrollable Content Area */}
        <main className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden">
          <div className="flex-1 p-4 md:p-6 pb-48 w-full max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-6">
            {/* Center Column: Chart & Stats */}
            <div className="flex-1 flex flex-col gap-6 w-full min-w-0">
              {/* Mobile/Tablet Header Stats */}
              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  {latency !== null && (
                    <div
                      className={cn(
                        "flex items-center gap-2 px-2 py-1 font-mono text-[10px] sm:text-xs font-bold border-2 bg-zinc-900 uppercase shadow-[2px_2px_0px_0px_#000]",
                        latency < 50
                          ? "border-green-500 text-green-500"
                          : latency < 100
                            ? "border-yellow-500 text-yellow-500"
                            : "border-red-500 text-red-500"
                      )}
                    >
                      <Wifi size={12} strokeWidth={3} /> {latency}ms
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-2 py-1 font-mono text-[10px] sm:text-xs font-bold border-2 border-zinc-700 bg-zinc-900 text-zinc-400 uppercase shadow-[2px_2px_0px_0px_#000]">
                    <Users size={12} strokeWidth={3} />{" "}
                    <span className="text-white">{clientsConnected}</span>
                  </div>
                </div>

                {/* Mobile Chat Trigger */}
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="lg:hidden bg-yellow-400 text-black p-2 border-2 border-black shadow-[2px_2px_0px_0px_#000] active:translate-y-[1px] active:shadow-none">
                      <Send size={18} />
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="p-0 w-[85vw] sm:w-[400px] border-r-4 border-yellow-400 bg-zinc-950"
                  >
                    <NeoChatSidebar
                      // @ts-ignore
                      globalChats={globalChats}
                      // @ts-ignore
                      setGlobalChats={setGlobalChats}
                      wsRef={wsRef}
                      className="h-full"
                    />
                  </SheetContent>
                </Sheet>
              </div>

              {/* Chart */}
              <div className="relative w-full group">
                <div className="absolute -top-3 left-4 z-10 bg-zinc-950 px-3 py-0.5 text-xs font-mono font-bold text-zinc-500 border-2 border-zinc-800 group-hover:border-yellow-400 group-hover:text-yellow-400 transition-colors">
                  {TOKEN_DISPLAY.symbol}/USD
                </div>
                <div
                  ref={containerRef}
                  className={cn(
                    "w-full h-[40vh] min-h-[300px] md:h-[50vh] bg-zinc-900 border-4 border-zinc-800 relative overflow-hidden",
                    "shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]"
                  )}
                >
                  <canvas ref={canvasRef} className="w-full h-full block" />
                </div>
              </div>
            </div>

            {/* Right/Bottom Column: Leaderboard (Stacks below on mobile, Side on XL) */}
            <div className="w-full xl:w-[400px] shrink-0">
              {prevGameRef && previousGames && (
                <NeoLeaderboardSection
                  // @ts-ignore
                  allUserTrades={allUserTrades}
                  previousGames={previousGames}
                  prevGameRef={true}
                />
              )}
            </div>
          </div>

          {/* 3. STICKY FOOTER: Bet Interface */}
          <div className="sticky bottom-0 left-0 right-0 z-30 w-full mt-auto">
            {/* Gradient overlay to fade content behind */}
            <div className="absolute -top-12 left-0 w-full h-12 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />

            <NeoBetInterface
              currentMultiplier={animatedMultiplierRef.current}
              setBalance={setBalance}
              amount={internalAmount}
              setAmount={setInternalAmount}
              balance={balance ?? 0}
              setAutoSellAmount={setAutoSellAmount}
              autosell={autoSellAmount}
              isApplied={isApplied}
              setisApplied={setisApplied}
              wsRef={wsRef}
              publicKey={wallet.address}
              gameState={gameState}
              currentMultiplierRef={animatedMultiplierRef}
              userHasBet={userHasBet}
              onTrade={refetch}
              className="w-full max-w-none shadow-none"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
