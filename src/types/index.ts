export interface User {
  id: string;
  name: string;
  email: string;
  role: 'traveller' | 'admin';
  vehicleNumber?: string;
}

export interface Route {
  id: string;
  name: string;
  distance: number; // in km
  estimatedTime: number; // in minutes
  tollCost: number; // in currency
  trafficLevel: 'low' | 'medium' | 'high';
  tollPlazas: TollPlaza[];
  emergencyCenters: EmergencyCenter[];
  polyline?: [number, number][];      // Coordinates from Backend
  sourceCoords?: [number, number];    // Point A
  destCoords?: [number, number];      // Point B
  exactSource?: string;
  exactDest?: string;
}

export interface TollPlaza {
  id: string;
  name: string;
  location: string;
  lat?: number;
  lng?: number;
  cost: {
    car: number;
    motorcycle: number;
    truck: number;
    bus: number;
  };
}

export interface EmergencyCenter {
  id: string;
  name: string;
  type: 'hospital' | 'police' | 'ambulance' | 'fire';
  distance: number; // km from route
  phone: string;
  address: string;
  lat?: number;
  lng?: number;
}

export interface SpeedData {
  currentSpeed: number;
  speedLimit: number;
  isOverspeeding: boolean;
  warningCount: number;
  location: string;
}

export interface WeatherData {
  condition: 'clear' | 'cloudy' | 'rain' | 'fog' | 'storm';
  temperature: number;
  visibility: 'good' | 'moderate' | 'poor';
  advisory?: string;
}

export interface TrafficAlert {
  id: string;
  type: 'accident' | 'congestion' | 'construction' | 'weather';
  severity: 'low' | 'medium' | 'high';
  location: string;
  message: string;
  timestamp: Date;
}

export interface EmergencyAlert {
  id: string;
  vehicleNumber: string;
  driverName: string;
  location: string;
  type: 'overspeeding' | 'accident' | 'breakdown' | 'medical';
  timestamp: Date;
  status: 'active' | 'responding' | 'resolved';
  speedData?: SpeedData;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type VehicleType = 'car' | 'motorcycle' | 'truck' | 'bus';
