import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { api } from '../../api/client.js';

export const ConnectionStatusBar: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  const checkConnectivity = async () => {
    setIsReconnecting(true);
    try {
      await api.get('/auth/me');
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    } finally {
      setIsReconnecting(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      checkConnectivity();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleConnectionLost = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pos:connection-lost', handleConnectionLost);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pos:connection-lost', handleConnectionLost);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-rose-600 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-lg shrink-0 z-50 animate-in slide-in-from-top duration-200">
      <div className="flex items-center space-x-2">
        <WifiOff className="w-4 h-4 text-amber-200 animate-pulse shrink-0" />
        <span>
          <strong>Internet Connection Lost:</strong> This is an online-only SaaS POS. Central server communication is paused until connection is restored.
        </span>
      </div>
      <button
        onClick={checkConnectivity}
        disabled={isReconnecting}
        className="px-3 py-1 bg-white text-rose-700 hover:bg-slate-100 rounded text-xs font-bold transition flex items-center space-x-1 shadow-sm shrink-0 ml-3"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
        <span>{isReconnecting ? 'Reconnecting...' : 'Retry Connection'}</span>
      </button>
    </div>
  );
};

