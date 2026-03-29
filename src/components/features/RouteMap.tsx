import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Route, TollPlaza, EmergencyCenter } from '@/types';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const createIcon = (color: string, emoji: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      font-size: 24px;
      line-height: 1;
    ">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

const tollIcon = createIcon('#f59e0b', '💰');
const hospitalIcon = createIcon('#ef4444', '🏥');
const policeIcon = createIcon('#3b82f6', '👮');
const ambulanceIcon = createIcon('#22c55e', '🚑');
const fireIcon = createIcon('#dc2626', '🔥');
const startIcon = createIcon('#22c55e', '🚀');
const endIcon = createIcon('#ef4444', '🏁');

const vehicleEmojis: Record<string, string> = {
  car: '🚗',
  motorcycle: '🏍️',
  truck: '🚚',
  bus: '🚌',
};

const emergencyIcons: Record<EmergencyCenter['type'], L.DivIcon> = {
  hospital: hospitalIcon,
  police: policeIcon,
  ambulance: ambulanceIcon,
  fire: fireIcon,
};

interface RouteMapProps {
  selectedRoute?: Route | null;
  tollPlazas?: TollPlaza[];
  emergencyCenters?: EmergencyCenter[];
  showAllRoutes?: boolean;
  routes?: Route[];
  className?: string;
  currentPosition?: [number, number] | null;
  isNavigating?: boolean;
  vehicleType?: string;
}

export function RouteMap({
  selectedRoute,
  showAllRoutes = false,
  routes = [],
  className = '',
  currentPosition,
  isNavigating = false,
  vehicleType = 'car',
}: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  // Default Center of India if no routes
  const center: [number, number] = [20.5937, 78.9629];

  const getRouteColor = (routeId: string, isSelected: boolean) => {
    if (isSelected) return '#f97316';
    const colors = ['#3b82f6', '#22c55e', '#8b5cf6'];
    const index = routes.findIndex(r => r.id === routeId);
    return colors[index % colors.length] || '#3b82f6';
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView(center, 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapInstanceRef.current = map;
    setIsMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map content
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;

    const map = mapInstanceRef.current;

    // Clear existing markers and polylines
    markersRef.current.forEach(marker => marker.remove());
    polylinesRef.current.forEach(polyline => polyline.remove());
    markersRef.current = [];
    polylinesRef.current = [];

    const displayRoutes = showAllRoutes ? routes : (selectedRoute ? [selectedRoute] : []);
    const allCoords: [number, number][] = [];

    // Add route polylines
    displayRoutes.forEach((route) => {
      if (!route.polyline || route.polyline.length === 0) return;
      
      const coords = route.polyline;
      const isSelected = selectedRoute?.id === route.id;
      
      if (isSelected && isNavigating && currentPosition) {
        // Find split point
        let closestIdx = 0;
        let minDist = Infinity;
        coords.forEach((p, i) => {
          const d = Math.pow(p[0] - currentPosition[0], 2) + Math.pow(p[1] - currentPosition[1], 2);
          if (d < minDist) {
            minDist = d;
            closestIdx = i;
          }
        });

        // Traveled segment (grayish)
        const traveled = L.polyline(coords.slice(0, closestIdx + 1), {
          color: '#94a3b8',
          weight: 5,
          opacity: 0.6,
          dashArray: '5, 10'
        }).addTo(map);
        
        // Remaining segment (bold highlight)
        const remaining = L.polyline(coords.slice(closestIdx), {
          color: '#3b82f6',
          weight: 6,
          opacity: 1,
        }).addTo(map);

        polylinesRef.current.push(traveled, remaining);
      } else {
        const polyline = L.polyline(coords, {
          color: getRouteColor(route.id, isSelected),
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 1 : 0.6,
        }).addTo(map);
        polylinesRef.current.push(polyline);
      }

      if (isSelected || showAllRoutes) {
        allCoords.push(...coords);
      }
    });

    // Handle user position marker
    if (currentPosition) {
      const emoji = vehicleEmojis[vehicleType] || '🚗';
      const dynamicUserIcon = createIcon('#3b82f6', emoji);
      
      const userMarker = L.marker(currentPosition, { 
        icon: dynamicUserIcon,
        zIndexOffset: 1000 
      })
      .bindPopup(`<div class="font-semibold text-primary">Your ${vehicleType}</div>`)
      .addTo(map);
      markersRef.current.push(userMarker);

      if (isNavigating && currentPosition) {
        // Smoothly center the map on the user if in navigation mode
        map.setView(currentPosition, Math.max(map.getZoom(), 15), { animate: true });
      }
    }

    // Add start and end point markers
    const mainRoute = selectedRoute || displayRoutes[0];
    if (mainRoute && mainRoute.sourceCoords && mainRoute.destCoords) {
      const startMarker = L.marker(mainRoute.sourceCoords, { icon: startIcon })
        .bindPopup('<div class="font-semibold">Starting Point</div>')
        .addTo(map);
      
      const endMarker = L.marker(mainRoute.destCoords, { icon: endIcon })
        .bindPopup('<div class="font-semibold">Destination</div>')
        .addTo(map);
      
      markersRef.current.push(startMarker, endMarker);
    }

    // Add toll plaza markers
    if (selectedRoute?.tollPlazas) {
      selectedRoute.tollPlazas.forEach((plaza) => {
        if (!plaza.lat || !plaza.lng) return;
        
        const coords: [number, number] = [plaza.lat, plaza.lng];
        
        const marker = L.marker(coords, { icon: tollIcon })
          .bindPopup(`
            <div class="p-1">
              <div class="font-semibold text-sm">${plaza.name}</div>
              <div class="text-xs text-gray-600">${plaza.location}</div>
              <div class="text-xs mt-1">
                <span class="font-medium">Toll: </span>
                Car ₹${plaza.cost.car} | Bike ₹${plaza.cost.motorcycle}
              </div>
            </div>
          `)
          .addTo(map);
        
        markersRef.current.push(marker);
      });
    }

    // Add emergency center markers
    if (selectedRoute?.emergencyCenters) {
      selectedRoute.emergencyCenters.forEach((center) => {
        if (!center.lat || !center.lng) return;

        const coords: [number, number] = [center.lat, center.lng];
        
        const marker = L.marker(coords, { icon: emergencyIcons[center.type] })
          .bindPopup(`
            <div class="p-1">
              <div class="font-semibold text-sm">${center.name}</div>
              <div class="text-xs text-gray-600">${center.address}</div>
              <div class="text-xs mt-1">
                <span class="font-medium">Phone: </span>
                <a href="tel:${center.phone}" class="text-blue-600 hover:underline">${center.phone}</a>
              </div>
              <div class="text-xs">
                <span class="font-medium">Distance: </span>${center.distance} km
              </div>
            </div>
          `)
          .addTo(map);
        
        markersRef.current.push(marker);
      });
    }

    // Fit bounds only if not actively navigating (so it doesn't fight auto-center)
    if (allCoords.length > 0 && !isNavigating) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [selectedRoute, showAllRoutes, routes, isMapReady, currentPosition, isNavigating, vehicleType]);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-border ${className}`}>
      <div 
        ref={mapRef} 
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
      />

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border z-[1000]">
        <div className="text-xs font-semibold mb-2">Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span>Toll Plaza</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span>Hospital</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span>Police</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>Ambulance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
