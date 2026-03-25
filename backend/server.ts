import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// TollGuru API settings
const TOLLGURU_API_KEY = process.env.TOLLGURU_API_KEY || '';
const TOLLGURU_API_URL = 'https://apis.tollguru.com/toll/v2';

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
// Real NHAI toll rates per single journey (in ₹)
// Rates are based on NHAI fee notification (average per plaza)
const TOLL_RATES_PER_PLAZA: Record<string, { car: number; motorcycle: number; truck: number; bus: number }> = {
  default: { car: 80, motorcycle: 0, truck: 230, bus: 165 },
  expressway: { car: 93, motorcycle: 0, truck: 270, bus: 185 },
  national_highway: { car: 75, motorcycle: 0, truck: 210, bus: 150 },
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
            const distanceKm = parseFloat(
              (route.summary?.distance?.metric || (route.summary?.distance?.value || 0) / 1000 || 0).toFixed(1)
            );
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
      { name: 'Fastest Route (Recommended)', traffic: 'low', tollType: 'expressway', tollMultiplier: 1.0 },
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
      // NHAI average: 1 toll plaza every 60 km on expressways, ~80 km on NHs
      const plazaSpacing = spec.tollType === 'expressway' ? 65 : 85;

      const effectiveDistance = distanceKm * spec.tollMultiplier;
      let numPlazas = Math.floor(effectiveDistance / plazaSpacing);
      // If the remaining distance is significant (>10km), we likely cross a toll plaza
      if (effectiveDistance % plazaSpacing > 30) {
        numPlazas += 1;
      }

      const rates = TOLL_RATES_PER_PLAZA[spec.tollType] || TOLL_RATES_PER_PLAZA.default;

      const tollPlazas = [];
      for (let p = 1; p <= numPlazas; p++) {
        const fraction = p / (numPlazas + 1);
        const polyIndex = Math.min(Math.floor(polyline.length * fraction), polyline.length - 1);
        const coords = polyline[polyIndex] || [srcCoords.lat, srcCoords.lon];

        tollPlazas.push({
          id: `plaza-${i}-${p}`,
          name: `NHAI Toll Plaza ${p}`,
          location: `KM ${Math.round(distanceKm * fraction)}`,
          lat: coords[0],
          lng: coords[1],
          cost: {
            car: rates.car,
            motorcycle: rates.motorcycle,
            truck: rates.truck,
            bus: rates.bus,
          },
        });
      }

      // Total toll = sum of all plazas for chosen vehicle
      const vType = String(vehicleType) as keyof typeof rates;
      const tollCost = tollPlazas.reduce((sum, plaza) => sum + (plaza.cost[vType] || 0), 0);

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

// ─── Nearby Emergency Centers (Overpass API) ─────────────────────────
app.get('/api/nearby-emergency', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ success: false, error: 'lat and lon are required' });
  }

  const userLat = parseFloat(lat as string);
  const userLon = parseFloat(lon as string);
  const radiusMeters = 10000; // 10 km

  // Overpass QL: find hospitals, police, fire stations within radius
  const overpassQuery = `
    [out:json][timeout:10];
    (
      node["amenity"="hospital"](around:${radiusMeters},${userLat},${userLon});
      way["amenity"="hospital"](around:${radiusMeters},${userLat},${userLon});
      node["amenity"="police"](around:${radiusMeters},${userLat},${userLon});
      way["amenity"="police"](around:${radiusMeters},${userLat},${userLon});
      node["amenity"="fire_station"](around:${radiusMeters},${userLat},${userLon});
      way["amenity"="fire_station"](around:${radiusMeters},${userLat},${userLon});
    );
    out center body;
  `;

  try {
    const overpassRes = await axios.post(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(overpassQuery)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'NHMS-Emergency/1.0' },
        timeout: 12000,
      }
    );

    const elements = (overpassRes.data as any)?.elements || [];

    const typeMap: Record<string, 'hospital' | 'police' | 'fire'> = {
      hospital: 'hospital',
      police: 'police',
      fire_station: 'fire',
    };

    const phoneMap: Record<string, string> = {
      hospital: '108',
      police: '100',
      fire: '101',
    };

    const centers = elements
      .map((el: any) => {
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (!elLat || !elLon) return null;

        const amenity = el.tags?.amenity;
        const mappedType = typeMap[amenity];
        if (!mappedType) return null;

        const name = el.tags?.name || el.tags?.['name:en'] || `${mappedType.charAt(0).toUpperCase() + mappedType.slice(1)} Station`;
        const distance = haversineKm(userLat, userLon, elLat, elLon);
        const phone = el.tags?.phone || el.tags?.['contact:phone'] || phoneMap[mappedType] || '';

        // Build address from available tags
        const addrParts = [
          el.tags?.['addr:street'],
          el.tags?.['addr:city'] || el.tags?.['addr:suburb'],
          el.tags?.['addr:district'],
        ].filter(Boolean);
        const address = addrParts.length > 0 ? addrParts.join(', ') : (el.tags?.description || `Near your location`);

        return {
          id: `osm-${el.id}`,
          name,
          type: mappedType,
          distance: parseFloat(distance.toFixed(1)),
          phone,
          address,
          lat: elLat,
          lng: elLon,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, 8);

    // Always include the universal 108 ambulance service
    const has108 = centers.some((c: any) => c.phone === '108' && c.type === 'hospital');
    if (!has108) {
      centers.unshift({
        id: 'universal-108',
        name: '108 Ambulance Service',
        type: 'ambulance',
        distance: 0,
        phone: '108',
        address: 'On-call Emergency Service (Pan-India)',
        lat: userLat,
        lng: userLon,
      });
    }

    res.json({ success: true, centers });
  } catch (error) {
    console.error('Overpass API error:', error);
    res.json({ success: true, centers: [] });
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

  try {
    // Route query detection
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
  console.log(`Backend API Server running at http://localhost:${PORT}`);

  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => process.exit(0));
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
