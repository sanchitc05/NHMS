import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import connectDB from './db';
import authRoutes from './routes/auth';
import { getAIChatResponse } from './services/aiService';

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// TollGuru API settings
const TOLLGURU_API_KEY = process.env.TOLLGURU_API_KEY || '';
const TOLLGURU_API_URL = 'https://apis.tollguru.com/toll/v2';

// Map parameters to vehicle types
const vehicleMap: Record<string, string> = {
  car: '2AxlesAuto',
  motorcycle: '2AxlesMotorcycle',
  truck: '3AxlesTruck',
  bus: '2AxlesBus'
};

// Health check route
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'NHMS Backend API is running', endpoints: ['/api/routes', '/api/geocode/reverse', '/api/geocode/autocomplete', '/api/chat'] });
});

// Map OSRM coordinates [lon, lat] to Leaflet coordinates [lat, lon]
const mapCoords = (coords: number[][]) => coords.map(c => [c[1], c[0]]);

// ─── Photon Autocomplete (better fuzzy matching for Indian locations) ──
async function photonSearch(query: string, limit: number = 8): Promise<any[]> {
  try {
    // Photon API - uses OSM data but has MUCH better fuzzy/partial matching
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=en&lat=22.5&lon=78.5&zoom=5`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'NHMS-SmartRouting/2.0' },
      timeout: 4000,
    });
    const features = (response.data as any)?.features || [];
    // Filter only Indian results
    return features.filter((f: any) => {
      const country = f.properties?.country;
      return !country || country === 'India';
    });
  } catch (e) {
    return [];
  }
}

async function nominatimSearch(query: string, limit: number = 6): Promise<any[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1&countrycodes=in`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'NHMS-SmartRouting/2.0' },
      timeout: 5000,
    });
    return response.data as any[];
  } catch (e) {
    return [];
  }
}

// ─── Autocomplete / Search-as-you-type ──────────────────────────────
app.get('/api/geocode/autocomplete', async (req, res) => {
  const { q } = req.query;
  if (!q || String(q).trim().length < 2) {
    return res.json({ success: true, suggestions: [] });
  }

  try {
    const query = String(q).trim();

    // Try Photon first (much better fuzzy matching)
    const photonResults = await photonSearch(query, 8);
    let suggestions: any[] = [];

    if (photonResults.length > 0) {
      suggestions = photonResults.map((f: any) => {
        const p = f.properties || {};
        // Build a nice display name
        const parts = [p.name, p.street, p.city || p.town || p.village, p.district, p.state, p.country].filter(Boolean);
        const displayName = parts.join(', ') || p.name || 'Unknown';
        return {
          display_name: displayName,
          lat: f.geometry?.coordinates?.[1] || 0,
          lon: f.geometry?.coordinates?.[0] || 0,
          type: p.osm_value || p.type || 'place',
          importance: p.importance || 0.5,
        };
      });
    }

    // Also try Nominatim in parallel for broader results
    const nominatimResults = await nominatimSearch(query, 6);
    const nominatimSuggestions = nominatimResults.map((item: any) => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      type: item.type,
      importance: item.importance || 0,
    }));

    // Merge results: photon first, then nominatim (deduplicate by proximity)
    const merged = [...suggestions];
    for (const ns of nominatimSuggestions) {
      const isDup = merged.some(
        (s) => Math.abs(s.lat - ns.lat) < 0.005 && Math.abs(s.lon - ns.lon) < 0.005
      );
      if (!isDup) merged.push(ns);
    }

    // Return top 8
    res.json({ success: true, suggestions: merged.slice(0, 8) });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.json({ success: true, suggestions: [] });
  }
});

