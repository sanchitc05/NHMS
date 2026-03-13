import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  MapPin,
  Navigation,
  Clock,
  IndianRupee,
  Route as RouteIcon,
  Car,
  Bike,
  Truck,
  Bus,
  AlertCircle,
  Hospital,
  Shield,
  Phone,
  Flame,
  CheckCircle,
  Map,
  Loader2,
  ArrowLeft,
  Target,
} from 'lucide-react';
import { mockRoutes } from '@/data/mockData';
import { Route, VehicleType, EmergencyCenter } from '@/types';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { RouteMap } from '@/components/features/RouteMap';
import { useSearchRoutes, calculateTollCost } from '@/hooks/useRoutes';

const vehicleIcons: Record<VehicleType, React.ComponentType<{ className?: string }>> = {
  car: Car,
  motorcycle: Bike,
  truck: Truck,
  bus: Bus,
};

const vehicleLabels: Record<VehicleType, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  truck: 'Truck',
  bus: 'Bus',
};

const emergencyIcons: Record<EmergencyCenter['type'], React.ComponentType<{ className?: string }>> = {
  hospital: Hospital,
  police: Shield,
  ambulance: Phone,
  fire: Flame,
};

export default function RoutePlanner() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [shouldSearch, setShouldSearch] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Fetch current location
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`http://localhost:3000/api/geocode/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
          const data = await res.json();
          if (data.success && data.exactAddress) {
            setSource(data.exactAddress);
            setShouldSearch(false);
          } else {
            setSource('Current Location');
          }
        } catch (e) {
          console.error('Reverse Geocode error:', e);
          setSource('Current Location');
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
        alert('Could not access your location. Please check your browser permissions.');
      }
    );
  };

  // Use the API hook for fetching routes
  const { 
    data: apiRoutes, 
    isLoading: isApiLoading, 
    error: apiError,
    isFetched: isApiFetched
  } = useSearchRoutes(source, destination, vehicleType, shouldSearch);

  // Fallback to mock data if API returns empty or fails
  const routes: Route[] = (() => {
    if (apiRoutes && apiRoutes.length > 0) {
      return apiRoutes;
    }
    if (shouldSearch && isApiFetched && (!apiRoutes || apiRoutes.length === 0)) {
      // Fallback to mock data with calculated toll costs
      return mockRoutes.map((route) => ({
        ...route,
        tollCost: calculateTollCost(route, vehicleType),
      }));
    }
    return [];
  })();

  const isSearching = isApiLoading;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSearch = () => {
    if (!source || !destination) return;
    setShouldSearch(true);
  };

  // Reset search when inputs change
  const handleSourceChange = (value: string) => {
    setSource(value);
    setShouldSearch(false);
  };

  const handleDestinationChange = (value: string) => {
    setDestination(value);
    setShouldSearch(false);
  };

  const handleVehicleTypeChange = (value: VehicleType) => {
    setVehicleType(value);
    if (shouldSearch) {
      // Re-trigger search with new vehicle type
      setShouldSearch(false);
      setTimeout(() => setShouldSearch(true), 0);
    }
  };

  const getTrafficColor = (level: Route['trafficLevel']) => {
    switch (level) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const VehicleIcon = vehicleIcons[vehicleType];

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
          <h1 className="text-3xl font-bold text-foreground mb-2">Route Planner</h1>
          <p className="text-muted-foreground">
            Find the best route with real-time traffic and toll information
          </p>
        </div>

        {/* Map Section */}
        <div className="mb-8 animate-fade-in">
          <div className="gov-card p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Map className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-foreground">Interactive Route Map</h3>
              {selectedRoute && (
                <span className="ml-auto text-sm text-muted-foreground">
                  Showing: {selectedRoute.name}
                </span>
              )}
            </div>
            <RouteMap 
              selectedRoute={selectedRoute}
              showAllRoutes={routes.length > 0 && !selectedRoute}
              routes={routes}
              className="h-[400px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Search Panel */}
          <div className="lg:col-span-1">
            <div className="gov-card sticky top-24">
              <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                <RouteIcon className="w-5 h-5 text-accent" />
                Plan Your Journey
              </h3>

              <div className="space-y-5">
                {/* Source */}
                <div className="space-y-2">
                  <Label htmlFor="source">Starting Point</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-success" />
                      <Input
                        id="source"
                        value={source}
                        onChange={(e) => handleSourceChange(e.target.value)}
                        placeholder="Enter starting location"
                        className="pl-10 gov-input"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleCurrentLocation}
                      disabled={isLocating}
                      title="Use Current Location"
                      className="shrink-0 h-[46px] w-[46px]" // matching gov-input height
                    >
                      {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>

                {/* Destination */}
                <div className="space-y-2">
                  <Label htmlFor="destination">Destination</Label>
                  <div className="relative">
                    <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-destructive" />
                    <Input
                      id="destination"
                      value={destination}
                      onChange={(e) => handleDestinationChange(e.target.value)}
                      placeholder="Enter destination"
                      className="pl-10 gov-input"
                    />
                  </div>
                </div>

                {/* Vehicle Type */}
                <div className="space-y-3">
                  <Label>Vehicle Type</Label>
                  <RadioGroup
                    value={vehicleType}
                    onValueChange={(value) => handleVehicleTypeChange(value as VehicleType)}
                    className="grid grid-cols-2 gap-3"
                  >
                    {Object.entries(vehicleLabels).map(([value, label]) => {
                      const Icon = vehicleIcons[value as VehicleType];
                      return (
                        <div key={value}>
                          <RadioGroupItem value={value} id={value} className="peer sr-only" />
                          <Label
                            htmlFor={value}
                            className="flex items-center gap-2 p-3 border-2 border-muted rounded-lg cursor-pointer transition-all hover:border-accent peer-data-[state=checked]:border-accent peer-data-[state=checked]:bg-accent/5"
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-sm">{label}</span>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </div>

                {/* Search Button */}
                <Button
                  onClick={handleSearch}
                  className="w-full"
                  size="lg"
                  disabled={!source || !destination || isSearching}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    'Find Routes'
                  )}
                </Button>

                {/* API Error Notice */}
                {apiError && (
                  <p className="text-xs text-muted-foreground text-center">
                    Using cached route data
                  </p>
                )}

                {/* Quick Select */}
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Quick Select:</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSource('Mumbai');
                      setDestination('Pune');
                    }}
                  >
                    Mumbai → Pune
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            {routes.length === 0 ? (
              <div className="gov-card text-center py-16">
                <RouteIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Routes Yet
                </h3>
                <p className="text-muted-foreground">
                  Enter your source and destination to find available routes
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">
                    Available Routes ({routes.length})
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <VehicleIcon className="w-4 h-4" />
                    {vehicleLabels[vehicleType]}
                  </div>
                </div>

                {routes.map((route, idx) => (
                  <div
                    key={route.id}
                    className={`gov-card cursor-pointer transition-all duration-300 ${
                      selectedRoute?.id === route.id
                        ? 'ring-2 ring-accent shadow-glow'
                        : 'hover:shadow-lg'
                    }`}
                    style={{ animationDelay: `${idx * 100}ms` }}
                    onClick={() => setSelectedRoute(route)}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                      <div>
                        <h4 className="font-semibold text-foreground text-lg mb-1">
                          {route.name}
                        </h4>
                        {(route.exactSource || route.exactDest) && (
                          <div className="text-xs text-muted-foreground mb-3 leading-relaxed">
                            <span className="font-medium">From:</span> {route.exactSource} <br/>
                            <span className="font-medium">To:</span> {route.exactDest}
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {route.distance} km
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTime(route.estimatedTime)}
                          </span>
                          <span className={`flex items-center gap-1 ${getTrafficColor(route.trafficLevel)}`}>
                            <AlertCircle className="w-4 h-4" />
                            {route.trafficLevel} traffic
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Toll Cost</p>
                          <p className="text-2xl font-bold text-accent flex items-center">
                            <IndianRupee className="w-5 h-5" />
                            {route.tollCost}
                          </p>
                        </div>
                        {selectedRoute?.id === route.id && (
                          <CheckCircle className="w-6 h-6 text-success" />
                        )}
                      </div>
                    </div>

                    {selectedRoute?.id === route.id && (
                      <div className="pt-4 border-t border-border space-y-4 animate-fade-in">
                        {/* Toll Plazas */}
                        <div>
                          <h5 className="text-sm font-medium text-foreground mb-2">Toll Plazas</h5>
                          <div className="flex flex-wrap gap-2">
                            {route.tollPlazas.map((plaza) => (
                              <span
                                key={plaza.id}
                                className="text-xs bg-muted px-3 py-1.5 rounded-full"
                              >
                                {plaza.name} - ₹{plaza.cost[vehicleType]}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Emergency Centers */}
                        <div>
                          <h5 className="text-sm font-medium text-foreground mb-2">
                            Nearby Emergency Centers
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {route.emergencyCenters.map((center) => {
                              const Icon = emergencyIcons[center.type];
                              return (
                                <div
                                  key={center.id}
                                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    center.type === 'hospital' ? 'bg-emergency/10 text-emergency' :
                                    center.type === 'police' ? 'bg-primary/10 text-primary' :
                                    center.type === 'ambulance' ? 'bg-warning/10 text-warning' :
                                    'bg-destructive/10 text-destructive'
                                  }`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {center.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {center.distance} km away
                                    </p>
                                    <a
                                      href={`tel:${center.phone}`}
                                      className="text-xs text-accent hover:underline"
                                    >
                                      {center.phone}
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <Button className="w-full" variant="accent">
                          Start Navigation
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
