import { useQuery } from '@tanstack/react-query';
import { Route, VehicleType } from '@/types';
interface RoutesApiResponse {
  success: boolean;
  data: Route[] | null;
  error: string | null;
  timestamp?: string;
}

// Use the local backend instead of Supabase
import { API_URL } from '@/lib/api-config';

async function fetchRoutes(
  source?: string,
  destination?: string,
  vehicleType: VehicleType = 'car',
  sourceCoords?: { lat: number; lon: number } | null,
  destCoords?: { lat: number; lon: number } | null
): Promise<Route[]> {
  const params = new URLSearchParams();
  if (source) params.append('source', source);
  if (destination) params.append('destination', destination);
  params.append('vehicleType', vehicleType);
  if (sourceCoords) {
    params.append('srcLat', sourceCoords.lat.toString());
    params.append('srcLon', sourceCoords.lon.toString());
  }
  if (destCoords) {
    params.append('destLat', destCoords.lat.toString());
    params.append('destLon', destCoords.lon.toString());
  }

  const response = await fetch(`${API_URL}/routes?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch routes: ${response.statusText}`);
  }

  const result: RoutesApiResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch routes');
  }

  return result.data || [];
}

async function fetchRouteById(
  routeId: string,
  vehicleType: VehicleType = 'car'
): Promise<Route | null> {
  // If we had a specific backend for ID we would hit it, but for our backend 
  // we can just return null or hit a known endpoint if needed.
  // We'll leave it simple for now, as RoutePlanner uses fetchRoutes.
  return null;
}

/**
 * Hook to fetch all routes or filter by source/destination
 */
export function useRoutes(
  source?: string,
  destination?: string,
  vehicleType: VehicleType = 'car',
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['routes', { source, destination, vehicleType }],
    queryFn: () => fetchRoutes(source, destination, vehicleType),
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch routes when search is triggered
 */
export function useSearchRoutes(
  source: string,
  destination: string,
  vehicleType: VehicleType,
  shouldSearch: boolean,
  sourceCoords?: { lat: number; lon: number } | null,
  destCoords?: { lat: number; lon: number } | null
) {
  return useQuery({
    queryKey: ['routes', 'search', { source, destination, vehicleType, sourceCoords, destCoords }],
    queryFn: () => fetchRoutes(source, destination, vehicleType, sourceCoords, destCoords),
    enabled: shouldSearch && !!source && !!destination,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Hook to fetch a single route by ID
 */
export function useRoute(routeId: string | null, vehicleType: VehicleType = 'car') {
  return useQuery({
    queryKey: ['route', routeId, vehicleType],
    queryFn: () => fetchRouteById(routeId!, vehicleType),
    enabled: !!routeId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Utility function to calculate toll cost for a route with a specific vehicle type
 */
export function calculateTollCost(route: Route, vehicleType: VehicleType): number {
  return route.tollPlazas.reduce(
    (sum, plaza) => sum + (plaza.cost[vehicleType] || 0),
    0
  );
}
