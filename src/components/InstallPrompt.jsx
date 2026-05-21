import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed?
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (isStandalone) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      setVisible(true);
      return;
    }

    // Desktop Chrome/Edge and Android Chrome
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setVisible(false);
        setDeferredPrompt(null);
      }
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  if (!visible || dismissed) return null;

  return (
    <>
      {/* Floating FAB */}
      <div className="fixed bottom-24 right-4 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button
          onClick={handleDismiss}
          className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-md hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-90 transition-all"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={handleInstall}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-200/50 hover:bg-emerald-700 active:scale-95 transition-all font-bold text-sm"
        >
          <Download className="w-4 h-4" />
          Install App
        </button>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Install on iOS</h3>
              <button onClick={() => setShowIOSModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-500">Follow these steps to add this app to your home screen:</p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">1</div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Tap the Share button</p>
                  <p className="text-xs text-slate-500">In Safari's toolbar at the bottom</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">2</div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Scroll and tap "Add to Home Screen"</p>
                  <p className="text-xs text-slate-500">Look for the plus icon</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">3</div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Tap "Add"</p>
                  <p className="text-xs text-slate-500">The app will appear on your home screen</p>
                </div>
              </div>
            </div>
            <button onClick={() => setShowIOSModal(false)} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-95 transition-all">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
