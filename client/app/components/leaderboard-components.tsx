import React, { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  History,
  Hash,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---
export interface Trade {
  id: number;
  buy: number;
  buy_amount: number;
  userId: string;
  sell?: number;
  sell_amount?: number;
}

export interface UserTrades {
  userId: string;
  trades: Trade[];
}

export interface Tick {
  time: number;
  value: number;
}

export interface GameResult {
  id: number;
  crashedAt: number;
  ticks: Tick[];
}

interface NeoLeaderboardSectionProps {
  allUserTrades?: UserTrades[];
  previousGames?: GameResult[];
  prevGameRef?: boolean;
}

// --- Internal Mock Components (Styled) ---

const LeaderboardTable = ({ data }: { data: UserTrades[] }) => {
  console.log("LeaderboardTable data:", data);

  // Flatten all trades from all users into a single array with user info
  const allTrades = data.flatMap((userTrade) =>
    userTrade.trades.map((trade) => {
      // Calculate PnL: (sell_multiplier * original_amount) - original_amount
      // If sell exists, the profit/loss is based on the multiplier
      let pnlValue = 0;
      let isWin = false;

      if (trade.sell && trade.sell > 0) {
        // PnL = (multiplier * buy_amount) - buy_amount
        // Or simplified: buy_amount * (multiplier - 1)
        pnlValue = trade.buy_amount * (trade.sell - 1);
        isWin = trade.sell > 1;
      }

      return {
        ...trade,
        user: userTrade.userId,
        pnl: pnlValue.toFixed(2),
        isWin: isWin,
        amount: trade.buy_amount.toLocaleString(),
      };
    })
  );

  // Sort by absolute PnL (biggest wins/losses first)
  const sortedTrades = allTrades.sort(
    (a, b) => Math.abs(parseFloat(b.pnl)) - Math.abs(parseFloat(a.pnl))
  );

  console.log("Processed trades:", sortedTrades);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Table Header */}
      <div className="flex items-center px-4 py-2 bg-zinc-900 border-b-4 border-yellow-400 text-xs font-mono text-zinc-500 uppercase tracking-wider">
        <div className="w-12">Rank</div>
        <div className="flex-1">Participant</div>
        <div className="w-24 text-right">Wager</div>
        <div className="w-24 text-right">PnL</div>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2 mt-2">
        {sortedTrades.map((trade: any, i: number) => (
          <motion.div
            key={`${trade.user}-${trade.id}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "group relative flex items-center px-4 py-3 border-2 border-zinc-800 bg-zinc-950 transition-all hover:-translate-y-1",
              "hover:border-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(250,204,21,1)]"
            )}
          >
            {/* Rank */}
            <div className="w-12 font-black text-zinc-600 group-hover:text-yellow-400 transition-colors">
              #{i + 1}
            </div>

            {/* User */}
            <div className="flex-1 font-mono text-sm text-zinc-300">
              {trade.user.slice(0, 8)}...{trade.user.slice(-4)}
            </div>

            {/* Amount */}
            <div className="w-24 text-right font-mono text-sm text-zinc-500">
              {trade.amount}
            </div>

            {/* PnL */}
            <div
              className={cn(
                "w-24 text-right font-mono font-bold flex items-center justify-end gap-1",
                trade.isWin ? "text-green-400" : "text-red-500"
              )}
            >
              {trade.isWin ? "+" : ""}
              {trade.pnl}
              {trade.isWin ? (
                <TrendingUp size={14} />
              ) : (
                <TrendingDown size={14} />
              )}
            </div>
          </motion.div>
        ))}

        {sortedTrades.length === 0 && (
          <div className="text-center py-8 text-zinc-600 font-mono text-sm border-2 border-dashed border-zinc-800">
            NO RECENT TRADES
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryPrevGames = ({ gameData }: { gameData: GameResult[] }) => {
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-3">
        {gameData.map((game, i) => {
          // Logic to determine display value: Last tick before the crash (0 value)
          // Fallback to 0 if ticks are missing
          const relevantTick =
            game.ticks.length > 1
              ? game.ticks[game.ticks.length - 2]
              : game.ticks[0];
          const val = relevantTick ? relevantTick.value : 0;
          const isPositive = val >= 1.0;

          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "relative h-14 min-w-[4rem] px-3 flex flex-col items-center justify-center border-2 bg-zinc-900",
                "transition-all hover:scale-105 cursor-help group",
                isPositive
                  ? "border-green-500/50 hover:border-green-500 shadow-[4px_4px_0px_0px_rgba(34,197,94,0.2)] hover:shadow-[4px_4px_0px_0px_rgba(34,197,94,1)]"
                  : "border-red-500/50 hover:border-red-500 shadow-[4px_4px_0px_0px_rgba(239,68,68,0.2)] hover:shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]"
              )}
              title={`Game ID: ${game.id}`}
            >
              <span
                className={cn(
                  "font-mono font-bold text-lg leading-none",
                  isPositive ? "text-green-400" : "text-red-500"
                )}
              >
                {val.toFixed(2)}x
              </span>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 group-hover:text-zinc-300">
                #{String(game.id).slice(-4)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// --- Main Component ---

export const NeoLeaderboardSection: React.FC<NeoLeaderboardSectionProps> = ({
  allUserTrades = [],
  previousGames = [],
  prevGameRef = true,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full hidden 2xl:fixed right-5 max-w-[400px] mx-auto p-4 md:p-0 xl:flex flex-col gap-12"
    >
      {/* 1. Leaderboard Section */}
      <div className="w-full">
        {/* Header Block */}
        <header className="mb-6 flex items-end gap-4 border-b-4 border-zinc-800 pb-4">
          <div className="bg-yellow-400 p-3 border-2 border-black shadow-[4px_4px_0px_0px_#FFF]">
            <Trophy size={32} className="text-black" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
              Leaderboard
            </h1>
            <p className="text-sm font-mono text-yellow-500 font-bold mt-1">
              Top Degens & Live Action
            </p>
          </div>
        </header>

        {/* Content Box */}
        <div className="bg-zinc-950 p-1">
          <LeaderboardTable data={allUserTrades} />
        </div>
      </div>

      {/* 2. History Section (Stacked Vertically below) */}
      {prevGameRef && previousGames.length > 0 && (
        <div className="w-full flex flex-col gap-4">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-2 border-b-2 border-zinc-800 text-zinc-500">
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-yellow-400" />
              <span className="font-mono text-sm font-bold uppercase text-white">
                Recent Rounds
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </div>
          </div>

          {/* Brutalist Container for Games */}
          <div
            className={cn(
              "p-6 bg-zinc-900/30 border-2 border-dashed border-zinc-800",
              "hover:border-yellow-400/30 transition-colors"
            )}
          >
            <SummaryPrevGames gameData={previousGames} />
          </div>
        </div>
      )}
    </motion.div>
  );
};
