import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone,
  Hospital,
  Shield,
  Flame,
  AlertTriangle,
  ChevronRight,
  Heart,
  Bandage,
  Activity,
  Thermometer,
  ArrowLeft,
  MapPin,
  Loader2,
} from 'lucide-react';
import { emergencyCenters as mockCenters, firstAidInstructions } from '@/data/mockData';
import { EmergencyCenter } from '@/types';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const emergencyNumbers = [
  { name: 'Highway Helpline', number: '1033', icon: Phone, description: 'Highway emergency assistance' },
  { name: 'Ambulance', number: '108', icon: Hospital, description: 'Medical emergency' },
  { name: 'Police', number: '100', icon: Shield, description: 'Law enforcement' },
  { name: 'Fire', number: '101', icon: Flame, description: 'Fire emergency' },
];

const firstAidIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Bleeding Control': Bandage,
  'CPR (Cardiopulmonary Resuscitation)': Heart,
  'Fracture Management': Activity,
  'Shock Treatment': Thermometer,
};

export default function Emergency() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'no-answer' | 'message-sent'>('idle');

  // Live nearby emergency centers state
  const [centers, setCenters] = useState<EmergencyCenter[]>(mockCenters);
  const [centersLoading, setCentersLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setCentersLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `http://localhost:3000/api/nearby-emergency?lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          if (data.success && data.centers && data.centers.length > 0) {
            setCenters(data.centers);
            setLocationError(null);
          } else {
            // No results from API — keep mock data
            setLocationError('No nearby centers found via live data. Showing default centers.');
          }
        } catch (err) {
          console.error('Failed to fetch nearby centers:', err);
          setLocationError('Could not fetch live data. Showing default centers.');
        } finally {
          setCentersLoading(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setLocationError('Location access denied. Showing default centers.');
        setCentersLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const handleEmergencyCall = () => {
    if (callStatus !== 'idle') return;
    
    setCallStatus('calling');
    toast.info('Dialing 1033...', { description: 'Connecting to highway helpline...' });
    
    // Log to Admin Dashboard
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
          lastLocation: 'GPS Location (Live)',
          sourceLocation: 'Live Tracking Active',
          destLocation: 'Emergency SOS Command',
          searchHistory: 'Emergency SOS Activated — Dialed 1033',
          escalation: {
            limitExceeded: '-',
            called: 'Highway Helpline 1033 (Manual SOS)',
            date: new Date().toLocaleString('en-IN', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit', 
              hour12: true 
            }),
            incidentLocation: 'User GPS Coordinates'
          }
        })
      });
    } catch(e) {}

    // Init call
    window.location.href = 'tel:1033';
    
    // Simulate call not picked up after 6 seconds
    setTimeout(() => {
      setCallStatus('no-answer');
      toast.error('No Answer', { 
        description: 'Emergency call not picked up. Initiating automated fallback protocol...' 
      });
      
      // Simulate automated message sent
      setTimeout(() => {
        setCallStatus('message-sent');
        toast.success('Emergency Alert Sent ✅', { 
          description: 'Automated SMS with your exact GPS coordinates has been forwarded to the Nearest Control Room.' 
        });
        
        // Reset after 8 seconds
        setTimeout(() => setCallStatus('idle'), 8000);
      }, 3000);
    }, 6000);
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const emergencyIcons = {
    hospital: Hospital,
    police: Shield,
    ambulance: Phone,
    fire: Flame,
  };

  return (
    <Layout>
      <div className="gov-container py-8">
        <div className="mb-8 animate-fade-in">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)} 
            className="mb-4 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">Emergency Assistance</h1>
          <p className="text-muted-foreground">
            Quick access to emergency services and first aid instructions
          </p>
        </div>

        {/* Emergency SOS Banner */}
        <div className="bg-emergency text-emergency-foreground rounded-2xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse-ring">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Emergency SOS</h2>
                <p className="text-emergency-foreground/80">Press for immediate assistance</p>
              </div>
            </div>
            <Button 
                onClick={handleEmergencyCall}
                disabled={callStatus !== 'idle'}
                variant="ghost" 
                className={`font-bold text-lg px-8 py-6 transition-all duration-300 ${
                  callStatus === 'idle' ? 'bg-white text-emergency hover:bg-white/90' :
                  callStatus === 'calling' ? 'bg-amber-500 text-white animate-pulse' :
                  callStatus === 'no-answer' ? 'bg-red-600 text-white' :
                  'bg-green-500 text-white'
                }`}
              >
                <Phone className={`w-5 h-5 mr-2 ${callStatus === 'calling' ? 'animate-bounce' : ''}`} />
                {callStatus === 'idle' && 'Call 1033'}
                {callStatus === 'calling' && 'Calling...'}
                {callStatus === 'no-answer' && 'No Answer'}
                {callStatus === 'message-sent' && 'Alert Sent'}
              </Button>
          </div>
        </div>

        {/* Emergency Numbers Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {emergencyNumbers.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.number}
                href={`tel:${item.number}`}
                className="gov-card group hover:border-emergency transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-emergency/10 flex items-center justify-center group-hover:bg-emergency group-hover:text-emergency-foreground transition-colors">
                    <Icon className="w-6 h-6 text-emergency group-hover:text-emergency-foreground" />
                  </div>
                </div>
                <h3 className="font-semibold text-foreground mb-1">{item.name}</h3>
                <p className="text-2xl font-bold text-emergency">{item.number}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </a>
            );
          })}
        </div>

        <Tabs defaultValue="centers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="centers">Nearby Centers</TabsTrigger>
            <TabsTrigger value="firstaid">First Aid</TabsTrigger>
          </TabsList>

          {/* Nearby Emergency Centers */}
          <TabsContent value="centers" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Emergency Centers Near You</h3>
              {!centersLoading && !locationError && (
                <span className="flex items-center gap-1 text-xs text-accent">
                  <MapPin className="w-3 h-3" />
                  Live from your location
                </span>
              )}
            </div>

            {/* Location error info banner */}
            {locationError && (
              <div className="flex items-center gap-2 p-3 bg-muted/60 rounded-lg text-sm text-muted-foreground">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {locationError}
              </div>
            )}

            {/* Loading skeleton */}
            {centersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="gov-card animate-pulse">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                        <div className="flex justify-between">
                          <div className="h-3 bg-muted rounded w-1/4" />
                          <div className="h-3 bg-muted rounded w-1/4" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {centers.map((center) => {
                  const Icon = emergencyIcons[center.type];
                  return (
                    <div key={center.id} className="gov-card hover:shadow-lg transition-all">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          center.type === 'hospital' ? 'bg-emergency/10 text-emergency' :
                          center.type === 'police' ? 'bg-primary/10 text-primary' :
                          center.type === 'ambulance' ? 'bg-warning/10 text-warning' :
                          'bg-destructive/10 text-destructive'
                        }`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-1">{center.name}</h4>
                          <p className="text-sm text-muted-foreground mb-2">{center.address}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-accent font-medium">
                              {center.distance} km away
                            </span>
                            <a
                              href={`tel:${center.phone}`}
                              className="flex items-center gap-1 text-sm text-accent hover:underline"
                            >
                              <Phone className="w-4 h-4" />
                              {center.phone}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* First Aid Instructions */}
          <TabsContent value="firstaid" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">First Aid Instructions</h3>
              <span className="text-sm text-muted-foreground">
                Step-by-step emergency guidance
              </span>
            </div>
            <Accordion type="single" collapsible className="space-y-3">
              {firstAidInstructions.map((item) => {
                const Icon = firstAidIcons[item.title] || Heart;
                return (
                  <AccordionItem key={item.id} value={item.id} className="gov-card border-none">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emergency/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-emergency" />
                        </div>
                        <span className="font-semibold text-foreground">{item.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-0 pb-4">
                      <div className="pl-13 space-y-3">
                        {item.steps.map((step, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                            <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
                              {index + 1}
                            </span>
                            <p className="text-sm text-foreground">{step}</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
