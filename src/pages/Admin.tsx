import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  Car,
  MapPin,
  Clock,
  CheckCircle,
  Gauge,
  Phone,
  User,
  RefreshCw,
  Shield,
  Hospital,
  Activity,
  History,
  Users,
  Cpu,
  HardDrive,
  Wifi,
  Lock,
  Server,
  Database,
  Zap,
  ThermometerSun,
} from 'lucide-react';
import { mockEmergencyAlerts, mockRoutes } from '@/data/mockData';
import { RouteMap } from '@/components/features/RouteMap';
import { EmergencyAlert } from '@/types';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Trash2, Edit2, Move, AlertOctagon, Info, FileDown, Eye } from 'lucide-react';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Admin() {
  const { isAuthenticated, user } = useAuth();
  const [alerts, setAlerts] = useState<EmergencyAlert[]>(mockEmergencyAlerts);
  const [filter, setFilter] = useState<'all' | 'active' | 'responding' | 'resolved'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAiTriageEnabled, setIsAiTriageEnabled] = useState(false);
  const [metrics, setMetrics] = useState({
    cpu: 18,
    ram: 3.8,
    disk: 95,
    temp: 39,
    uptimeDays: 127
  });

  // Update dynamic metrics
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.floor(15 + Math.random() * 15),
        ram: parseFloat((3.5 + Math.random() * 1).toFixed(1)),
        disk: Math.floor(80 + Math.random() * 50),
        temp: Math.floor(38 + Math.random() * 8),
        uptimeDays: prev.uptimeDays
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchUsers();
    }
  }, [isAuthenticated, user]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('http://localhost:3000/api/auth/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error('Failed to fetch users', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const handleBroadcast = async (type: string) => {
    let message = "";
    if (type.includes('Weather')) {
      message = "URGENT WARNING: Dense Fog and Flash Floods reported on multiple expressways. Reduce speed instantly.";
    } else if (type.includes('Accident')) {
      message = "CRITICAL SITUATION: Multi-vehicle pileup ahead. Emergency corridors are now blocked. Prepare for heavy congestion.";
    } else {
      message = type + " - Proceed with caution.";
    }

    try {
      await fetch('http://localhost:3000/api/admin/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcast: { message, active: true, type, time: Date.now() } })
      });
      // Refresh history immediately
      await pollLogs();
      window.alert(`🚨 HIGHWAY BROADCAST SENT: All connected vehicles have been notified of ${type}!`);
    } catch (e) {
      console.error(e);
    }
  };

  const setGlobalSpeedLimit = async (limit: number) => {
    try {
      await fetch('http://localhost:3000/api/admin/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speedLimit: limit })
      });
      window.alert(`⚠️ SPEED LIMIT UPDATED: The national highway digital speed limit has been throttled to ${limit} km/h.`);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTollPlaza = async (route: string, status: 'Open' | 'Free Passage' | 'Closed') => {
    try {
      await fetch('http://localhost:3000/api/admin/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tollOverride: { route, status, time: Date.now() } })
      });
      window.alert(`🛣️ TOLL OPERATION UPDATED: ${route} is now set to ${status}. All linked FASTag boom barriers are now forced OPEN.`);
    } catch (e) {
      console.error(e);
    }
  };

  const [realLogs, setRealLogs] = useState<any[]>([]);
  const [broadcastHistory, setBroadcastHistory] = useState<{message: string; date: string}[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [patrolUnits, setPatrolUnits] = useState([
    { id: 'PAT-01', type: 'Patrol Car', status: 'On Patrol', location: 'NH44 - KM 124', crew: 'Officer Singh', health: 'Healthy', lat: 28.6, lng: 77.2 },
    { id: 'AMB-04', type: 'Advanced Life Support', status: 'Responding', location: 'NH44 - KM 89', crew: 'Dr. Sharma', health: 'Priority', lat: 28.4, lng: 77.1 },
    { id: 'TOW-02', type: 'Rapid Tow Unit', status: 'Stationed', location: 'Karnal Base', crew: 'S. Kumar', health: 'Healthy', lat: 29.6, lng: 76.9 },
    { id: 'PAT-07', type: 'Highway Interceptor', status: 'On Patrol', location: 'NH44 - KM 210', crew: 'Officer Rahul', health: 'Healthy', lat: 30.2, lng: 76.7 }
  ]);

  const pollLogs = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/admin/state');
      const data = await res.json();
      
      // Update logs if changed
      if (data.logs && Array.isArray(data.logs)) {
        setRealLogs(data.logs);
      }
      
      // Update history and FORCE update if it's empty but shouldn't be
      if (data.broadcastHistory && Array.isArray(data.broadcastHistory)) {
        setBroadcastHistory([...data.broadcastHistory]);
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    }
  };

  useEffect(() => {
    pollLogs();
    const logInterval = setInterval(pollLogs, 2000);
    
    // Simulate real-time patrol movement
    const movementInterval = setInterval(() => {
      setPatrolUnits(prev => prev.map(unit => {
        if (unit.status === 'Stationed') return unit;
        // Minor movement simulation
        const latChange = (Math.random() - 0.5) * 0.005;
        const lngChange = (Math.random() - 0.5) * 0.005;
        const currentKm = parseInt(unit.location.match(/\d+/)?.[0] || '124');
        const newKm = currentKm + (Math.random() > 0.5 ? 1 : -1);
        return {
          ...unit,
          lat: unit.lat + latChange,
          lng: unit.lng + lngChange,
          location: unit.location.includes('Base') ? unit.location : `NH44 - KM ${newKm}`
        };
      }));
    }, 5000);

    return () => {
      clearInterval(logInterval);
      clearInterval(movementInterval);
    };
  }, []);

  const stats = {
    total: alerts.length,
    active: alerts.filter(a => a.status === 'active').length,
    responding: alerts.filter(a => a.status === 'responding').length,
    resolved: alerts.filter(a => a.status === 'resolved').length,
  };

  return (
    <Layout showChatbot={false}>
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fade-in border-b border-border/30 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Admin Dashboard</h1>
              <p className="text-muted-foreground">
                Manage highway alerts and system operations
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/10">
                  <History className="w-4 h-4" />
                  View Activity History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                    <History className="w-6 h-6 text-primary" />
                    Admin Deployment History
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-6 space-y-4">
                  {broadcastHistory.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                      <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      No broadcasts deployed in this session.
                    </div>
                  ) : (
                    broadcastHistory.map((b, i) => (
                      <div key={i} className="p-4 bg-muted/30 rounded-xl border border-border/50 hover:bg-muted/50 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <Badge className={b.message.includes('CRITICAL') || b.message.includes('URGENT') ? 'bg-destructive' : 'bg-primary'}>
                            {b.message.includes('Weather') ? 'Weather' : b.message.includes('Accident') ? 'Security' : 'General'}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{b.date}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground leading-relaxed">"{b.message}"</p>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-glow-primary flex items-center gap-2"
              onClick={() => {
                let csv = 'Type,User,Email,Location,Activity,Escalation,Called,Time\n';
                realLogs.forEach(l => {
                  csv += `Activity Log,"${l.user?.name || ''}","${l.user?.email || ''}","${l.lastLocation || ''}","${l.searchHistory || ''}","${l.escalation?.limitExceeded || '-'}","${l.escalation?.called || '-'}","${l.escalation?.date || ''}"\n`;
                });
                broadcastHistory.forEach(b => {
                  csv += `Broadcast,Admin (Highway Control),-,-,"${b.message.replace(/"/g, '""')}",-,-,"${b.date}"\n`;
                });
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `NHMS_Security_Audit_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <FileDown className="w-4 h-4" />
              Download Audit
            </Button>
          </div>
        </div>

        <Tabs defaultValue="logs" className="space-y-6">
            <TabsList className="grid w-full max-w-5xl grid-cols-4 bg-muted/50 p-1 rounded-xl shadow-inner overflow-x-auto">
              <TabsTrigger value="logs" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all border-b-2 border-transparent data-[state=active]:border-primary">
                <MapPin className="w-4 h-4 text-primary" />
                User Tracking Logs
              </TabsTrigger>
              <TabsTrigger value="controls" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all">
                <Shield className="w-4 h-4 text-destructive" />
                Global Controls
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all">
                <Users className="w-4 h-4 text-primary" />
                User Database
              </TabsTrigger>
              <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all">
                <Activity className="w-4 h-4 text-warning" />
                System Overview
              </TabsTrigger>
            </TabsList>

          <TabsContent value="controls" className="space-y-6">
            <div className="flex flex-col gap-10 w-full mb-16">
              
              {/* Emergency Broadcast System */}
              <div className="gov-card border-t-4 border-t-destructive shadow-lg hover:shadow-xl transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-destructive/10 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-destructive animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground">Emergency Broadcast</h3>
                    <p className="text-sm text-muted-foreground">Push notifications to all highway users instantly</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-primary hover:bg-primary/10 transition-all ml-auto"
                    title="Quick History View"
                    onClick={() => setIsHistoryOpen(true)}
                  >
                    <History className="w-6 h-6" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 mb-4">
                  <div className="p-6 border-2 border-border/50 rounded-2xl hover:bg-muted/50 transition-all cursor-pointer group shadow-sm hover:shadow-md" onClick={() => handleBroadcast('Severe Weather Warning (Fog/Heavy Rain)')}>
                    <AlertTriangle className="w-10 h-10 text-warning mb-4 group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold text-lg mb-2">Severe Weather Snapshot</h4>
                    <p className="text-sm text-muted-foreground">Warn users of dense fog or flash floods in real-time</p>
                  </div>
                  <div className="p-6 border-2 border-border/50 rounded-2xl hover:bg-muted/50 transition-all cursor-pointer group shadow-sm hover:shadow-md" onClick={() => handleBroadcast('Major Accident Ahead - Corridors Blocked')}>
                    <Car className="w-10 h-10 text-destructive mb-4 group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold text-lg mb-2">Major Accident Trigger</h4>
                    <p className="text-sm text-muted-foreground">Alert drivers to immediately clear emergency lanes</p>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4 bg-destructive hover:bg-destructive/90 shadow-glow-emergency"
                  onClick={() => {
                    const msg = window.prompt('Enter your custom emergency broadcast message:');
                    if (msg && msg.trim() !== '') handleBroadcast(msg.trim());
                  }}
                >
                  Compose Custom Broadcast
                </Button>
              </div>

              {/* Dynamic Speed Limits */}
              <div className="gov-card border-t-4 border-t-primary shadow-lg hover:shadow-xl transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Gauge className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Dynamic Speed Control</h3>
                    <p className="text-sm text-muted-foreground">Override digital speed limits grid-wide</p>
                  </div>
                </div>
                
                <div className="flex gap-8 my-8 flex-1 items-center justify-center">
                  <Button variant="outline" className="w-32 h-32 rounded-full border-4 border-primary text-4xl font-black hover:bg-primary hover:text-white transition-all shadow-glow-primary hover:scale-110" onClick={() => setGlobalSpeedLimit(100)}>
                    100
                  </Button>
                  <Button variant="outline" className="w-28 h-28 rounded-full border-4 border-warning text-3xl font-black hover:bg-warning hover:text-white transition-all shadow-glow-warning hover:scale-110" onClick={() => setGlobalSpeedLimit(80)}>
                    80
                  </Button>
                  <Button variant="outline" className="w-24 h-24 rounded-full border-4 border-destructive text-2xl font-black hover:bg-destructive hover:text-white transition-all shadow-glow-emergency hover:scale-110" onClick={() => setGlobalSpeedLimit(40)}>
                    40
                  </Button>
                </div>
                <p className="text-sm text-center text-muted-foreground mt-4">Current Active Global Limit: <span className="font-bold text-foreground text-lg">100 km/h</span></p>
              </div>
              
              {/* Highway Surveillance Link Module */}
              <div className="gov-card border-t-4 border-t-accent shadow-lg hover:shadow-xl transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-accent/10 rounded-full">
                    <Activity className="w-6 h-6 text-accent animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">AI Surveillance System</h3>
                    <p className="text-sm text-muted-foreground">Automated video analytics & ANPR</p>
                  </div>
                </div>
                
                <div className="flex-1 space-y-6 mt-4">
                  <div className="flex items-center justify-between p-5 bg-card/60 rounded-xl border-2 border-border/50 shadow-sm">
                    <div className="flex items-center gap-3 text-base font-bold text-foreground">
                      <div className="w-3 h-3 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                      ANPR Cameras Online
                    </div>
                    <span className="font-black text-xl text-success tracking-widest">1,402 / 1,450</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-5 bg-card/60 rounded-xl border-2 border-border/50 shadow-sm">
                    <div className="flex items-center gap-3 text-base font-bold text-foreground">
                      <div className="w-3 h-3 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                      Congestion Detection Engine
                    </div>
                    <span className="font-black text-xl text-success tracking-widest">ACTIVE</span>
                  </div>

                  <div className="flex items-center justify-between p-5 bg-card/60 rounded-xl border-2 border-border/50 shadow-sm">
                    <div className="flex items-center gap-3 text-base font-bold text-foreground">
                      <div className="w-3 h-3 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                      Traffic Flow Processing Node
                    </div>
                    <span className="font-black text-xl text-primary tracking-widest">SCANNING...</span>
                  </div>
                </div>

                <Button variant="outline" className="w-full mt-4 border-accent text-accent hover:bg-accent hover:text-white transition-all">
                  Open Camera Grid (CCTV)
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6 animate-fade-in">
            <div className="gov-card border-none bg-gradient-to-br from-background to-primary/5 shadow-2xl relative">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground relative z-10 flex items-center">
                    <History className="w-6 h-6 mr-3 text-primary" />
                    Live Activity & Tracking Logs
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Detailed search history, location ping, and emergency escalation data</p>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  Secure Data Vault Active
                </Badge>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/80">
                    <tr>
                      <th className="px-6 py-4 rounded-tl-lg font-semibold max-w-[200px]">User Profile</th>
                      <th className="px-6 py-4 font-semibold">Latest Location</th>
                      <th className="px-6 py-4 font-semibold max-w-[250px]">Search History / Intent</th>
                      <th className="px-6 py-4 font-semibold rounded-tr-lg">Escalation & Call Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                          <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
                          <p>Waiting for secure real-time activity...</p>
                        </td>
                      </tr>
                    ) : realLogs.map((log) => {
                      const isSOS = log.searchHistory?.toLowerCase().includes('emergency') || log.searchHistory?.toLowerCase().includes('sos');
                      return (
                      <tr key={log.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isSOS ? 'bg-destructive/5' : ''}`}>
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-bold text-foreground text-base">{log.user.name}</div>
                            {isSOS && <Badge className="bg-destructive text-white animate-pulse text-[10px] h-4">EMERGENCY SOS</Badge>}
                          </div>
                          <div className="text-muted-foreground text-xs mt-1 flex items-center gap-1"><Phone className="w-3 h-3"/>{log.user.phone}</div>
                          <div className="text-muted-foreground text-xs mt-0.5">{log.user.email}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            <span className="font-medium">{log.lastLocation}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top italic text-muted-foreground">
                          "{log.searchHistory}"
                        </td>
                        <td className="px-6 py-4 align-top">
                          {log.escalation.limitExceeded !== "-" ? (
                            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-2">
                              <div className="flex items-center gap-2 mb-1">
                                <Gauge className="w-4 h-4 text-destructive" />
                                <span className="font-bold text-destructive text-xs uppercase tracking-wider">Critical Overspeed</span>
                              </div>
                              <span className="font-mono text-sm block mb-1">{log.escalation.limitExceeded}</span>
                            </div>
                          ) : isSOS ? (
                            <div className="bg-destructive/20 border border-destructive/30 p-3 rounded-lg mb-2">
                               <div className="flex items-center gap-2 mb-1">
                                 <AlertTriangle className="w-4 h-4 text-destructive" />
                                 <span className="font-bold text-destructive text-xs uppercase tracking-wider">SOS ACTIVATED</span>
                               </div>
                               <span className="text-xs text-destructive font-semibold">User requested immediate help</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="mb-2 text-warning border-warning">Medical / Breakdown</Badge>
                          )}
                          <div className="text-xs space-y-1">
                            <p><span className="text-muted-foreground font-semibold">Called:</span> <span className="text-foreground">{log.escalation.called}</span></p>
                            <p><span className="text-muted-foreground font-semibold">Time:</span> {log.escalation.date}</p>
                            <p><span className="text-muted-foreground font-semibold">Incident:</span> {log.escalation.incidentLocation}</p>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6 animate-fade-in">
            <div className="gov-card">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Registered Users</h3>
                  <p className="text-sm text-muted-foreground">Manage platform users and their roles</p>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-full items-center">
                  <Badge variant="default" className="ml-2 bg-primary/20 text-primary border-none">Total: {users.length}</Badge>
                </div>
              </div>

              {isLoadingUsers ? (
                <div className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4" />
                  Loading user data...
                </div>
              ) : users.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p>No user data available.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/80">
                      <tr>
                        <th className="px-6 py-4 rounded-tl-lg font-semibold">User Info</th>
                        <th className="px-6 py-4 font-semibold">Role</th>
                        <th className="px-6 py-4 font-semibold">Vehicle</th>
                        <th className="px-6 py-4 font-semibold">Joined Date</th>
                        <th className="px-6 py-4 rounded-tr-lg font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u._id || i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-foreground">{u.name}</div>
                            <div className="text-muted-foreground text-xs mt-1">{u.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                              {u.role === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                              {u.role}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            {u.vehicleNumber ? (
                              <Badge variant="outline" className="font-mono bg-background">
                                <Car className="w-3 h-3 mr-1" />
                                {u.vehicleNumber}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs italic">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Just now'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="overview" className="animate-fade-in space-y-8">

            {/* Performance & Security Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Server Performance */}
              <div className="gov-card border-t-4 border-t-primary shadow-lg">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <Server className="w-5 h-5 text-primary" />
                  Server Performance
                </h3>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> CPU Usage</span>
                      <span className="text-sm font-bold text-primary">{metrics.cpu}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-1000" style={{width: `${metrics.cpu}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2"><HardDrive className="w-4 h-4 text-accent" /> Memory (RAM)</span>
                      <span className="text-sm font-bold text-accent">{metrics.ram} / 8 GB</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-accent to-accent/70 rounded-full transition-all duration-1000" style={{width: `${(metrics.ram / 8) * 100}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2"><Database className="w-4 h-4 text-warning" /> Disk I/O</span>
                      <span className="text-sm font-bold text-warning">{metrics.disk} MB/s</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-warning to-warning/70 rounded-full transition-all duration-1000" style={{width: `${(metrics.disk / 300) * 100}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2"><ThermometerSun className="w-4 h-4 text-success" /> Server Temp</span>
                      <span className="text-sm font-bold text-success">{metrics.temp}°C (Normal)</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-success to-success/70 rounded-full transition-all duration-1000" style={{width: `${(metrics.temp / 100) * 100}%`}}></div></div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uptime: <strong className="text-foreground">99.98%</strong> (127 days)</span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">● Healthy</Badge>
                </div>
              </div>

              {/* Security & Network */}
              <div className="gov-card border-t-4 border-t-destructive shadow-lg">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <Lock className="w-5 h-5 text-destructive" />
                  Security & Network
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><Lock className="w-5 h-5 text-success" /></div>
                      <div>
                        <p className="font-semibold text-sm">SSL/TLS Certificate</p>
                        <p className="text-xs text-muted-foreground">Valid until Dec 2026</p>
                      </div>
                    </div>
                    <Badge className="bg-success/10 text-success border-success/30">Secure</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><Shield className="w-5 h-5 text-success" /></div>
                      <div>
                        <p className="font-semibold text-sm">Firewall Status</p>
                        <p className="text-xs text-muted-foreground">0 threats blocked today</p>
                      </div>
                    </div>
                    <Badge className="bg-success/10 text-success border-success/30">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Wifi className="w-5 h-5 text-primary" /></div>
                      <div>
                        <p className="font-semibold text-sm">Network Throughput</p>
                        <p className="text-xs text-muted-foreground">Avg. latency: 12ms</p>
                      </div>
                    </div>
                    <span className="font-bold text-primary text-sm">1.2 Gbps</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Zap className="w-5 h-5 text-warning" /></div>
                      <div>
                        <p className="font-semibold text-sm">API Rate Limiter</p>
                        <p className="text-xs text-muted-foreground">3,421 req/min (Cap: 10,000)</p>
                      </div>
                    </div>
                    <Badge className="bg-warning/10 text-warning border-warning/30">34%</Badge>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Last Security Audit: <strong className="text-foreground">2 hrs ago</strong></span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">All Clear</Badge>
                </div>
              </div>
            </div>

            {/* Database & Services Row */}
            <div className="gov-card border-t-4 border-t-accent shadow-lg">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Database className="w-5 h-5 text-accent" />
                Database & Microservices Health
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <Database className="w-8 h-8 mb-3 text-success" />
                  <p className="font-bold text-sm text-foreground">MongoDB Atlas</p>
                  <Badge variant="outline" className="mt-2 text-xs bg-success/10 text-success border-success/30">● Connected</Badge>
                </div>
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <Lock className="w-8 h-8 mb-3 text-success" />
                  <p className="font-bold text-sm text-foreground">Auth Service</p>
                  <Badge variant="outline" className="mt-2 text-xs bg-success/10 text-success border-success/30">● Running</Badge>
                </div>
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <MapPin className="w-8 h-8 mb-3 text-success" />
                  <p className="font-bold text-sm text-foreground">Route Engine</p>
                  <Badge variant="outline" className="mt-2 text-xs bg-success/10 text-success border-success/30">● Running</Badge>
                </div>
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <Shield className="w-8 h-8 mb-3 text-success" />
                  <p className="font-bold text-sm text-foreground">Toll Gateway</p>
                  <Badge variant="outline" className="mt-2 text-xs bg-success/10 text-success border-success/30">● Running</Badge>
                </div>
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <AlertTriangle className="w-8 h-8 mb-3 text-warning" />
                  <p className="font-bold text-sm text-foreground">Alert Dispatcher</p>
                  <Badge variant="outline" className="mt-2 text-xs bg-warning/10 text-warning border-warning/30">● Standby</Badge>
                </div>
              </div>
            </div>

            {/* Live Patrol & Rescue Units Section */}
            <div className="gov-card border-t-4 border-t-accent shadow-xl bg-gradient-to-br from-background to-accent/5">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground flex items-center gap-3">
                    <Activity className="w-6 h-6 text-accent animate-pulse" />
                    Live Highway Patrol & Rescue Units
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Real-time GPS deployment tracking of emergency units</p>
                </div>
                <Badge className="bg-accent/10 text-accent border-accent/30 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                  14 Units Active
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {patrolUnits.map((unit) => (
                  <div key={unit.id} className="p-5 bg-card border border-border rounded-2xl hover:shadow-lg transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        {unit.type.includes('Patrol') ? <Shield className="w-5 h-5 text-accent" /> : unit.type.includes('Life') ? <Hospital className="w-5 h-5 text-destructive" /> : <Car className="w-5 h-5 text-primary" />}
                      </div>
                      <Badge variant="outline" className={
                        unit.status === 'Responding' ? 'bg-destructive/10 text-destructive border-destructive/30 animate-pulse' : 
                        unit.status === 'On Patrol' ? 'bg-success/10 text-success border-success/30' : 
                        'bg-muted/50 text-muted-foreground'
                      }>
                        {unit.status}
                      </Badge>
                    </div>
                    <div className="relative z-10">
                      <p className="text-xs text-muted-foreground font-mono mb-1">{unit.id}</p>
                      <h4 className="font-bold text-foreground text-lg mb-1">{unit.type}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <MapPin className="w-3 h-3 text-accent" />
                        {unit.location}
                      </div>
                      <div className="pt-3 border-t border-border/50 flex justify-between items-center text-xs">
                        <span className="font-medium text-foreground">{unit.crew}</span>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${unit.health === 'Healthy' ? 'bg-success' : 'bg-destructive'}`} />
                          {unit.health}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-muted/30 rounded-xl border border-dashed border-border flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <Info className="w-4 h-4" />
                Click on any unit to initiate direct encrypted VOIP communication or reroute assignment.
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}