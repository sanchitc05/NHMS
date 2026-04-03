import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import {
  Gauge,
  AlertTriangle,
  Phone,
  Car,
  Truck,
  Bike,
  MapPin,
  Volume2,
  VolumeX,
  RotateCcw,
  Navigation,
  Satellite,
  ArrowLeft,
  ShieldAlert,
  Bell,
  BellRing,
  PhoneCall,
  Timer,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { SpeedData, VehicleType } from '@/types';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import { LiveLocationMap } from '@/components/features/LiveLocationMap';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Road types and their descriptions for UI (icons/styling)
const roadTypeInfo: Record<string, { label: string; icon: string }> = {
  motorway: { label: 'Motorway', icon: '🛣️' },
  trunk: { label: 'Highway', icon: '🛣️' },
  primary: { label: 'Main Road', icon: '📍' },
  secondary: { label: 'Secondary Road', icon: '📍' },
  residential: { label: 'Residential', icon: '🏠' },
  unclassified: { label: 'Standard Road', icon: '🚗' },
};

type VehicleCategory = 'car' | 'motorcycle' | 'truck';

const vehicleIcons: Record<VehicleCategory, typeof Car> = {
  car: Car,
  motorcycle: Bike,
  truck: Truck,
};

const vehicleLabels: Record<VehicleCategory, string> = {
  car: 'Car',
  motorcycle: 'Two Wheeler',
  truck: 'Truck',
};

// Warning stages configuration
interface WarningStage {
  label: string;
  description: string;
  icon: typeof Bell;
  color: string;
}

const warningStages: WarningStage[] = [
  {
    label: '1st Warning',
    description: 'You are exceeding the speed limit! Please slow down.',
    icon: Bell,
    color: 'text-warning',
  },
  {
    label: '2nd Warning',
    description: 'You are STILL overspeeding! Reduce speed immediately.',
    icon: BellRing,
    color: 'text-emergency',
  },
  {
    label: '3rd Warning — Auto Calling 1033',
    description: 'Final warning! Emergency services are being contacted now.',
    icon: PhoneCall,
    color: 'text-destructive',
  },
];

export default function SpeedMonitor() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  // Core state
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleCategory>('car');
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [useRealLocation, setUseRealLocation] = useState(true);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  // Speed state
  const [speedData, setSpeedData] = useState<SpeedData>({
    currentSpeed: 0,
    speedLimit: 120,
    isOverspeeding: false,
    warningCount: 0,
    location: 'Expressway - Normal',
  });

  // Warning escalation state
  const [warningLevel, setWarningLevel] = useState(0); // 0 = none, 1 = first ring, 2 = second ring, 3 = third ring + call
  const [overspeedStartTime, setOverspeedStartTime] = useState<number | null>(null);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [activeWarningMessage, setActiveWarningMessage] = useState('');
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [emergencyCallTriggered, setEmergencyCallTriggered] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState<number | null>(null);
  const [roadName, setRoadName] = useState('Detecting road...');
  const [isLoadingSpeedLimit, setIsLoadingSpeedLimit] = useState(false);
  const lastFetchedCoords = useRef<{ lat: number; lon: number } | null>(null);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Refs for logging to avoid useCallback dependency thrashing
  const latestSpeedRef = useRef(0);
  const latestLimitRef = useRef(120);
  const latestRoadRef = useRef('');

  // Global override state
  const [globalSpeedOverride, setGlobalSpeedOverride] = useState<number | null>(null);

  useEffect(() => {
    const pollState = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/admin/state');
        const data = await res.json();
        if (data.speedLimit) {
          setGlobalSpeedOverride(data.speedLimit);
        } else {
          setGlobalSpeedOverride(null);
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    pollState();
    const interval = setInterval(pollState, 1500); // Super fast realtime polling for demo
    return () => clearInterval(interval);
  }, []);

  const {
    location: liveLocation,
    error: locationError,
    isTracking,
    startTracking,
    stopTracking,
    locationHistory,
  } = useLiveLocation();

  // Derived speed limit
  const baseLimit = globalSpeedOverride !== null ? globalSpeedOverride : speedData.speedLimit;
  const currentSpeedLimit = baseLimit;

  // Get speed from GPS or simulation
  const displaySpeed =
    useRealLocation && liveLocation && liveLocation.speed !== null
      ? Math.round(liveLocation.speed * 3.6)
      : speedData.currentSpeed;

  const isCurrentlyOverspeeding = displaySpeed > currentSpeedLimit;

  // Update refs
  useEffect(() => {
    latestSpeedRef.current = displaySpeed;
    latestLimitRef.current = currentSpeedLimit;
    latestRoadRef.current = roadName;
  }, [displaySpeed, currentSpeedLimit, roadName]);

  // ── Audio Warning System ───────────────────────────────────────
  const playWarningBeep = useCallback(
    (level: number) => {
      if (!soundEnabled) return;

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        }

        const ctx = audioContextRef.current;
        const now = ctx.currentTime;

        // Prolonged beep patterns per warning level (approx 4-5 seconds)
        const beepConfigs = [
          // Level 1: Repeated warning beep for ~4.5 seconds
          Array.from({ length: 5 }, (_, i) => ({ freq: 880, start: i * 0.9, dur: 0.6 })),
          // Level 2: Urgent repeated beep for ~4.5 seconds
          Array.from({ length: 8 }, (_, i) => ({ freq: 1100, start: i * 0.6, dur: 0.4 })),
          // Level 3: Rapid alarm beep for ~5 seconds
          Array.from({ length: 15 }, (_, i) => ({ freq: i % 2 === 0 ? 1400 : 1800, start: i * 0.35, dur: 0.25 })),
        ];

        const beeps = beepConfigs[Math.min(level - 1, 2)];

        beeps.forEach(({ freq, start, dur }) => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          oscillator.type = level >= 3 ? 'sawtooth' : 'sine';
          oscillator.frequency.setValueAtTime(freq, now + start);

          gainNode.gain.setValueAtTime(0, now + start);
          gainNode.gain.linearRampToValueAtTime(0.5, now + start + 0.02);
          gainNode.gain.linearRampToValueAtTime(0, now + start + dur);

          oscillator.start(now + start);
          oscillator.stop(now + start + dur + 0.01);
        });
      } catch (e) {
        console.warn('Audio playback failed:', e);
      }
    },
    [soundEnabled]
  );

  // ── Emergency Call Trigger ─────────────────────────────────────
  const triggerEmergencyCall = useCallback(() => {
    if (emergencyCallTriggered) return;
    setEmergencyCallTriggered(true);
    setShowEmergencyDialog(true);

    // Send Real-time log to Admin Dashboard
    try {
      fetch('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { 
            name: user?.name || 'Local User', 
            phone: user?.phone || '+91 (Auto-detected)', 
            email: user?.email || 'N/A' 
          },
          lastLocation: latestRoadRef.current,
          sourceLocation: latestRoadRef.current,
          destLocation: "Automated Speed Control",
          searchHistory: `Overspeed Alert - ${latestSpeedRef.current} KM/H detected`,
          escalation: {
            limitExceeded: `${latestSpeedRef.current} km/h (Limit: ${latestLimitRef.current})`,
            called: "Highway Patrol & 1033",
            date: new Date().toLocaleString('en-IN', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit', 
              hour12: true 
            }),
            incidentLocation: latestRoadRef.current
          }
        })
      });
    } catch(e) {}

    // Attempt to initiate the phone call via tel: URI
    setTimeout(() => {
      window.location.href = 'tel:1033';
    }, 1500);
  }, [emergencyCallTriggered, user]);

  // ── Warning Escalation Logic ───────────────────────────────────
  useEffect(() => {
    if (!isMonitoring) return;

    if (isCurrentlyOverspeeding) {
      // Start tracking overspeeding time
      if (overspeedStartTime === null) {
        setOverspeedStartTime(Date.now());
        // Immediately issue 1st warning
        setWarningLevel(1);
        setShowWarningBanner(true);
        setActiveWarningMessage(warningStages[0].description);
        playWarningBeep(1);
        setWarningCountdown(8);
      }
    } else {
      // Driver slowed down — reset the warning escalation
      if (overspeedStartTime !== null) {
        setOverspeedStartTime(null);
        setWarningLevel(0);
        setShowWarningBanner(false);
        setActiveWarningMessage('');
        setWarningCountdown(null);

        // Clear timers
        if (warningTimerRef.current) {
          clearInterval(warningTimerRef.current);
          warningTimerRef.current = null;
        }
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
    }
  }, [isCurrentlyOverspeeding, isMonitoring, overspeedStartTime, playWarningBeep]);

  // ── Countdown Timer for Next Warning ───────────────────────────
  useEffect(() => {
    if (warningCountdown === null || warningLevel === 0 || warningLevel >= 3) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    countdownTimerRef.current = setInterval(() => {
      setWarningCountdown((prev) => {
        if (prev === null || prev <= 0) return null;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [warningLevel, warningCountdown !== null]);

  // ── Escalation Timer (4s between warnings) ─────────────────────
  useEffect(() => {
    if (!isMonitoring || !isCurrentlyOverspeeding || warningLevel === 0) return;

    // Already at level 3 — no more escalation
    if (warningLevel >= 3) return;

    warningTimerRef.current = setTimeout(() => {
      if (!isCurrentlyOverspeeding) return; // double check

      const nextLevel = warningLevel + 1;
      setWarningLevel(nextLevel);
      setActiveWarningMessage(warningStages[nextLevel - 1].description);
      playWarningBeep(nextLevel);

      if (nextLevel >= 3) {
        // Trigger emergency call
        triggerEmergencyCall();
        setWarningCountdown(null);
      } else {
        setWarningCountdown(8);
      }
    }, 8000);

    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
    };
  }, [warningLevel, isCurrentlyOverspeeding, isMonitoring, playWarningBeep, triggerEmergencyCall]);

  // ── Auto-start monitoring on mount ─────────────────────────────
  useEffect(() => {
    setIsMonitoring(true);
  }, []);

  // ── Synchronize GPS tracking with toggle ───────────────────────
  useEffect(() => {
    if (isMonitoring && useRealLocation) {
      startTracking();
    } else {
      stopTracking();
    }
  }, [useRealLocation, isMonitoring, startTracking, stopTracking]);

  // Auth gate after hooks
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Update speedData limits when vehicle changes (adjusting the base limit by vehicle factor)
  useEffect(() => {
    const vehicleFactors: Record<VehicleCategory, number> = {
      car: 1.0,
      motorcycle: 0.8,
      truck: 0.6
    };
    
    setSpeedData((prev) => {
      // If we have a base speed limit from API, apply vehicle factor
      // Note: We'll store the UN-ADJUSTED limit in a ref or just recalculate
      return {
        ...prev,
        // The API gives legal limit for cars usually, we adjust for others
        speedLimit: Math.round(prev.speedLimit * (vehicleFactors[vehicleType] / vehicleFactors.car)),
      };
    });
  }, [vehicleType]);

  // ── Simulate speed changes (fallback when not using real GPS) ──
  useEffect(() => {
    if (!isMonitoring || (useRealLocation && isTracking)) return;

    const interval = setInterval(() => {
      setSpeedData((prev) => {
        const fluctuation = Math.random() * 20 - 5;
        let newSpeed = Math.max(0, Math.min(180, prev.currentSpeed + fluctuation));

        // Occasionally force overspeeding for demo if monitoring
        if (isMonitoring && Math.random() > 0.8) {
          newSpeed = currentSpeedLimit + Math.random() * 30;
        }

        return {
          ...prev,
          currentSpeed: Math.round(newSpeed),
          isOverspeeding: newSpeed > currentSpeedLimit,
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isMonitoring, currentSpeedLimit, useRealLocation, isTracking]);

  // ── Update speed data from real GPS ────────────────────────────
  useEffect(() => {
    if (!useRealLocation || !liveLocation || !isMonitoring) return;

    const gpsSpeed =
      liveLocation.speed !== null ? Math.round(liveLocation.speed * 3.6) : 0;
    const isOverspeeding = gpsSpeed > currentSpeedLimit;

    setSpeedData((prev) => ({
      ...prev,
      currentSpeed: gpsSpeed,
      isOverspeeding,
      location: roadName,
    }));
  }, [liveLocation, useRealLocation, isMonitoring, currentSpeedLimit, roadName]);

  // ── Fetch Real Speed Limit from Backend API ──────────────────────
  const fetchRealSpeedLimit = useCallback(async (lat: number, lon: number) => {
    // Check if moved enough (~50m) to justify a new fetch
    if (lastFetchedCoords.current) {
      const dLat = Math.abs(lastFetchedCoords.current.lat - lat);
      const dLon = Math.abs(lastFetchedCoords.current.lon - lon);
      if (dLat < 0.0005 && dLon < 0.0005) return; // approx 50m
    }

    setIsLoadingSpeedLimit(true);
    try {
      const response = await fetch(`http://localhost:3000/api/speed-limit?lat=${lat}&lon=${lon}`);
      const data = await response.json();
      
      if (data.success) {
        setRoadName(data.roadName);
        setSpeedData(prev => ({
          ...prev,
          speedLimit: data.speed,
          location: data.roadName
        }));
        lastFetchedCoords.current = { lat, lon };
      }
    } catch (e) {
      console.error('Failed to fetch speed limit:', e);
    } finally {
      setIsLoadingSpeedLimit(false);
    }
  }, []);

  useEffect(() => {
    if (useRealLocation && liveLocation) {
      fetchRealSpeedLimit(liveLocation.latitude, liveLocation.longitude);
    }
  }, [liveLocation, useRealLocation, fetchRealSpeedLimit]);

  // Remove manual section cycling logic

  // ── Helpers ────────────────────────────────────────────────────
  const getSpeedColor = () => {
    if (!isMonitoring) return 'text-muted-foreground';
    if (isCurrentlyOverspeeding) return 'text-destructive';
    if (displaySpeed >= currentSpeedLimit * 0.9) return 'text-warning';
    return 'text-success';
  };

  const getProgressColor = () => {
    const ratio = displaySpeed / currentSpeedLimit;
    if (ratio >= 1) return 'bg-destructive';
    if (ratio >= 0.9) return 'bg-warning';
    return 'bg-success';
  };

  const getRingBorderClass = () => {
    if (!isMonitoring) return 'border-muted';
    if (warningLevel >= 3) return 'border-destructive animate-pulse-ring shadow-glow-emergency';
    if (warningLevel >= 2) return 'border-emergency animate-pulse-ring';
    if (warningLevel >= 1) return 'border-warning animate-pulse';
    if (isCurrentlyOverspeeding) return 'border-destructive animate-pulse-ring';
    return 'border-muted';
  };

  const handleStartMonitoring = () => {
    setIsMonitoring(true);
    if (useRealLocation) {
      startTracking();
    }
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    stopTracking();
  };

  const handleReset = () => {
    setSpeedData({
      currentSpeed: 0,
      speedLimit: 50,
      isOverspeeding: false,
      warningCount: 0,
      location: 'Detecting...',
    });
    setRoadName('Detecting...');
    lastFetchedCoords.current = null;
    setWarningLevel(0);
    setOverspeedStartTime(null);
    setShowWarningBanner(false);
    setActiveWarningMessage('');
    setEmergencyCallTriggered(false);
    setWarningCountdown(null);
    setIsMonitoring(true);

    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const VehicleIcon = vehicleIcons[vehicleType];

  return (
    <Layout>
      <div className="gov-container py-8">
        {/* Header */}
        <div className="mb-10 animate-fade-in text-center lg:text-left">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6 gap-2 text-muted-foreground hover:text-foreground bg-background/50 hover:bg-background/80 backdrop-blur-sm transition-all rounded-full px-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-4xl lg:text-5xl font-extrabold text-foreground mb-3 tracking-tight">
                Speed <span className="text-gradient">Monitor</span>
              </h1>
              <p className="text-lg text-muted-foreground font-light">
                Real-time intelligent speed tracking with automated escalation protocols
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Vehicle Type Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-lg shadow-sm hover:bg-muted/50 transition-all text-sm font-medium"
                >
                  <VehicleIcon className="w-4 h-4 text-accent" />
                  {vehicleLabels[vehicleType]}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showVehicleDropdown ? 'rotate-180' : ''}`}
                  />
                </button>
                {showVehicleDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    {(Object.keys(vehicleLabels) as VehicleCategory[]).map((type) => {
                      const Icon = vehicleIcons[type];
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            setVehicleType(type);
                            setShowVehicleDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors ${
                            vehicleType === type
                              ? 'bg-accent/10 text-accent font-medium'
                              : 'text-foreground'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {vehicleLabels[type]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* GPS Toggle */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Satellite className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="use-gps" className="text-sm cursor-pointer">
                  Use GPS
                </Label>
                <Switch
                  id="use-gps"
                  checked={useRealLocation}
                  onCheckedChange={setUseRealLocation}
                />
              </div>
            </div>
          </div>
          {locationError && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning">
              {locationError}
            </div>
          )}
        </div>

        {/* ── Warning Banner ─────────────────────────────────────── */}
        {showWarningBanner && warningLevel > 0 && (
          <div
            className={`mb-6 rounded-xl overflow-hidden animate-slide-up ${
              warningLevel >= 3
                ? 'bg-gradient-to-r from-destructive/20 via-emergency/20 to-destructive/20 border-2 border-destructive'
                : warningLevel >= 2
                ? 'bg-gradient-to-r from-emergency/15 to-warning/15 border-2 border-emergency'
                : 'bg-gradient-to-r from-warning/15 to-warning/10 border-2 border-warning'
            }`}
          >
            <div className="px-6 py-4 flex items-center gap-4">
              <div
                className={`p-3 rounded-full ${
                  warningLevel >= 3
                    ? 'bg-destructive/20 animate-pulse'
                    : warningLevel >= 2
                    ? 'bg-emergency/20 animate-pulse-fast'
                    : 'bg-warning/20 animate-pulse-slow'
                }`}
              >
                {warningLevel >= 3 ? (
                  <PhoneCall className="w-6 h-6 text-destructive" />
                ) : warningLevel >= 2 ? (
                  <BellRing className="w-6 h-6 text-emergency" />
                ) : (
                  <Bell className="w-6 h-6 text-warning" />
                )}
              </div>
              <div className="flex-1">
                <h3
                  className={`font-bold text-lg ${
                    warningLevel >= 3
                      ? 'text-destructive'
                      : warningLevel >= 2
                      ? 'text-emergency'
                      : 'text-warning'
                  }`}
                >
                  ⚠️ {warningStages[warningLevel - 1].label}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {activeWarningMessage}
                </p>
              </div>
              {/* Countdown to next warning */}
              {warningLevel < 3 && warningCountdown !== null && (
                <div className="flex flex-col items-center gap-1 min-w-[70px]">
                  <Timer
                    className={`w-5 h-5 ${
                      warningLevel >= 2 ? 'text-emergency' : 'text-warning'
                    }`}
                  />
                  <span
                    className={`text-2xl font-bold tabular-nums ${
                      warningLevel >= 2 ? 'text-emergency' : 'text-warning'
                    }`}
                  >
                    {warningCountdown}s
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Next Warning
                  </span>
                </div>
              )}
              {warningLevel >= 3 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-destructive/20 rounded-lg animate-pulse">
                  <Phone className="w-5 h-5 text-destructive" />
                  <span className="text-sm font-bold text-destructive">Calling 1033...</span>
                </div>
              )}
            </div>

            {/* Warning progress dots */}
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((level) => (
                  <div key={level} className="flex items-center gap-2 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        warningLevel >= level
                          ? level === 3
                            ? 'bg-destructive text-destructive-foreground shadow-glow-emergency'
                            : level === 2
                            ? 'bg-emergency text-emergency-foreground shadow-glow-warning'
                            : 'bg-warning text-warning-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {level}
                    </div>
                    {level < 3 && (
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            warningLevel > level
                              ? level === 2
                                ? 'bg-emergency w-full'
                                : 'bg-warning w-full'
                              : 'w-0'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                <span>Warning</span>
                <span>Urgent</span>
                <span>Emergency Call</span>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="speedometer" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="speedometer" className="gap-2">
              <Gauge className="w-4 h-4" />
              Speedometer
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-2">
              <Navigation className="w-4 h-4" />
              Live Map
            </TabsTrigger>
          </TabsList>

          <TabsContent value="speedometer">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
              {/* Speedometer Panel */}
              <div className="glass-card text-center bg-white/40 dark:bg-black/20 border-white/20">
                <div className="relative w-72 h-72 mx-auto mb-10 flex items-center justify-center">
                  {/* Outer Ring */}
                  <div
                    className={`absolute inset-0 rounded-full border-[12px] transition-all duration-300 ${getRingBorderClass()}`}
                  />

                  {/* Speed Display */}
                  <div className="absolute inset-4 rounded-full bg-card shadow-lg flex flex-col items-center justify-center">
                    <VehicleIcon
                      className={`w-6 h-6 mb-1 ${
                        isCurrentlyOverspeeding ? 'text-destructive' : 'text-accent'
                      }`}
                    />
                    <span className={`text-6xl font-bold ${getSpeedColor()}`}>
                      {displaySpeed}
                    </span>
                    <span className="text-xl text-muted-foreground">km/h</span>

                    {isCurrentlyOverspeeding && (
                      <div className="absolute -bottom-2 flex items-center gap-1 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-xs font-medium animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        OVERSPEEDING
                      </div>
                    )}
                  </div>
                </div>

                {/* Speed Limit Bar */}
                <div className="mb-8">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-muted-foreground font-medium">Current Speed</span>
                    <span className="font-bold text-foreground">
                      Limit: {currentSpeedLimit} km/h 
                      {globalSpeedOverride ? " (ADMIN OVERRIDE)" : ` (${vehicleLabels[vehicleType]})`}
                    </span>
                  </div>
                  <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full transition-all duration-500 ${getProgressColor()}`}
                      style={{
                        width: `${Math.min(
                          (displaySpeed / currentSpeedLimit) * 100,
                          100
                        )}%`,
                      }}
                    />
                    <div
                      className="absolute top-0 h-full w-0.5 bg-foreground"
                      style={{ left: '100%', transform: 'translateX(-50%)' }}
                    />
                  </div>
                  {displaySpeed > currentSpeedLimit && (
                    <p className="text-xs text-destructive mt-2 font-medium">
                      Exceeding by {displaySpeed - currentSpeedLimit} km/h
                    </p>
                  )}
                </div>

                {/* Location Info */}
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-6">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {isLoadingSpeedLimit ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Fetching speed limit...
                      </span>
                    ) : (
                      roadName
                    )}
                  </span>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-border/50">
                  <Button onClick={handleReset} variant="outline" size="lg" className="rounded-full shadow-sm">
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Reset
                  </Button>
                  <Button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    variant="ghost"
                    size="icon"
                    className="w-12 h-12 rounded-full bg-background/50 backdrop-blur-sm shadow-sm"
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-5 h-5" />
                    ) : (
                      <VolumeX className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Info Panel */}
              <div className="space-y-6">
                {/* Vehicle Info */}
                <div className="glass-card bg-white/40 dark:bg-black/20 border-white/20">
                  <h3 className="font-bold text-lg text-foreground mb-4 flex items-center gap-3 border-b border-border/50 pb-3">
                    <VehicleIcon className="w-6 h-6 text-primary drop-shadow-sm" />
                    Vehicle Information
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-background/40 p-3 rounded-lg border border-border/30">
                      <span className="text-muted-foreground font-medium">Vehicle Number</span>
                      <span className="font-bold text-foreground tracking-wide">
                        {user?.vehicleNumber || 'Not Set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-background/40 p-3 rounded-lg border border-border/30">
                      <span className="text-muted-foreground font-medium">Vehicle Type</span>
                      <span className="font-bold text-primary">
                        {vehicleLabels[vehicleType]}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-background/40 p-3 rounded-lg border border-border/30">
                      <span className="text-muted-foreground font-medium">Driver</span>
                      <span className="font-bold text-foreground tracking-wide">{user?.name}</span>
                    </div>
                    <div className="flex justify-between items-center bg-background/40 p-3 rounded-lg border border-border/30">
                      <span className="text-muted-foreground font-medium">Road Section</span>
                      <span className="font-bold text-foreground">
                        {speedData.location}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-background/40 p-3 rounded-lg border border-border/30">
                      <span className="text-muted-foreground font-medium">Monitoring Status</span>
                      <span
                        className={`font-bold tracking-wide ${
                          isMonitoring ? 'text-success drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'text-muted-foreground'
                        }`}
                      >
                        {isMonitoring ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-background/40 p-3 rounded-lg border border-border/30">
                      <span className="text-muted-foreground font-medium">GPS Status</span>
                      <span
                        className={`font-bold tracking-wide ${
                          isTracking ? 'text-success drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'text-muted-foreground'
                        }`}
                      >
                        {isTracking ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="glass-card bg-white/40 dark:bg-black/20 border-white/20">
                  <h3 className="font-bold text-lg text-foreground mb-4 flex items-center gap-3 border-b border-border/50 pb-3">
                    <ShieldAlert className="w-6 h-6 text-accent drop-shadow-sm" />
                    Speed Status Legend
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-background/40 p-3 rounded-lg border border-border/30">
                      <div className="w-4 h-4 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                      <span className="text-sm font-medium">Under Speed Limit</span>
                    </div>
                    <div className="flex items-center gap-4 bg-background/40 p-3 rounded-lg border border-border/30">
                      <div className="w-4 h-4 rounded-full bg-warning shadow-[0_0_10px_rgba(234,179,8,0.5)] animate-pulse" />
                      <span className="text-sm font-medium">Warning (Near Limit)</span>
                    </div>
                    <div className="flex items-center gap-4 bg-background/40 p-3 rounded-lg border border-border/30">
                      <div className="w-4 h-4 rounded-full bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" />
                      <span className="text-sm font-medium">Overspeeding (Alerts)</span>
                    </div>
                  </div>
                </div>

                {/* Warning Escalation Status */}
                <div className="glass-card bg-white/40 dark:bg-black/20 border-white/20">
                  <h3 className="font-bold text-lg text-foreground mb-4 flex items-center gap-3 border-b border-border/50 pb-3">
                    <ShieldAlert className="w-6 h-6 text-warning drop-shadow-sm" />
                    Overspeed Warning System
                  </h3>
                  <div className="space-y-3">
                    {warningStages.map((stage, idx) => {
                      const stageNum = idx + 1;
                      const isActive = warningLevel >= stageNum;
                      const isCurrent = warningLevel === stageNum;
                      const StageIcon = stage.icon;

                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                            isCurrent
                              ? stageNum === 3
                                ? 'bg-destructive/15 border border-destructive/30 animate-pulse'
                                : stageNum === 2
                                ? 'bg-emergency/15 border border-emergency/30'
                                : 'bg-warning/15 border border-warning/30'
                              : isActive
                              ? 'bg-muted/80'
                              : 'bg-muted/30'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isActive
                                ? stageNum === 3
                                  ? 'bg-destructive text-destructive-foreground'
                                  : stageNum === 2
                                  ? 'bg-emergency text-emergency-foreground'
                                  : 'bg-warning text-warning-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <StageIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p
                              className={`text-sm font-medium ${
                                isActive ? stage.color : 'text-muted-foreground'
                              }`}
                            >
                              {stage.label}
                            </p>
                            <p className="text-xs text-muted-foreground">{stage.description}</p>
                          </div>
                          {isActive && (
                            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 p-2 bg-muted/50 rounded">
                    ℹ️ Each warning triggers 4 seconds apart while overspeeding. After 3 warnings,
                    <strong> 1033 emergency services</strong> are automatically called.
                  </p>
                </div>

                {/* Speed Limits Reference */}
                <div className="glass-card bg-white/40 dark:bg-black/20 border-white/20">
                  <h3 className="font-bold text-lg text-foreground mb-4 flex items-center gap-3 border-b border-border/50 pb-3">
                    <Gauge className="w-6 h-6 text-accent drop-shadow-sm" />
                    Speed Limits — {vehicleLabels[vehicleType]}
                  </h3>
                  <div className="space-y-2">
                    {/* Current Road Status */}
                    <div className="bg-accent/10 border border-accent p-3 rounded-lg mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-accent font-bold">Current Road</span>
                        <span className="font-bold text-accent">{currentSpeedLimit} km/h</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{speedData.location}</p>
                    </div>

                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Typical Limits</p>
                    {Object.entries(roadTypeInfo).map(([type, info]) => {
                      const baseLimit = 
                        type === 'motorway' ? 120 :
                        type === 'trunk' ? 100 :
                        type === 'primary' ? 80 :
                        type === 'secondary' ? 60 :
                        type === 'residential' ? 35 : 50;
                      
                      const vehicleFactors: Record<string, number> = { car: 1.0, motorcycle: 0.8, truck: 0.6 };
                      const limit = Math.round(baseLimit * (vehicleFactors[vehicleType] / vehicleFactors.car));

                      return (
                        <div
                          key={type}
                          className="flex justify-between p-2 rounded bg-muted/30 text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <span>{info.icon}</span>
                            <span className="text-muted-foreground">{info.label}</span>
                          </span>
                          <span className="font-medium">{limit} km/h</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="map">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <LiveLocationMap
                  location={liveLocation}
                  locationHistory={locationHistory}
                  isTracking={isTracking}
                  className="h-[500px]"
                />
              </div>
              <div className="space-y-4">
                <div className="gov-card">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-accent" />
                    Live Location Data
                  </h3>
                  {liveLocation ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latitude</span>
                        <span className="font-mono">
                          {liveLocation.latitude.toFixed(6)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Longitude</span>
                        <span className="font-mono">
                          {liveLocation.longitude.toFixed(6)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Accuracy</span>
                        <span className="font-mono">
                          {liveLocation.accuracy.toFixed(0)} m
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Speed</span>
                        <span className="font-mono">
                          {liveLocation.speed !== null
                            ? `${(liveLocation.speed * 3.6).toFixed(1)} km/h`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Heading</span>
                        <span className="font-mono">
                          {liveLocation.heading !== null
                            ? `${liveLocation.heading.toFixed(0)}°`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Points Recorded</span>
                        <span className="font-mono">{locationHistory.length}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {isTracking
                        ? 'Acquiring GPS signal...'
                        : 'Start monitoring to see live location data.'}
                    </p>
                  )}
                </div>
                <div className="gov-card">
                  <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Session
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Emergency Call Dialog */}
      <Dialog open={showEmergencyDialog} onOpenChange={setShowEmergencyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <PhoneCall className="w-6 h-6 animate-pulse" />
              Emergency — Calling 1033
            </DialogTitle>
            <DialogDescription>
              You ignored 3 overspeeding warnings. An automatic call to highway emergency
              services (1033) is being placed from your phone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <h4 className="font-semibold text-foreground mb-2">Alert Details</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Vehicle: {user?.vehicleNumber || 'Unknown'}</li>
                <li>• Type: {vehicleLabels[vehicleType]}</li>
                <li>
                  • Location:{' '}
                  {liveLocation
                    ? `${liveLocation.latitude.toFixed(4)}, ${liveLocation.longitude.toFixed(4)}`
                    : speedData.location}
                </li>
                <li>
                  • Speed: {displaySpeed} km/h (Limit: {currentSpeedLimit} km/h)
                </li>
                <li>• Warnings Issued: 3</li>
              </ul>
            </div>

            {/* Call indicator */}
            <div className="flex items-center gap-3 p-4 bg-emergency/10 border border-emergency/20 rounded-lg">
              <div className="p-2 bg-emergency/20 rounded-full animate-pulse">
                <Phone className="w-6 h-6 text-emergency" />
              </div>
              <div>
                <p className="font-bold text-foreground">Highway Helpline — 1033</p>
                <p className="text-sm text-muted-foreground">
                  Auto-dialing emergency services...
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  window.location.href = 'tel:1033';
                }}
                className="flex-1 gap-2 bg-emergency hover:bg-emergency/90"
              >
                <Phone className="w-4 h-4" />
                Call 1033 Now
              </Button>
              <Button
                onClick={() => setShowEmergencyDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
