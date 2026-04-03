import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';

export function BroadcastBanner() {
  const [broadcast, setBroadcast] = useState<{ message: string; active: boolean; type: string } | null>(null);

  useEffect(() => {
    const pollState = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/state`);
        const data = await res.json();
        if (data.broadcast && data.broadcast.active) {
          setBroadcast(data.broadcast);
        } else {
          setBroadcast(null);
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    pollState();
    const interval = setInterval(pollState, 1500); // Super fast realtime polling for demo

    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async () => {
    setBroadcast(null);
    try {
      await fetch('http://localhost:3000/api/admin/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcast: null })
      });
    } catch(e) {}
  };

  if (!broadcast || !broadcast.active) {
    return null;
  }

  const isSevere = broadcast.type === 'Severe Weather Warning (Fog/Heavy Rain)' || broadcast.type === 'Major Accident Ahead - Corridors Blocked';

  return (
    <div className={`w-full z-[100] px-4 py-3 flex items-center justify-between text-white shadow-glow-emergency animate-slide-up sticky top-0 ${isSevere ? 'bg-destructive' : 'bg-primary'}`}>
      <div className="flex items-center gap-3 w-full max-w-7xl mx-auto flex-1">
        <AlertTriangle className="w-6 h-6 animate-pulse flex-shrink-0" />
        <p className="font-bold text-sm sm:text-base md:text-lg tracking-wide">
          <span className="opacity-80 uppercase mr-2">[GOVT ALERT]</span> 
          {broadcast.message}
        </p>
      </div>
      <button 
        onClick={handleDismiss} 
        className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0 ml-4"
        title="Dismiss Alert"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
