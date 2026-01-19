import React, {
  useState,
  useRef,
  useEffect,
  RefObject,
  Dispatch,
  SetStateAction,
} from "react";
import { motion } from "framer-motion";
import { MessageSquare, Send, User, ChevronLeft } from "lucide-react";
import { useUserInformation } from "../hooks/userInfo";
import { cn } from "@/lib/utils";
import { useEvmWallet } from "../hooks/evmWallet";

// --- Types ---
type ChatMessage = {
  username: string;
  message: string;
  self: boolean;
  timestamp?: number;
};

interface NeoChatSidebarProps {
  wsRef?: RefObject<WebSocket | null>;
  globalChats: ChatMessage[];
  setGlobalChats: Dispatch<SetStateAction<ChatMessage[]>>;
  className?: string; // Allow custom classes for positioning context
}

export const NeoChatSidebar: React.FC<NeoChatSidebarProps> = ({
  wsRef,
  globalChats,
  setGlobalChats,
  className,
}) => {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Real Hooks
  const { address } = useEvmWallet();
  const { userName } = useUserInformation();
  const actualUsername = userName || "guest";

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [globalChats]);

  const handleSend = () => {
    const value = text.trim();
    if (!value) return;

    const msg: ChatMessage = {
      username: actualUsername,
      message: value,
      self: true,
      timestamp: Date.now(),
    };

    if (inputRef.current) {
      inputRef.current.focus();
    }

    setGlobalChats((prev) => [...prev, msg]);
    setText("");

    if (wsRef?.current) {
      wsRef.current.send(JSON.stringify({ type: "global-chat", chats: msg }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && address) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full bg-zinc-950 font-mono overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="bg-yellow-400 border-b-4 border-black p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-black text-yellow-400 p-1.5 shadow-[2px_2px_0px_0px_#000]">
            <MessageSquare size={18} strokeWidth={3} />
          </div>
          <h2 className="font-black text-black uppercase text-lg tracking-tight">
            Trollbox
          </h2>
        </div>
      </div>

      {/* Live Indicator Bar */}
      <div className="bg-zinc-900 border-b-2 border-zinc-800 px-4 py-1 flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-widest shrink-0">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span>{globalChats.length + 420} Online</span>
        </div>
        <span>v2.0.4</span>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950 scrollbar-thin scrollbar-thumb-yellow-400 scrollbar-track-zinc-900"
      >
        {globalChats.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-2 opacity-50">
            <MessageSquare size={48} />
            <p>No signals yet...</p>
          </div>
        )}

        {globalChats.map((chat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex flex-col gap-1 max-w-[90%]",
              chat.self ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase font-bold">
              {!chat.self && <User size={10} />}
              <span>{chat.username}</span>
              {chat.timestamp && (
                <span>
                  {new Date(chat.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>

            <div
              className={cn(
                "relative px-4 py-3 border-2 text-sm break-words shadow-[4px_4px_0px_0px_#000]",
                chat.self
                  ? "bg-yellow-400 border-yellow-400 text-black"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300"
              )}
            >
              {/* Bubble tail */}
              <div
                className={cn(
                  "absolute w-3 h-3 border-2 border-inherit bg-inherit rotate-45 top-3",
                  chat.self
                    ? "-right-2 border-l-0 border-b-0"
                    : "-left-2 border-r-0 border-t-0"
                )}
              />

              {chat.message}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-900 border-t-4 border-yellow-400 shrink-0 space-y-3">
        {!address ? (
          <div className="bg-red-500/10 border-2 border-red-500 border-dashed p-3 text-center">
            <p className="text-red-500 text-xs font-bold mb-2 uppercase">
              Wallet Disconnected
            </p>
            <div className="text-[10px] text-zinc-400">
              Please connect wallet to chat
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute -top-3 left-2 bg-zinc-900 px-1 text-[10px] text-yellow-400 font-bold uppercase">
              Message as {actualUsername}
            </div>
            <div className="flex gap-0">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type signal..."
                className="flex-1 bg-zinc-950 text-white font-mono px-4 py-3 outline-none border-2 border-zinc-700 focus:border-yellow-400 placeholder:text-zinc-700 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className={cn(
                  "bg-yellow-400 text-black px-4 border-2 border-l-0 border-yellow-400 hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center"
                )}
              >
                <Send size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
