const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const envCandidates = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '..', '.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    if (process.env.MONGODB_URI) break;
  }
}

let isConnected = false;
let connectionPromise = null;

async function connectMongo() {
  if (connectionPromise) {
    return connectionPromise;
  }

  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não definida');
  }

  connectionPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: true
  });

  try {
    const connection = await connectionPromise;
    isConnected = true;
    const dbName = connection.connection.name || 'mongodb';
    console.log('MongoDB Atlas conectado com sucesso.');
    console.log(`Banco: ${dbName}`);
    return connection;
  } catch (error) {
    isConnected = false;
    connectionPromise = null;
    throw error;
  }
}

function getConnectionStatus() {
  const readyState = mongoose.connection.readyState;
  return {
    isConnected: isConnected || readyState === 1,
    readyState
  };
}

module.exports = { connectMongo, getConnectionStatus };
