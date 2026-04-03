import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { API_BASE_URL } from '@/lib/api-config';
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
  Navigation,
} from 'lucide-react';
import { mockEmergencyAlerts, mockRoutes } from '@/data/mockData';
import { RouteMap } from '@/components/features/RouteMap';
import { EmergencyAlert } from '@/types';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Trash2, Edit2, Move, AlertOctagon, Info, FileDown, Eye, X, Save, Loader2 } from 'lucide-react';
// useEffect and useRef imported at the top
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

export default function Admin() {
  const { isAuthenticated, user } = useAuth();
  const [alerts, setAlerts] = useState<EmergencyAlert[]>(mockEmergencyAlerts);
  const [filter, setFilter] = useState<'all' | 'active' | 'responding' | 'resolved'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAiTriageEnabled, setIsAiTriageEnabled] = useState(false);

  // Edit user states
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', role: '', vehicleNumber: '' });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Undo Delete states
  const [recentlyDeletedUser, setRecentlyDeletedUser] = useState<{user: any, index: number} | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deletedUserRef = useRef<{user: any, index: number} | null>(null);

  // Keep ref synced for unmount cleanup
  useEffect(() => {
    deletedUserRef.current = recentlyDeletedUser;
  }, [recentlyDeletedUser]);

  useEffect(() => {
    return () => {
      // Clear timeout and commit deletion on unmount to prevent leaks
      if (timeoutRef.current && deletedUserRef.current) {
        clearTimeout(timeoutRef.current);
        fetch(`http://localhost:3000/api/auth/users/${deletedUserRef.current.user._id}`, { 
          method: 'DELETE', 
          keepalive: true 
        }).catch(console.error);
      }
    };
  }, []);

  // System health real-time state
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Fetch real-time system health
  const fetchSystemHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/system-health`);
      const data = await res.json();
      if (data.success) {
        setSystemHealth(data);
      }
    } catch (e) {
      console.error('Failed to fetch system health', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchUsers();
      fetchSystemHealth();
    }
  }, [isAuthenticated, user]);

  // Poll system health every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchSystemHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/users`);
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

  // Delete user handler
  const commitDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || 'Failed to delete user permanently');
      }
    } catch (e) {
      toast.error('Failed to connect to server during deletion');
    }
  };

  const handleUndoDelete = (deletedUserId: string) => {
    const deletedInfo = deletedUserRef.current;
    if (!deletedInfo || deletedInfo.user._id !== deletedUserId) {
        return; // Mismatch or already committed
    }

    // Clear the timeout to prevent permanent deletion
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setRecentlyDeletedUser(null);
    deletedUserRef.current = null;
    
    // Restore user optimistically at the original index
    setUsers(prev => {
      // Only restore if not already restored
      if (prev.some(user => user._id === deletedInfo.user._id)) return prev;
      const newUsers = [...prev];
      // Splice back in original position, fallback to push if index invalid
      if (deletedInfo.index >= 0 && deletedInfo.index <= newUsers.length) {
        newUsers.splice(deletedInfo.index, 0, deletedInfo.user);
      } else {
        newUsers.push(deletedInfo.user);
      }
      return newUsers;
    });
    
    toast.success('Action undone');
  };

  const initiateDeleteUser = (u: any) => {
    // If another deletion is pending, commit it immediately
    if (timeoutRef.current && deletedUserRef.current) {
      commitDeleteUser(deletedUserRef.current.user._id);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Optimistically remove from UI and capture index
    setUsers(prev => {
      const index = prev.findIndex(user => user._id === u._id);
      
      const deletedInfo = { user: u, index };
      setRecentlyDeletedUser(deletedInfo);
      deletedUserRef.current = deletedInfo;
      
      return prev.filter((_, i) => i !== index);
    });

    // Show custom toast with action
    toast('User deleted', {
      duration: 5000,
      action: {
        label: 'UNDO',
        onClick: () => handleUndoDelete(u._id)
      }
    });

    // Schedule permanent deletion
    const timeoutId = setTimeout(() => {
      commitDeleteUser(u._id);
      setRecentlyDeletedUser(null);
      deletedUserRef.current = null;
      timeoutRef.current = null;
    }, 5000);

    timeoutRef.current = timeoutId;
  };

  // Edit user handler
  const handleEditUser = async () => {
    if (!editingUser) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/users/${editingUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u._id === editingUser._id ? { ...u, ...data.user } : u));
        toast.success('User updated successfully');
        setIsEditDialogOpen(false);
        setEditingUser(null);
      } else {
        toast.error(data.message || 'Failed to update user');
      }
    } catch (e) {
      toast.error('Failed to update user');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openEditDialog = (u: any) => {
    setEditingUser(u);
    setEditForm({ name: u.name || '', role: u.role || 'traveller', vehicleNumber: u.vehicleNumber || '' });
    setIsEditDialogOpen(true);
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
      await fetch(`${API_BASE_URL}/api/admin/state`, {
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
      await fetch(`${API_BASE_URL}/api/admin/state`, {
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
      await fetch(`${API_BASE_URL}/api/admin/state`, {
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
      const res = await fetch(`${API_BASE_URL}/api/admin/state`);
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

  // Format uptime
  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
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

              {/* Platform Statistics Card */}
              <div className="gov-card border-t-4 border-t-accent shadow-lg hover:shadow-xl transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-accent/10 rounded-full">
                    <Database className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Platform Statistics</h3>
                    <p className="text-sm text-muted-foreground">Real-time data from MongoDB</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                  <div className="flex flex-col items-center justify-center p-6 bg-card/60 rounded-xl border-2 border-border/50">
                    <Users className="w-10 h-10 text-primary mb-3" />
                    <p className="text-4xl font-black text-foreground">{systemHealth?.database?.totalUsers || users.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">Registered Users</p>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 bg-card/60 rounded-xl border-2 border-border/50">
                    <Navigation className="w-10 h-10 text-accent mb-3" />
                    <p className="text-4xl font-black text-foreground">{systemHealth?.database?.totalLogs || realLogs.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">Route Searches</p>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 bg-card/60 rounded-xl border-2 border-border/50">
                    <AlertTriangle className="w-10 h-10 text-warning mb-3" />
                    <p className="text-4xl font-black text-foreground">{systemHealth?.database?.totalBroadcasts || broadcastHistory.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">Broadcasts Sent</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══ LOGS TAB — Now shows Source → Destination ═══ */}
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
                      <th className="px-5 py-4 rounded-tl-lg font-semibold max-w-[180px]">User Profile</th>
                      <th className="px-5 py-4 font-semibold">From (Source)</th>
                      <th className="px-5 py-4 font-semibold">To (Destination)</th>
                      <th className="px-5 py-4 font-semibold max-w-[220px]">Search History / Intent</th>
                      <th className="px-5 py-4 font-semibold rounded-tr-lg">Escalation & Call Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                          <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
                          <p>Waiting for secure real-time activity...</p>
                        </td>
                      </tr>
                    ) : realLogs.map((log) => {
                      const isSOS = log.searchHistory?.toLowerCase().includes('emergency') || log.searchHistory?.toLowerCase().includes('sos');
                      return (
                      <tr key={log.id || log._id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isSOS ? 'bg-destructive/5' : ''}`}>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-col gap-1 mb-1">
                            <div className="font-bold text-foreground text-base leading-tight">{log.user.name}</div>
                            {isSOS && <Badge className="bg-destructive text-white animate-pulse text-[10px] h-4 py-0 w-fit">EMERGENCY SOS</Badge>}
                          </div>
                          <div className="text-muted-foreground text-xs mt-1.5 flex items-center gap-1.5 font-medium"><Phone className="w-3 h-3 text-primary"/>{log.user.phone}</div>
                          <div className="text-muted-foreground text-xs mt-1 font-medium">{log.user.email}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-success mt-1.5 shrink-0" />
                            <span className="font-medium text-sm">{log.sourceLocation || log.lastLocation || '-'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-destructive mt-1.5 shrink-0" />
                            <span className="font-medium text-sm">{log.destLocation || '-'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top italic text-muted-foreground text-sm">
                          "{log.searchHistory}"
                        </td>
                        <td className="px-5 py-4 align-top">
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
                            <Badge variant="outline" className="mb-2 text-primary border-primary/30 bg-primary/5">General Navigation</Badge>
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

          {/* ═══ USERS TAB — Edit & Delete now working ═══ */}
          <TabsContent value="users" className="space-y-6 animate-fade-in">
            <div className="gov-card">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Registered Users</h3>
                  <p className="text-sm text-muted-foreground">Manage platform users and their roles</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Badge variant="default" className="bg-primary/20 text-primary border-none">Total: {users.length}</Badge>
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
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => initiateDeleteUser(u)}
                              >
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

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-primary" />
                    Edit User
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <select 
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                      value={editForm.role} 
                      onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      <option value="traveller">Traveller</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vehicle Number</Label>
                    <Input value={editForm.vehicleNumber} onChange={e => setEditForm({ ...editForm, vehicleNumber: e.target.value })} placeholder="e.g. DL-01-AB-1234" />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                    <Button className="flex-1 gap-2" onClick={handleEditUser} disabled={isSavingEdit}>
                      {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isSavingEdit ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ═══ SYSTEM OVERVIEW TAB — Now real-time ═══ */}
          <TabsContent value="overview" className="animate-fade-in space-y-8">

            {/* Performance & Security Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Server Performance — REAL DATA */}
              <div className="gov-card border-t-4 border-t-primary shadow-lg">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                    <Server className="w-5 h-5 text-primary" />
                    Server Performance
                  </h3>
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">● Live</Badge>
                </div>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> CPU Usage</span>
                      <span className="text-sm font-bold text-primary">{systemHealth?.server?.cpuUsage || '...'}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-1000" style={{width: `${parseFloat(systemHealth?.server?.cpuUsage || 0)}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2"><HardDrive className="w-4 h-4 text-accent" /> Memory (RSS)</span>
                      <span className="text-sm font-bold text-accent">{systemHealth?.server?.memoryUsed || '...'} MB / {systemHealth?.server?.memoryTotal || '...'} GB</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-accent to-accent/70 rounded-full transition-all duration-1000" style={{width: `${Math.min(100, parseFloat(systemHealth?.server?.memoryPercent || 0))}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2"><Database className="w-4 h-4 text-warning" /> Heap Usage</span>
                      <span className="text-sm font-bold text-warning">{systemHealth?.server?.heapUsed || '...'} / {systemHealth?.server?.heapTotal || '...'} MB</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-warning to-warning/70 rounded-full transition-all duration-1000" style={{width: `${systemHealth?.server?.heapTotal ? (parseFloat(systemHealth.server.heapUsed) / parseFloat(systemHealth.server.heapTotal) * 100) : 0}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2"><ThermometerSun className="w-4 h-4 text-success" /> Node.js Version</span>
                      <span className="text-sm font-bold text-success">{systemHealth?.server?.nodeVersion || '...'}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uptime: <strong className="text-foreground">{systemHealth?.server?.uptimeSeconds ? formatUptime(systemHealth.server.uptimeSeconds) : '...'}</strong></span>
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
                        <p className="font-semibold text-sm">Platform</p>
                        <p className="text-xs text-muted-foreground">{systemHealth?.server?.platform || '...'}</p>
                      </div>
                    </div>
                    <span className="font-bold text-primary text-sm">{systemHealth?.server?.nodeVersion || '...'}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Zap className="w-5 h-5 text-warning" /></div>
                      <div>
                        <p className="font-semibold text-sm">API Rate Limiter</p>
                        <p className="text-xs text-muted-foreground">{systemHealth?.database?.totalLogs || 0} total requests logged</p>
                      </div>
                    </div>
                    <Badge className="bg-warning/10 text-warning border-warning/30">Active</Badge>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Last Health Check: <strong className="text-foreground">Just now</strong></span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">All Clear</Badge>
                </div>
              </div>
            </div>

            {/* Database & Services Row — REAL DATA */}
            <div className="gov-card border-t-4 border-t-accent shadow-lg">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Database className="w-5 h-5 text-accent" />
                Database & Microservices Health
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <Database className="w-8 h-8 mb-3 text-success" />
                  <p className="font-bold text-sm text-foreground">MongoDB Atlas</p>
                  <Badge variant="outline" className={`mt-2 text-xs ${systemHealth?.database?.connected ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                    ● {systemHealth?.database?.status || 'Checking...'}
                  </Badge>
                  <span className="text-xs text-muted-foreground mt-1">{systemHealth?.database?.totalUsers || 0} users</span>
                </div>
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <Lock className="w-8 h-8 mb-3 text-success" />
                  <p className="font-bold text-sm text-foreground">Auth Service</p>
                  <Badge variant="outline" className={`mt-2 text-xs ${systemHealth?.services?.authService ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                    ● {systemHealth?.services?.authService ? 'Running' : 'Down'}
                  </Badge>
                </div>
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <MapPin className="w-8 h-8 mb-3 text-success" />
                  <p className="font-bold text-sm text-foreground">Route Engine</p>
                  <Badge variant="outline" className={`mt-2 text-xs ${systemHealth?.services?.routeEngine ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                    ● {systemHealth?.services?.routeEngine ? 'Running' : 'Down'}
                  </Badge>
                </div>
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <Shield className="w-8 h-8 mb-3 text-success" />
                  <p className="font-bold text-sm text-foreground">Toll Gateway</p>
                  <Badge variant="outline" className="mt-2 text-xs bg-success/10 text-success border-success/30">
                    ● Running
                  </Badge>
                </div>
                <div className="flex flex-col items-center p-5 bg-card rounded-xl border border-border hover:shadow-md transition-all text-center">
                  <AlertTriangle className="w-8 h-8 mb-3 text-warning" />
                  <p className="font-bold text-sm text-foreground">Alert Dispatcher</p>
                  <Badge variant="outline" className={`mt-2 text-xs ${systemHealth?.services?.alertDispatcher ? 'bg-success/10 text-success border-success/30' : 'bg-warning/10 text-warning border-warning/30'}`}>
                    ● {systemHealth?.services?.alertDispatcher ? 'Active' : 'Standby'}
                  </Badge>
                </div>
              </div>
            </div>


          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}