const axios = require('axios');

async function testAuth() {
  try {
    const timestamp = Date.now();
    const email = `testuser_${timestamp}@example.com`;
    const password = 'Password@123';

    console.log('Testing Registration...');
    const regRes = await axios.post('http://localhost:3000/api/auth/register', {
      name: 'Test User',
      email,
      password,
      vehicleNumber: 'MH-12-AB-3456'
    });
    console.log('Registration Response:', regRes.data);

    console.log('\nTesting Login...');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email,
      password
    });
    console.log('Login Response:', loginRes.data);
    
    console.log('\nTests passed!');
  } catch (error) {
    if (error.response) {
      console.error('Test failed with response:', error.response.data);
    } else {
      console.error('Test failed:', error.message);
    }
  }
}

testAuth();