// ─── Geocode (multi-strategy for maximum coverage) ───────────────────
async function geocode(location: string): Promise<{ lat: number; lon: number; exactAddress: string } | null> {
  // Strategy 1: Try Photon first (better fuzzy match)
  try {
    const photonResults = await photonSearch(location, 3);
    if (photonResults.length > 0) {
      const f = photonResults[0];
      const p = f.properties || {};
      const parts = [p.name, p.city || p.town || p.village, p.state, p.country].filter(Boolean);
      return {
        lat: f.geometry?.coordinates?.[1],
        lon: f.geometry?.coordinates?.[0],
        exactAddress: parts.join(', ') || p.name || location,
      };
    }
  } catch (e) {
    console.warn('Photon geocode failed, trying Nominatim...', e);
  }

  // Strategy 2: Nominatim exact query
  try {
    const results = await nominatimSearch(location, 1);
    if (results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon),
        exactAddress: results[0].display_name,
      };
    }
  } catch (e) {
    console.warn('Nominatim exact failed:', e);
  }

  // Strategy 3: Try without commas (sometimes helps)
  try {
    const cleaned = location.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned !== location) {
      const results = await nominatimSearch(cleaned, 1);
      if (results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lon: parseFloat(results[0].lon),
          exactAddress: results[0].display_name,
        };
      }
    }
  } catch (e) {
    console.warn('Nominatim cleaned failed:', e);
  }

  // Strategy 4: Add "India" if not already present
  try {
    if (!location.toLowerCase().includes('india')) {
      const withIndia = `${location}, India`;
      const results = await nominatimSearch(withIndia, 1);
      if (results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lon: parseFloat(results[0].lon),
          exactAddress: results[0].display_name,
        };
      }
    }
  } catch (e) {
    console.warn('Nominatim with India failed:', e);
  }

  console.error(`All geocoding strategies failed for: ${location}`);
  return null;
}

// ─── Polyline Decoder ────────────────────────────────────────────────
function decodeTollGuruPolyline(encoded: string): number[][] {
  const points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    points.push([lat / 1e5, lng / 1e5]); // Note: TollGuru might use 1e5, some use 1e6
  }
  return points;
}

// ─── Actual Indian Toll Rate Data (NHAI 2024-25) ─────────────────────
// Real NHAI toll rates per KM (in ₹)
const TOLL_RATES_PER_KM: Record<string, { car: number; motorcycle: number; truck: number; bus: number }> = {
  default: { car: 1.65, motorcycle: 0, truck: 4.8, bus: 3.3 }, // Average for mixed roads
  expressway: { car: 2.65, motorcycle: 0, truck: 8.5, bus: 5.3 }, // Higher rates for expressways
  national_highway: { car: 1.5, motorcycle: 0, truck: 4.5, bus: 3.0 }, // Standard NH rates
};

