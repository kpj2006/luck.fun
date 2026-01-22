'use client';

import { track } from '@vercel/analytics';

export const analyticsEvents = {
  // PWA Installation tracking
  trackPWAInstall: () => {
    track('pwa_install');
  },
  
  trackPWAPromptShown: () => {
    track('pwa_prompt_shown');
  },
  
  trackPWAPromptAccepted: () => {
    track('pwa_prompt_accepted');
  },
  
  trackPWAPromptDismissed: () => {
    track('pwa_prompt_dismissed');
  },
  
  // Wallet tracking
  trackWalletConnect: (walletType: string) => {
    track('wallet_connect', { walletType });
  },
  
  trackWalletDisconnect: () => {
    track('wallet_disconnect');
  },
  
  // Game actions
  trackGameStart: () => {
    track('game_start');
  },
  
  trackTransaction: (type: 'buy' | 'sell', amount: string) => {
    track('transaction', { type, amount });
  },
  
  // Page views
  trackPageView: (page: string) => {
    track('page_view', { page });
  },
  
  // Engagement
  trackShare: (method: string) => {
    track('share', { method });
  },
};

// Hook to track PWA installation
export function usePWAInstallTracking() {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', () => {
      analyticsEvents.trackPWAPromptShown();
    });
    
    window.addEventListener('appinstalled', () => {
      analyticsEvents.trackPWAInstall();
    });
  }
}
