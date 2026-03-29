import { useState, useEffect, useCallback, useRef } from 'react';
import { Route } from '@/types';
import { LocationData } from './useLiveLocation';

/**
 * Calculates the Haversine distance between two points in kilometers.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

interface NavigationState {
  currentPosition: [number, number] | null;
  distanceRemaining: number; // km
  distanceTraveled: number; // km
  progressPercentage: number;
  etaMinutes: number;
  nextMilestone: {
    name: string;
    distance: number;
    type: 'toll' | 'hospital' | 'emergency';
  } | null;
  isArrived: boolean;
}

export function useNavigationLogic(
  route: Route | null,
  liveLocation: LocationData | null,
  isSimulation: boolean = false
) {
  const [navState, setNavState] = useState<NavigationState>({
    currentPosition: null,
    distanceRemaining: 0,
    distanceTraveled: 0,
    progressPercentage: 0,
    etaMinutes: 0,
    nextMilestone: null,
    isArrived: false,
  });

  const [simStep, setSimStep] = useState(0);

  // Simulation loop
  useEffect(() => {
    if (!isSimulation || !route || !route.polyline) return;

    const interval = setInterval(() => {
      setSimStep((prev) => {
        if (prev >= route.polyline!.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1000); // Move one point per second for demo

    return () => clearInterval(interval);
  }, [isSimulation, route]);

  useEffect(() => {
    if (!route || !route.polyline || route.polyline.length === 0) return;

    let currentCoords: [number, number];

    if (isSimulation) {
      currentCoords = route.polyline[simStep];
    } else if (liveLocation) {
      currentCoords = [liveLocation.latitude, liveLocation.longitude];
    } else {
      return;
    }

    // 1. Find the closest point in the polyline to the current position
    // (Simplistic approach: find the vertex index with minimum distance)
    let minDistance = Infinity;
    let closestIndex = 0;

    route.polyline.forEach((point, idx) => {
      const dist = calculateDistance(currentCoords[0], currentCoords[1], point[0], point[1]);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    // 2. Calculate distance remaining by summing remaining segments
    let remaining = 0;
    for (let i = closestIndex; i < route.polyline.length - 1; i++) {
      const p1 = route.polyline[i];
      const p2 = route.polyline[i + 1];
      remaining += calculateDistance(p1[0], p1[1], p2[0], p2[1]);
    }

    // 3. Calculate distance traveled
    const totalDist = route.distance;
    const traveled = Math.max(0, totalDist - remaining);
    const progress = Math.min(100, (traveled / totalDist) * 100);

    // 4. Find next milestone (Toll or Hospital)
    let nextMilestone: NavigationState['nextMilestone'] = null;
    
    // Check tolls
    const upcomingTolls = route.tollPlazas
      .map(t => ({ ...t, dist: t.lat && t.lng ? calculateDistance(currentCoords[0], currentCoords[1], t.lat, t.lng) : Infinity }))
      .filter(t => t.dist > 0.1) // Only count if > 100m away
      .sort((a, b) => a.dist - b.dist);
      
    if (upcomingTolls.length > 0) {
      nextMilestone = {
        name: upcomingTolls[0].name,
        distance: upcomingTolls[0].dist,
        type: 'toll'
      };
    }

    // Check emergency centers if they are closer
    const upcomingEmergency = route.emergencyCenters
      .map(e => ({ ...e, dist: e.lat && e.lng ? calculateDistance(currentCoords[0], currentCoords[1], e.lat, e.lng) : Infinity }))
      .filter(e => e.dist > 0.1)
      .sort((a, b) => a.dist - b.dist);

    if (upcomingEmergency.length > 0 && (!nextMilestone || upcomingEmergency[0].dist < nextMilestone.distance)) {
      nextMilestone = {
        name: upcomingEmergency[0].name,
        distance: upcomingEmergency[0].dist,
        type: upcomingEmergency[0].type === 'hospital' ? 'hospital' : 'emergency'
      };
    }

    // 5. ETA (Assuming constant speed if no real speed)
    const currentSpeedKmh = liveLocation?.speed ? liveLocation.speed * 3.6 : 60;
    const eta = remaining > 0 ? (remaining / Math.max(10, currentSpeedKmh)) * 60 : 0;

    setNavState({
      currentPosition: currentCoords,
      distanceRemaining: Number(remaining.toFixed(1)),
      distanceTraveled: Number(traveled.toFixed(1)),
      progressPercentage: Math.round(progress),
      etaMinutes: Math.round(eta),
      nextMilestone,
      isArrived: remaining < 0.2, // Within 200m
    });

  }, [route, liveLocation, isSimulation, simStep]);

  const resetSimulation = useCallback(() => {
    setSimStep(0);
  }, []);

  return { ...navState, resetSimulation, simStep };
}
