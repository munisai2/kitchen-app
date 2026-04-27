
const { createClient } = require('@sanity/client');
require('dotenv').config();

const client = createClient({
  projectId: process.env.EXPO_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.EXPO_PUBLIC_SANITY_DATASET,
  apiVersion: process.env.EXPO_PUBLIC_SANITY_API_VERSION,
  token: process.env.EXPO_PUBLIC_SANITY_TOKEN,
  useCdn: false,
});

async function testConnection() {
  console.log('Testing Sanity Connection...');
  console.log('Project ID:', process.env.EXPO_PUBLIC_SANITY_PROJECT_ID);
  
  try {
    const orders = await client.fetch('*[_type == "order"]');
    console.log('Successfully fetched orders:', orders.length);
    console.log('Connection Test: PASSED');
  } catch (err) {
    console.error('Connection Test: FAILED');
    console.error('Error Message:', err.message);
    if (err.statusCode) console.error('Status Code:', err.statusCode);
  }
}

testConnection();
