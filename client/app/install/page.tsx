'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Download, Copy, Check } from 'lucide-react';
import { analyticsEvents } from '@/lib/analytics';

export default function InstallPage() {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    // Get the current URL
    const currentUrl = window.location.origin;
    setUrl(currentUrl);
    
    // Generate QR code using a free API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentUrl)}`;
    setQrCodeUrl(qrUrl);
    
    analyticsEvents.trackPageView('install');
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      analyticsEvents.trackShare('copy_link');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Rugs.fun - On-chain Trading Game',
          text: 'Check out Rugs.fun! The ultimate on-chain crash game for degens.',
          url: url,
        });
        analyticsEvents.trackShare('native_share');
      } catch (err) {
        console.error('Share failed:', err);
      }
    }
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = 'rugs-fun-qr-code.png';
    link.click();
    analyticsEvents.trackShare('download_qr');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-block p-4 bg-green-500/20 rounded-full mb-4">
              <Download className="h-12 w-12 text-green-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              Install Rugs.fun
            </h1>
            <p className="text-lg text-gray-300 mb-2">
              Get the app on your phone in seconds!
            </p>
            <p className="text-sm text-gray-400">
              Trade, risk, and cash out before it rugs 🚀
            </p>
          </div>

          {/* QR Code Section */}
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-8 mb-8 text-center">
            <h2 className="text-2xl font-semibold mb-6">Scan to Install</h2>
            
            {qrCodeUrl && (
              <div className="bg-white p-4 rounded-xl inline-block mb-6">
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code for Rugs.fun" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
            )}
            
            <p className="text-gray-400 text-sm mb-4">
              Scan with your phone camera to open the app
            </p>
            
            <Button
              onClick={handleDownloadQR}
              variant="outline"
              className="border-green-500/50 hover:bg-green-500/10"
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR Code
            </Button>
          </div>

          {/* Instructions */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-lg border border-green-500/20 rounded-xl p-6">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-semibold mb-2">iOS Installation</h3>
              <ol className="text-sm text-gray-300 space-y-2">
                <li>1. Open in Safari</li>
                <li>2. Tap share button</li>
                <li>3. Select "Add to Home Screen"</li>
                <li>4. Tap "Add"</li>
              </ol>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-lg border border-green-500/20 rounded-xl p-6">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="font-semibold mb-2">Android Installation</h3>
              <ol className="text-sm text-gray-300 space-y-2">
                <li>1. Open in Chrome</li>
                <li>2. Tap menu (⋮)</li>
                <li>3. Select "Install app"</li>
                <li>4. Tap "Install"</li>
              </ol>
            </div>
          </div>

          {/* Share Section */}
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6 mb-8">
            <h3 className="font-semibold mb-4 text-center">Share with Others</h3>
            
            <div className="flex items-center gap-2 bg-black/30 rounded-lg p-3 mb-4">
              <input
                type="text"
                value={url}
                readOnly
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <Button
                onClick={handleCopyLink}
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-black"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {navigator.share && (
              <Button
                onClick={handleNativeShare}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-black font-semibold"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share App
              </Button>
            )}
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <p className="text-sm text-gray-300">Lightning Fast</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔒</div>
              <p className="text-sm text-gray-300">Secure Wallet</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📴</div>
              <p className="text-sm text-gray-300">Works Offline</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🎮</div>
              <p className="text-sm text-gray-300">Play Anywhere</p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <a href="/">
              <Button
                size="lg"
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-black font-bold text-lg px-8"
              >
                Open App Now
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
