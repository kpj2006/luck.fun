'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { analyticsEvents } from '@/lib/analytics';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return; // Already installed
    }

    // Check if user already dismissed
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after 10 seconds on the page
      setTimeout(() => {
        setShowPrompt(true);
      }, 10000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      analyticsEvents.trackPWAPromptAccepted();
    } else {
      analyticsEvents.trackPWAPromptDismissed();
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
    analyticsEvents.trackPWAPromptDismissed();
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-fade-in">
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-lg border border-green-500/20 rounded-lg p-4 shadow-2xl">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Download className="h-5 w-5 text-green-400" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">
              Install Rugs.fun
            </h3>
            <p className="text-sm text-gray-300 mb-3">
              Get the app for faster access and offline support!
            </p>
            
            <Button
              onClick={handleInstall}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold"
            >
              Install App
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
