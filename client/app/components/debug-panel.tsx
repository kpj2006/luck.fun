'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Info } from 'lucide-react';
import { getWebSocketUrl } from '@/constants/constants';

export function DebugPanel() {
  const [show, setShow] = useState(false);
  const [info, setInfo] = useState({
    hostname: '',
    wsUrl: '',
    userAgent: '',
    online: true,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setInfo({
        hostname: window.location.hostname,
        wsUrl: getWebSocketUrl(),
        userAgent: navigator.userAgent,
        online: navigator.onLine,
      });
    }
  }, []);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 left-4 z-50 p-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg"
        title="Show debug info"
      >
        <Info className="h-4 w-4 text-zinc-400" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-4 md:right-auto md:max-w-md z-50 bg-zinc-900 border-2 border-zinc-700 rounded-lg p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-zinc-100">Debug Info</h3>
        <button onClick={() => setShow(false)} className="text-zinc-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 text-xs font-mono">
        <div>
          <div className="text-zinc-500">Hostname:</div>
          <div className="text-green-400 break-all">{info.hostname}</div>
        </div>

        <div>
          <div className="text-zinc-500">WebSocket URL:</div>
          <div className="text-green-400 break-all">{info.wsUrl}</div>
        </div>

        <div>
          <div className="text-zinc-500">Online:</div>
          <div className={info.online ? 'text-green-400' : 'text-red-400'}>
            {info.online ? 'Yes' : 'No'}
          </div>
        </div>

        <div>
          <div className="text-zinc-500">Device:</div>
          <div className="text-zinc-300 break-all line-clamp-2">{info.userAgent}</div>
        </div>

        <div className="pt-2 border-t border-zinc-700">
          <div className="text-zinc-500 mb-1">Expected Backend:</div>
          <div className="text-yellow-400 break-all">
            http://{info.hostname}:8080
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-700">
        <Button
          onClick={() => window.location.reload()}
          size="sm"
          className="w-full bg-green-500 hover:bg-green-600 text-black"
        >
          Reload Page
        </Button>
      </div>
    </div>
  );
}