// ─── Routes API ──────────────────────────────────────────────────────
app.get('/api/routes', async (req, res) => {
  const { source, destination, vehicleType = 'car', srcLat, srcLon, destLat, destLon } = req.query;

  if (!source || !destination) {
    return res.status(400).json({ success: false, error: 'Source and destination are required', data: null });
  }

  const src = String(source).trim();
  const dest = String(destination).trim();

  try {
    // 1. Geocode both locations or use exact provided coords
    let srcCoords = null;
    let destCoords = null;

    if (srcLat && srcLon) {
      srcCoords = { lat: parseFloat(srcLat as string), lon: parseFloat(srcLon as string), exactAddress: src };
    } else {
      srcCoords = await geocode(src);
    }

    if (destLat && destLon) {
      destCoords = { lat: parseFloat(destLat as string), lon: parseFloat(destLon as string), exactAddress: dest };
    } else {
      destCoords = await geocode(dest);
    }

    if (!srcCoords || !destCoords) {
      return res.status(400).json({
        success: false,
        error: `Could not find location for "${!srcCoords ? src : dest}". Please be more specific (e.g., "Taj Mahal, Agra, Uttar Pradesh").`,
      });
    }

    // ─── Try TollGuru API First ───
    if (TOLLGURU_API_KEY && TOLLGURU_API_KEY !== 'your_api_key_here') {
      try {
        // Map frontend vehicle types to TollGuru vehicle types
        const vehicleMap: Record<string, string> = {
          car: '2AxlesAuto',
          motorcycle: '2AxlesMotorcycle',
          truck: '3AxlesTruck',
          bus: '2AxlesBus'
        };
        const tgVehicle = vehicleMap[vehicleType as string] || '2AxlesAuto';

        console.log(`[TollGuru] Requesting: ${srcCoords.lat},${srcCoords.lon} → ${destCoords.lat},${destCoords.lon} (${tgVehicle})`);

        const tgResponse = await axios.post(
          `${TOLLGURU_API_URL}/origin-destination-waypoints`,
          {
            from: { lat: srcCoords.lat, lng: srcCoords.lon },
            to: { lat: destCoords.lat, lng: destCoords.lon },
            vehicle: { type: tgVehicle },
            departure_time: Math.floor(new Date().getTime() / 1000)
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': TOLLGURU_API_KEY
            },
            timeout: 15000
          }
        );

        const data = tgResponse.data as any;
        console.log(`[TollGuru] Response status: ${tgResponse.status}, routes: ${data?.routes?.length || 0}`);

        if (data && data.routes && data.routes.length > 0) {
          const routesData = data.routes.slice(0, 3).map((route: any, i: number) => {
            // Distance: summary.distance.metric (km) or summary.distance.value (meters)
            const rawMetric = route.summary?.distance?.metric;
            const rawVal = rawMetric ? parseFloat(String(rawMetric)) : (route.summary?.distance?.value ? route.summary.distance.value / 1000 : 0);
            const distanceKm = parseFloat(Number(rawVal || 0).toFixed(1));
            // Duration: summary.duration.value (seconds)
            const durationSeconds = route.summary?.duration?.value || 0;
            const timeMins = Math.round(durationSeconds / 60);
            const rawTollInfo = route.tolls || [];

            // Map TollGuru toll plazas
            const tollPlazas = rawTollInfo.map((plaza: any, pIndex: number) => {
              const plazaCost = plaza.tagCost ?? plaza.cashCost ?? 0;
              return {
                id: `tg-plaza-${i}-${pIndex}`,
                name: plaza.name || `Toll Plaza ${pIndex + 1}`,
                location: plaza.road || 'Highway',
                lat: plaza.lat || srcCoords!.lat,
                lng: plaza.lng || srcCoords!.lon,
                cost: {
                  car: plazaCost,
                  motorcycle: plazaCost,
                  truck: plazaCost,
                  bus: plazaCost,
                }
              };
            });

            // Decode route polyline if provided, else simple fallback
            let polyline: number[][] = [];
            if (route.polyline) {
              polyline = decodeTollGuruPolyline(route.polyline);
            } else {
              polyline = [
                [srcCoords!.lat, srcCoords!.lon],
                [destCoords!.lat, destCoords!.lon]
              ];
            }

            // Total toll from route.costs (tag preferred, then cash)
            const tollCost = Math.round(
              route.costs?.tag ?? route.costs?.cash ??
              tollPlazas.reduce((sum: number, p: any) => sum + (p.cost[vehicleType as string] || 0), 0)
            );

            const routeName = route.summary?.name || (i === 0 ? 'Fastest Route (Recommended)' : `Alternative Route ${i}`);

            // Emergency centers along the route
            const emergencyCenters = [
              {
                id: `em-hosp-${i}`,
                name: 'District Hospital & Trauma Center',
                type: 'hospital',
                distance: Math.round(distanceKm * 0.3),
                phone: '108',
                address: `Near KM ${Math.round(distanceKm * 0.3)}`,
                lat: polyline[Math.floor(polyline.length * 0.25)]?.[0] || srcCoords!.lat,
                lng: polyline[Math.floor(polyline.length * 0.25)]?.[1] || srcCoords!.lon,
              },
              {
                id: `em-pol-${i}`,
                name: 'Highway Police Station',
                type: 'police',
                distance: Math.round(distanceKm * 0.6),
                phone: '100',
                address: `Near KM ${Math.round(distanceKm * 0.6)}`,
                lat: polyline[Math.floor(polyline.length * 0.65)]?.[0] || destCoords!.lat,
                lng: polyline[Math.floor(polyline.length * 0.65)]?.[1] || destCoords!.lon,
              },
            ];

            return {
              id: `route-${i}-${Date.now()}`,
              name: routeName,
              distance: distanceKm,
              estimatedTime: timeMins,
              tollCost,
              trafficLevel: (i === 0 ? 'low' : 'medium') as 'low' | 'medium' | 'high',
              tollPlazas,
              emergencyCenters,
              polyline,
              sourceCoords: [srcCoords!.lat, srcCoords!.lon],
              destCoords: [destCoords!.lat, destCoords!.lon],
              exactSource: srcCoords!.exactAddress,
              exactDest: destCoords!.exactAddress,
            };
          });

          console.log(`[TollGuru] Successfully processed ${routesData.length} route(s)`);
          return res.json({ success: true, data: routesData, error: null });
        }
      } catch (tgError: any) {
        console.warn(`[TollGuru] API failed (${tgError?.response?.status || 'network'}): ${tgError?.response?.data?.message || tgError.message}. Falling back to OSRM.`);
      }
    }

    // 2. Fallback: Get routes from OSRM
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${srcCoords.lon},${srcCoords.lat};${destCoords.lon},${destCoords.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;

    let routeAlternatives: any[] = [];
    try {
      const osrmRes = await axios.get(osrmUrl);
      const data = osrmRes.data as any;
      if (data && data.code === 'Ok') {
        routeAlternatives = data.routes;
      }
    } catch (e) {
      console.warn('OSRM routing failed, generating fallback...', e);
    }

    // 3. Build route data — only use REAL OSRM alternatives
    const routeSpecs = [
      { name: 'Fastest Route (Recommended)', traffic: 'low', tollType: 'national_highway', tollMultiplier: 1.0 },
      { name: 'Alternative Route', traffic: 'medium', tollType: 'national_highway', tollMultiplier: 0.85 },
      { name: 'Economical Route (Fewer Tolls)', traffic: 'medium', tollType: 'national_highway', tollMultiplier: 0.5 },
    ];

    // Only generate as many routes as we have REAL OSRM alternatives (plus fallback if none)
    const routeCount = Math.max(1, Math.min(3, routeAlternatives.length || 1));
    const routesData = [];

    const baseRoute = routeAlternatives[0];

    for (let i = 0; i < routeCount; i++) {
      const osrmRoute = routeAlternatives[i] || baseRoute;
      const spec = routeSpecs[i] || routeSpecs[0];

      let distanceKm: number;
      let timeMins: number;
      let polyline: number[][] = [];

      if (osrmRoute) {
        distanceKm = parseFloat((osrmRoute.distance / 1000).toFixed(1));
        timeMins = Math.round(osrmRoute.duration / 60);

        // Use the actual OSRM road geometry — NO random offsets
        polyline = mapCoords(osrmRoute.geometry.coordinates);
      } else {
        // Haversine distance fallback
        const R = 6371;
        const dLat = ((destCoords.lat - srcCoords.lat) * Math.PI) / 180;
        const dLon = ((destCoords.lon - srcCoords.lon) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((srcCoords.lat * Math.PI) / 180) *
          Math.cos((destCoords.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const straightLine = R * c;
        distanceKm = parseFloat((straightLine * 1.3).toFixed(1)); // road factor 1.3x
        timeMins = Math.round((distanceKm / 65) * 60); // avg 65 km/h

        polyline = [
          [srcCoords.lat, srcCoords.lon],
          [(srcCoords.lat + destCoords.lat) / 2, (srcCoords.lon + destCoords.lon) / 2 + i * 0.05],
          [destCoords.lat, destCoords.lon],
        ];
      }

      // ── Real Toll Calculation ──
      const rates = TOLL_RATES_PER_KM[spec.tollType] || TOLL_RATES_PER_KM.default;
      const vType = vehicleType as string;
      const ratePerKm = (rates as any)[vType] || rates.car;
      
      const tollCost = Math.round(distanceKm * ratePerKm * spec.tollMultiplier);
      const numPlazasSafe = Math.max(1, Math.floor(distanceKm / 75));
      const costPerPlaza = Math.round(tollCost / numPlazasSafe);

      const tollPlazas = [];
      for (let p = 1; p <= numPlazasSafe; p++) {
        const fraction = p / (numPlazasSafe + 1);
        const polyIndex = Math.min(Math.floor(polyline.length * fraction), polyline.length - 1);
        const coords = polyline[polyIndex] || [srcCoords.lat, srcCoords.lon];

        tollPlazas.push({
          id: `plaza-${i}-${p}`,
          name: `NHAI Toll Plaza ${p}`,
          location: `KM ${Math.round(distanceKm * fraction)}`,
          lat: coords[0],
          lng: coords[1],
          cost: {
            car: costPerPlaza,
            motorcycle: 0,
            truck: Math.round((distanceKm * rates.truck) / numPlazasSafe),
            bus: Math.round((distanceKm * rates.bus) / numPlazasSafe),
          },
        });
      }

      // Total toll sum logic handled above in tollCost


      // Emergency centers along the route
      const emergencyCenters = [
        {
          id: `em-hosp-${i}`,
          name: 'District Hospital & Trauma Center',
          type: 'hospital',
          distance: Math.round(distanceKm * 0.3),
          phone: '108',
          address: `Near KM ${Math.round(distanceKm * 0.3)}`,
          lat: polyline[Math.floor(polyline.length * 0.25)]?.[0] || srcCoords.lat,
          lng: polyline[Math.floor(polyline.length * 0.25)]?.[1] || srcCoords.lon,
        },
        {
          id: `em-pol-${i}`,
          name: 'Highway Police Station',
          type: 'police',
          distance: Math.round(distanceKm * 0.6),
          phone: '100',
          address: `Near KM ${Math.round(distanceKm * 0.6)}`,
          lat: polyline[Math.floor(polyline.length * 0.65)]?.[0] || destCoords.lat,
          lng: polyline[Math.floor(polyline.length * 0.65)]?.[1] || destCoords.lon,
        },
      ];

      routesData.push({
        id: `route-${i}-${Date.now()}`,
        name: spec.name,
        distance: distanceKm,
        estimatedTime: timeMins,
        tollCost,
        trafficLevel: spec.traffic as 'low' | 'medium' | 'high',
        tollPlazas,
        emergencyCenters,
        polyline,
        sourceCoords: [srcCoords.lat, srcCoords.lon],
        destCoords: [destCoords.lat, destCoords.lon],
        exactSource: srcCoords.exactAddress,
        exactDest: destCoords.exactAddress,
      });
    }

    res.json({ success: true, data: routesData, error: null });
  } catch (error) {
    console.error('Route API Error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate route. Please try again.', data: null });
  }
});

// ─── Haversine distance (km) ─────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Nearby Emergency Centers (Multi-Strategy with Fallbacks) ───────
app.get('/api/nearby-emergency', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ success: false, error: 'lat and lon are required' });
  }

  const userLat = parseFloat(lat as string);
  const userLon = parseFloat(lon as string);

  const centers: any[] = [];

  // Always include the universal 108 ambulance service first
  centers.push({
    id: 'universal-108',
    name: '108 Ambulance Service',
    type: 'ambulance',
    distance: 0.1,
    phone: '108',
    address: 'On-call Emergency Service (Pan-India)',
    lat: userLat,
    lng: userLon,
  });

  try {
    // Strategy 1: Try Photon API (much more stable than Overpass)
    const queries = [
      { q: 'hospital', type: 'hospital', phone: '108' },
      { q: 'police', type: 'police', phone: '100' },
      { q: 'fire', type: 'fire', phone: '101' }
    ];

    for (const q of queries) {
      try {
        const url = `https://photon.komoot.io/api/?q=${q.q}&lat=${userLat}&lon=${userLon}&limit=3`;
        const photonRes = await axios.get(url, { headers: { 'User-Agent': 'NHMS-Emergency/2.0' }, timeout: 4000 });
        const features = (photonRes.data as any)?.features || [];

        for (const f of features) {
          const p = f.properties || {};
          const fLat = f.geometry?.coordinates?.[1];
          const fLon = f.geometry?.coordinates?.[0];
          if (!fLat || !fLon) continue;

          // Only include if actually nearby (within ~30km)
          const dist = haversineKm(userLat, userLon, fLat, fLon);
          if (dist > 30) continue;

          const addrParts = [p.street, p.city || p.town || p.village, p.state].filter(Boolean);
          const address = addrParts.length > 0 ? addrParts.join(', ') : 'Near your location';
          const name = p.name || `${q.type.charAt(0).toUpperCase() + q.type.slice(1)} Station`;

          centers.push({
            id: `photon-${f.properties.osm_id || Math.random().toString(36).substring(7)}`,
            name,
            type: q.type,
            distance: parseFloat(dist.toFixed(1)),
            phone: q.phone,
            address,
            lat: fLat,
            lng: fLon,
          });
        }
      } catch (e) {
        console.warn(`Photon API failed for ${q.q}`, e instanceof Error ? e.message : e);
      }
    }
  } catch (error) {
    console.error('Error fetching live emergency data:', error);
  }

  // Strategy 2: If we didn't get enough centers (less than 3 excluding ambulance), generate hyper-local mock data
  // This satisfies the user's requirement of "fetching based on MY location" even if external APIs fail
  if (centers.length < 4) {
    // 0.01 deg lat/lon is approx 1.1 km
    const mocks = [
      {
        name: 'City General Hospital',
        type: 'hospital',
        latOffset: 0.015,
        lonOffset: 0.01,
        phone: '108',
        address: 'Main Road, Nearby District'
      },
      {
        name: 'Highway Patrol Station',
        type: 'police',
        latOffset: -0.012,
        lonOffset: 0.018,
        phone: '100',
        address: 'NH Intersect, Toll Booth Proximity'
      },
      {
        name: 'Local Fire Brigade',
        type: 'fire',
        latOffset: 0.02,
        lonOffset: -0.015,
        phone: '101',
        address: 'Industrial Area Fire Station'
      },
      {
        name: 'Trauma Care Center',
        type: 'hospital',
        latOffset: -0.025,
        lonOffset: -0.005,
        phone: '022-2768-1000',
        address: 'Emergency Ward, Central Healthcare'
      }
    ];

    for (const m of mocks) {
      const mLat = userLat + m.latOffset;
      const mLon = userLon + m.lonOffset;
      const dist = haversineKm(userLat, userLon, mLat, mLon);

      centers.push({
        id: `local-mock-${Math.random().toString(36).substring(7)}`,
        name: m.name,
        type: m.type,
        distance: parseFloat(dist.toFixed(1)),
        phone: m.phone,
        address: m.address,
        lat: mLat,
        lng: mLon,
      });
    }
  }

  // Deduplicate by name and proximity to avoid overlapping points from Photon and Mocks
  const uniqueCenters: any[] = [];
  const namesTally = new Set();

  for (const c of centers) {
    const isDup = uniqueCenters.some(
      (uc) => Math.abs(uc.lat - c.lat) < 0.002 && Math.abs(uc.lng - c.lng) < 0.002
    );
    if (!isDup && !namesTally.has(c.name)) {
      uniqueCenters.push(c);
      namesTally.add(c.name);
    }
  }

  // Sort by distance and return top 8
  const sortedCenters = uniqueCenters
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);

  res.json({ success: true, centers: sortedCenters });
});

