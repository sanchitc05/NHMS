const http = require('http');

const data = JSON.stringify({
  name: 'Test',
  phone: '1234567890',
  vehicleNumber: 'KA-01-HH-1234'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/profile/admin_001',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('RESPONSE:', res.statusCode, body));
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
