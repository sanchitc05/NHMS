import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
import { MongoMemoryServer } from 'mongodb-memory-server';

dotenv.config();

let mongoServer: MongoMemoryServer | null = null;

const connectDB = async () => {
  try {
    // Check if we should use the local in-memory DB as a fallback
    if (process.env.USE_LOCAL_DB === 'true') {
      console.log('Starting Local In-Memory MongoDB Server...');
      mongoServer = await MongoMemoryServer.create();
      const localUri = mongoServer.getUri();
      
      const conn = await mongoose.connect(localUri);
      console.log(`\n✅ MongoDB Connected Locally: ${conn.connection.host}`);
      console.log(`   (Data is stored in-memory and resets on server restart)`);
      return;
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('Error: MONGO_URI is not defined in .env');
      return;
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`\n✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    let currentIP = 'Unknown';
    try {
      // Try to get public IP to show in error message
      const response = await axios.get<{ ip: string }>('https://api.ipify.org?format=json');
      currentIP = response.data.ip;
    } catch (e) {
      // Silent fail if ipify is down
    }

    console.error(`\n=======================================================\n`);
    console.error(`❌ MONGODB CONNECTION ERROR:`);
    console.error(`   ${error.message}`);
    console.error(`\n   YOUR PUBLIC IP: ${currentIP}`);
    console.error(`\n   Possible causes:`);
    console.error(`   1. Your current PUBLIC IP (${currentIP}) is NOT whitelisted on MongoDB Atlas.`);
    console.error(`      (Your private IP 10.189.80.96 will NOT work!)`);
    console.error(`   2. Your network is blocking the connection (Port 27017).`);
    console.error(`   Please check https://cloud.mongodb.com -> Security -> Network Access\n`);
    console.error(`=======================================================\n`);
    // Do not process.exit(1), let the server run so it can tell the frontend
  }
};

export default connectDB;
