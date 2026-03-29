import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:3055/api';

async function testEndpoint(name: string, url: string, method: 'GET' | 'POST' = 'GET', data: any = null) {
  console.log(`\n🔍 Testing ${name}...`);
  try {
    const config = {
      method,
      url: `${API_BASE}${url}`,
      data,
      timeout: 10000,
    };
    
    const start = Date.now();
    const response = await axios(config);
    const end = Date.now();
    
    console.log(`✅ ${name} Success (${end - start}ms)`);
    if (name === 'Chat AI') {
      console.log(`💬 AI Response: "${response.data.reply?.substring(0, 100)}..."`);
    } else if (name === 'Route Search') {
      console.log(`🛣️ Route Found: ${response.data.data?.[0]?.name} (${response.data.data?.[0]?.distance} km)`);
    } else if (name === 'Emergency') {
      console.log(`🚨 Nearby Centers: ${response.data.centers?.length || 0}`);
    } else if (name === 'Speed Limit') {
      console.log(`🚗 Road: ${response.data.roadName}, Limit: ${response.data.speed} km/h`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ ${name} Failed:`, error.response?.data?.error || error.message);
    return false;
  }
}

async function runDiagnostics() {
  console.log("==========================================");
  console.log("🛠️  NHMS SYSTEM DIAGNOSTICS");
  console.log("==========================================");

  const results = {
    chat: await testEndpoint('Chat AI', '/chat', 'POST', { 
      message: "Namaste! Tell me about the NHMS Virtual Assistant features.",
      history: []
    }),
    geocode: await testEndpoint('Geocoding', '/geocode/autocomplete?q=Mumbai'),
    routes: await testEndpoint('Route Search', '/routes?source=Mumbai&destination=Pune&vehicleType=car'),
    emergency: await testEndpoint('Emergency', '/nearby-emergency?lat=19.0760&lon=72.8777'),
    speed: await testEndpoint('Speed Limit', '/speed-limit?lat=19.0760&lon=72.8777'),
  };

  console.log("\n==========================================");
  console.log("📊 DIAGNOSTIC SUMMARY");
  console.log("==========================================");
  Object.entries(results).forEach(([key, val]) => {
    console.log(`${key.toUpperCase().padEnd(12)}: ${val ? '✅ PASS' : '❌ FAIL'}`);
  });
  console.log("==========================================");

  if (Object.values(results).every(v => v)) {
    console.log("🌟 SYSTEM STATUS: ALL SYSTEMS OPERATIONAL");
  } else {
    console.log("⚠️  SYSTEM STATUS: ISSUES DETECTED");
  }
}

runDiagnostics();