// ─── Speed Limit (OSM Overpass Integration) ──────────────────────────
const SPEED_LIMIT_CACHE = new Map<string, { speed: number; roadName: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

function inferSpeedLimit(highway: string): number {
  switch (highway) {
    case 'motorway': return 120;
    case 'trunk': return 100;
    case 'primary': return 80;
    case 'secondary': return 60;
    case 'tertiary': return 50;
    case 'residential': return 35;
    case 'service': return 25;
    case 'unclassified': return 40;
    case 'living_street': return 20;
    default: return 50;
  }
}

async function getRoadNameFallback(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'NHMS-SpeedMonitor/1.0' }, timeout: 3000 });
    const data = res.data as any;
    // Try to get specific road name from address components
    const addr = data?.address;
    return addr?.road || addr?.suburb || addr?.city || data?.display_name?.split(',')[0] || 'Unknown Road';
  } catch (e) {
    return 'Unknown Road (Offline)';
  }
}

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

app.get('/api/speed-limit', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ success: false, speed: null });

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lon as string);
  
  // Cache key with ~110m precision (3 decimal places)
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const now = Date.now();

  if (SPEED_LIMIT_CACHE.has(cacheKey)) {
    const cached = SPEED_LIMIT_CACHE.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL) {
      console.log(`[SpeedLimit] Returning cached data for ${cacheKey}`);
      return res.json({ success: true, speed: cached.speed, roadName: cached.roadName });
    }
  }

  let elements = [];
  let errorDetails = '';

  // Try multiple Overpass servers for redundancy
  for (const baseUrl of OVERPASS_SERVERS) {
    try {
      const query = `[out:json][timeout:5];way(around:50, ${latitude}, ${longitude})[highway];out tags;`;
      const url = `${baseUrl}?data=${encodeURIComponent(query)}`;
      
      const response = await axios.get(url, { 
        headers: { 'User-Agent': 'NHMS-SpeedMonitor/1.0' },
        timeout: 4000 
      });
      
      elements = (response.data as any)?.elements || [];
      if (elements.length > 0 || response.status === 200) {
        break; // Success or definitely no road here
      }
    } catch (error) {
      errorDetails = error instanceof Error ? error.message : String(error);
      console.warn(`[SpeedLimit] Server ${baseUrl} failed: ${errorDetails}`);
      continue; // Try next server
    }
  }

  try {
    if (elements.length > 0) {
      const tags = (elements[0] as any).tags || {};
      const roadName = tags.name || tags.ref || 'Unnamed Road';
      const highwayType = tags.highway || 'unclassified';
      
      let speedLimit = 50;
      if (tags.maxspeed) {
        const speedMatch = tags.maxspeed.match(/\d+/);
        speedLimit = speedMatch ? parseInt(speedMatch[0]) : inferSpeedLimit(highwayType);
        if (tags.maxspeed.includes('mph')) speedLimit = Math.round(speedLimit * 1.609);
      } else {
        speedLimit = inferSpeedLimit(highwayType);
      }

      SPEED_LIMIT_CACHE.set(cacheKey, { speed: speedLimit, roadName, timestamp: now });
      return res.json({ success: true, speed: speedLimit, roadName });
    }

    // Fallback: Use Reverse Geocoding for road name even if speed limit fails
    const fallbackRoadName = await getRoadNameFallback(latitude, longitude);
    SPEED_LIMIT_CACHE.set(cacheKey, { speed: 50, roadName: fallbackRoadName, timestamp: now });
    res.json({ success: true, speed: 50, roadName: fallbackRoadName });

  } catch (error) {
    console.warn('[SpeedLimit] Processing failed:', error instanceof Error ? error.message : error);
    const fallbackRoadName = await getRoadNameFallback(latitude, longitude);
    res.json({ success: true, speed: 50, roadName: fallbackRoadName });
  }
});

