'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface ConnectionStatusProps {
  wsState?: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export function ConnectionStatus({ wsState }: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show if everything is fine
  if (isOnline && wsState === 'connected') return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${
          wsState === 'connected' && isOnline
            ? 'bg-green-500/20 border border-green-500/50'
            : wsState === 'connecting'
            ? 'bg-yellow-500/20 border border-yellow-500/50'
            : 'bg-red-500/20 border border-red-500/50'
        }`}
      >
        {wsState === 'connecting' ? (
          <>
            <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />
            <span className="text-sm text-yellow-400">Connecting...</span>
          </>
        ) : wsState === 'connected' && isOnline ? (
          <>
            <Wifi className="h-4 w-4 text-green-400" />
            <span className="text-sm text-green-400">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-400" />
            <span className="text-sm text-red-400">
              {!isOnline ? 'No Internet' : 'Server Offline'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