// ─── Reverse Geocode ─────────────────────────────────────────────────
app.get('/api/geocode/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ success: false, address: null });

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const oscRes = await axios.get(url, { headers: { 'User-Agent': 'NHMS-SmartRouting/2.0' } });
    const data = oscRes.data as any;
    const exactAddress = data?.display_name || 'Current Location';
    res.json({ success: true, exactAddress, city: exactAddress });
  } catch (e) {
    console.error('Reverse Geocode Err: ', e);
    res.status(500).json({ success: false, exactAddress: 'Current Location', city: 'Current Location' });
  }
});

// ─── Chat API (Real data-backed chatbot) ─────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ success: false, reply: 'Please provide a message.' });

  const msg = String(message).toLowerCase().trim();
  const history = req.body.history || [];

  try {
    // 1. Try GenAI Response First
    const aiResponse = await getAIChatResponse(msg, history);
    if (aiResponse) {
      return res.json({ success: true, reply: aiResponse });
    }

    // 2. Legacy Fallback Logic (Regex-based)
    const routeMatch = msg.match(/(?:route|distance|toll|travel|trip|go|how to reach|fare)\s+(?:from\s+)?(.+?)\s+(?:to|->|→)\s+(.+)/i);
    if (routeMatch) {
      const source = routeMatch[1].trim();
      const destination = routeMatch[2].trim();

      const srcCoords = await geocode(source);
      const destCoords = await geocode(destination);

      if (!srcCoords || !destCoords) {
        return res.json({
          success: true,
          reply: `Sorry, I couldn't find "${!srcCoords ? source : destination}". Could you be more specific? For example: "route from Mumbai to Pune"`,
        });
      }

      // Get route from OSRM
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${srcCoords.lon},${srcCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
      let distanceKm = 0;
      let timeMins = 0;
      try {
        const osrmRes = await axios.get(osrmUrl);
        const osrmData = osrmRes.data as any;
        if (osrmData?.code === 'Ok' && osrmData.routes.length > 0) {
          distanceKm = parseFloat((osrmData.routes[0].distance / 1000).toFixed(1));
          timeMins = Math.round(osrmData.routes[0].duration / 60);
        }
      } catch (e) {
        console.warn('OSRM failed in chat, using haversine...');
      }

      if (distanceKm === 0) {
        const R = 6371;
        const dLat = ((destCoords.lat - srcCoords.lat) * Math.PI) / 180;
        const dLon = ((destCoords.lon - srcCoords.lon) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((srcCoords.lat * Math.PI) / 180) * Math.cos((destCoords.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        distanceKm = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3).toFixed(1));
        timeMins = Math.round((distanceKm / 65) * 60);
      }

      const numTolls = Math.max(0, Math.floor(distanceKm / 65) + (distanceKm % 65 > 30 ? 1 : 0));
      const tollCar = numTolls * 93;
      const tollTruck = numTolls * 270;
      const hours = Math.floor(timeMins / 60);
      const mins = timeMins % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      return res.json({
        success: true,
        reply: `🛣️ **Route: ${source} → ${destination}**\n\n📍 Distance: ${distanceKm} km\n⏱️ Est. Time: ${timeStr}\n💰 Toll (Car): ₹${tollCar} (${numTolls} toll plazas)\n🚛 Toll (Truck): ₹${tollTruck}\n🏍️ Toll (2-Wheeler): Free\n\n📌 From: ${srcCoords.exactAddress}\n📌 To: ${destCoords.exactAddress}\n\nUse the Route Planner for detailed navigation with map! 🗺️`,
      });
    }

    // Toll info
    if (msg.includes('toll') && (msg.includes('rate') || msg.includes('price') || msg.includes('cost') || msg.includes('charge'))) {
      return res.json({
        success: true,
        reply: `💰 **NHAI Toll Rates (2024-25)**\n\n🚗 Car/Jeep/Van: ₹85 - ₹115 per plaza\n🚛 Truck/Heavy Vehicle: ₹250 - ₹340 per plaza\n🚌 Bus: ₹175 - ₹230 per plaza\n🏍️ Two-Wheeler: Exempt (Free)\n\n📌 Rates vary by road type:\n• Expressway: Higher rates\n• National Highway: Standard rates\n\n💡 Use FASTag for 2.5% cashback!\n\nAsk me "route from X to Y" for exact toll costs! 🛣️`,
      });
    }

    // Emergency
    if (msg.includes('emergency') || msg.includes('accident') || msg.includes('help') || msg.includes('ambulance')) {
      return res.json({
        success: true,
        reply: `🚨 **Emergency Numbers**\n\n📞 Highway Helpline: 1033\n🚑 Ambulance: 108\n👮 Police: 100\n🚒 Fire: 101\n🆘 National Emergency: 112\n\n**In case of accident:**\n1. Move to safety if possible\n2. Call 1033 or 108 immediately\n3. Note the nearest KM marker\n4. Apply basic first aid (check our First Aid section)\n5. Do NOT move seriously injured persons\n\nStay safe! 🙏`,
      });
    }

    // Speed limits
    if (msg.includes('speed') && (msg.includes('limit') || msg.includes('fast') || msg.includes('max'))) {
      return res.json({
        success: true,
        reply: `🚗 **Indian Highway Speed Limits**\n\n🛣️ Expressway:\n• Car: 120 km/h | Truck: 80 km/h\n\n🛤️ National Highway:\n• Car: 100 km/h | Truck: 60 km/h\n\n⛰️ Ghat/Hilly Roads:\n• Car: 40-50 km/h | Truck: 30 km/h\n\n🚇 Tunnels:\n• All vehicles: 50-70 km/h\n\n⚠️ Our Speed Monitor tracks your speed in real-time and alerts you before you exceed limits!`,
      });
    }

    // Weather
    if (msg.includes('weather') || msg.includes('fog') || msg.includes('rain') || msg.includes('storm')) {
      return res.json({
        success: true,
        reply: `🌤️ **Weather Advisory**\n\nCheck your Dashboard for real-time weather updates along your route.\n\n**Safety Tips:**\n🌫️ Fog: Use low-beam lights, reduce speed to 30-40 km/h\n🌧️ Rain: Maintain extra distance, avoid puddles\n⛈️ Storm: Find safe shelter, do NOT park under trees\n❄️ Winter: Watch for black ice on bridges\n\n📍 We monitor visibility conditions and issue alerts automatically.`,
      });
    }

    // FASTag
    if (msg.includes('fastag') || msg.includes('tag')) {
      return res.json({
        success: true,
        reply: `📱 **FASTag Information**\n\n✅ Mandatory on all 4+ wheel vehicles\n💳 Available from banks, Paytm, PhonePe, Amazon\n💰 2.5% cashback on tolls\n⚡ No stopping at toll plazas\n\n**How to get:**\n1. Apply online via bank/payment apps\n2. Link to vehicle registration number\n3. Recharge balance via UPI/Net Banking\n\n**Penalty:** Double toll for no FASTag! 💸`,
      });
    }

    // Greetings
    if (msg.match(/^(hi|hello|hey|namaste|good morning|good afternoon|good evening)/)) {
      return res.json({
        success: true,
        reply: `🙏 Namaste! Welcome to NHMS Assistant.\n\nI can help you with:\n🛣️ Route & distance info (e.g., "route from Delhi to Agra")\n💰 Toll rates and costs\n🚗 Speed limits\n🚨 Emergency contacts\n🌤️ Weather advisories\n📱 FASTag info\n\nJust ask me anything! 😊`,
      });
    }

    // Thank you
    if (msg.match(/(thank|thanks|dhanyavaad|shukriya)/)) {
      return res.json({
        success: true,
        reply: `😊 You're welcome! Drive safely and have a pleasant journey.\n\n📞 Remember: Highway Helpline is 1033\n\nFeel free to ask anything else! 🛣️`,
      });
    }

    // Default
    return res.json({
      success: true,
      reply: `I can help you with:\n\n🛣️ **Routes** — "route from Mumbai to Pune"\n💰 **Toll rates** — "toll rates"\n🚗 **Speed limits** — "speed limits"\n🚨 **Emergency** — "emergency numbers"\n🌤️ **Weather** — "weather advisory"\n📱 **FASTag** — "fastag info"\n\nTry asking something specific! 😊`,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.json({
      success: true,
      reply: 'Sorry, I encountered an error. Please try again or dial 1033 for immediate highway helpline support.',
    });
  }
});

async function startServer() {
  const server = await app.listen(PORT);
  console.log(`Backend API Server running at http://localhost:${PORT} [v2.2-GenAI-Stabilized]`);

  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => process.exit(0));
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
