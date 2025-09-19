import { Pool } from 'pg';
import pkg from "pg";
const { Client } = pkg;
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.resolve('/root/programming/clarityFeed/.env') });
import { PositiveInt } from "./typeZod";

let pool = null;

// Configuration object
const dbConfig = {
  user: process.env.PG_USER || 'Sentiment',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DB || 'Sentiment',
  password: process.env.PG_PASSWORD || 'SentimentPassword',
  port: PositiveInt.parse(process.env.PG_PORT) || 5432,
};

// Superuser config for administrative tasks
const superUserConfig = {
  user: process.env.PG_SUPERUSER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  password: process.env.PG_SUPERUSER_PASSWORD || process.env.PG_PASSWORD || 'SentimentPassword',
  port: PositiveInt.parse(process.env.PG_PORT) || 5432,
  database: 'postgres', // Connect to default postgres DB for admin tasks
};

async function testConnection(config) {
  const testClient = new Client(config);
  try {
    await testClient.connect();
    await testClient.query('SELECT 1');
    await testClient.end();
    return { success: true };
  } catch (error) {
    try {
      await testClient.end();
    } catch (endError) {
      // Ignore cleanup errors
    }
    return { success: false, error };
  }
}

async function createUser(username, password) {
  const client = new Client(superUserConfig);
  try {
    await client.connect();
    
    // Check if user exists
    const userExists = await client.query(
      'SELECT 1 FROM pg_roles WHERE rolname = $1',
      [username]
    );
    
    if (userExists.rows.length === 0) {
      await client.query(`CREATE USER "${username}" WITH PASSWORD '${password}'`);
      await client.query(`ALTER USER "${username}" CREATEDB`);
      console.log(`✓ User ${username} created successfully`);
      return true;
    } else {
      console.log(`✓ User ${username} already exists`);
      return true;
    }
  } catch (error) {
    console.error(`✗ Error creating user ${username}:`, error.message);
    return false;
  } finally {
    await client.end();
  }
}

async function createDatabase(dbName, owner) {
  const client = new Client(superUserConfig);
  try {
    await client.connect();
    
    // Check if database exists
    const dbExists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    
    if (dbExists.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}" OWNER "${owner}"`);
      console.log(`✓ Database ${dbName} created successfully`);
      return true;
    } else {
      console.log(`✓ Database ${dbName} already exists`);
      return true;
    }
  } catch (error) {
    console.error(`✗ Error creating database ${dbName}:`, error.message);
    return false;
  } finally {
    await client.end();
  }
}

async function checkPool(pool) {
  try {
    await pool.query('SELECT 1');
    console.log('✓ Postgres pool ready');
    return true;
  } catch (err) {
    console.error('✗ Postgres unreachable:', err.message);
    return false;
  }
}

async function initializeDatabase() {
  console.log('🔄 Initializing database connection...');
  
  // Step 1: Test initial connection
  console.log('📡 Testing initial connection...');
  let connectionTest = await testConnection(dbConfig);
  
  if (connectionTest.success) {
    console.log('✅ Initial connection successful');
    pool = new Pool(dbConfig);
    return pool;
  }
  
  console.log('❌ Initial connection failed:', connectionTest.error.message);
  
  // Step 2: Analyze the error and attempt fixes
  const error = connectionTest.error;
  const errorCode = error.code;
  const errorMessage = error.message.toLowerCase();
  
  // Step 2a: Check if it's a database connection issue
  if (errorCode === 'ECONNREFUSED' || errorMessage.includes('connection refused')) {
    console.error('🔴 Cannot connect to PostgreSQL server. Please check:');
    console.error('   - PostgreSQL server is running');
    console.error('   - Host and port are correct');
    console.error(`   - Host: ${dbConfig.host}, Port: ${dbConfig.port}`);
    throw new Error(`PostgreSQL server unreachable at ${dbConfig.host}:${dbConfig.port}`);
  }
  
  // Step 2b: Check if it's an authentication issue
  if (errorCode === '28P01' || errorMessage.includes('password authentication failed')) {
    console.error('🔴 Authentication failed. Please check:');
    console.error('   - Username and password are correct');
    console.error(`   - User: ${dbConfig.user}`);
    throw new Error(`Authentication failed for user: ${dbConfig.user}`);
  }
  
  // Step 2c: Check if database doesn't exist
  if (errorCode === '3D000' || errorMessage.includes('database') && errorMessage.includes('does not exist')) {
    console.log('🔧 Database does not exist. Attempting to create...');
    
    // First check if we can connect as superuser
    const superUserTest = await testConnection(superUserConfig);
    if (!superUserTest.success) {
      console.error('🔴 Cannot connect as superuser to create database');
      console.error('   - Check superuser credentials');
      throw new Error('Cannot connect as superuser: ' + superUserTest.error.message);
    }
    
    // Try to create the database
    const dbCreated = await createDatabase(dbConfig.database, dbConfig.user);
    if (dbCreated) {
      // Test connection again
      connectionTest = await testConnection(dbConfig);
      if (connectionTest.success) {
        console.log('✅ Database created and connection successful');
        pool = new Pool(dbConfig);
        return pool;
      }
    }
    
    throw new Error(`Failed to create database: ${dbConfig.database}`);
  }
  
  // Step 2d: Check if user doesn't exist
  if (errorCode === '28000' || (errorMessage.includes('role') && errorMessage.includes('does not exist'))) {
    console.log('🔧 User does not exist. Attempting to create...');
    
    // First check if we can connect as superuser
    const superUserTest = await testConnection(superUserConfig);
    if (!superUserTest.success) {
      console.error('🔴 Cannot connect as superuser to create user');
      throw new Error('Cannot connect as superuser: ' + superUserTest.error.message);
    }
    
    // Try to create the user
    const userCreated = await createUser(dbConfig.user, dbConfig.password);
    if (userCreated) {
      // Try to create the database as well (user might not exist, so database might not exist either)
      await createDatabase(dbConfig.database, dbConfig.user);
      
      // Test connection again
      connectionTest = await testConnection(dbConfig);
      if (connectionTest.success) {
        console.log('✅ User created and connection successful');
        pool = new Pool(dbConfig);
        return pool;
      }
    }
    
    throw new Error(`Failed to create user: ${dbConfig.user}`);
  }
  
  // Step 2e: Unknown error - cannot fix automatically
  console.error('🔴 Unknown database error that cannot be automatically fixed:');
  console.error(`   Error Code: ${errorCode}`);
  console.error(`   Error Message: ${error.message}`);
  throw new Error(`Unrecoverable database error: ${error.message}`);
}

// Initialize the database connection
try {
  pool = await initializeDatabase();
  
  // Final verification
  if (!await checkPool(pool)) {
    throw new Error('Pool verification failed after successful initialization');
  }
  
} catch (error) {
  console.error('💥 Fatal database initialization error:', error.message);
  throw error;
}

// Simple wrapper for queries
export const query = (text, params) => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool.query(text, params);
};


export { pool };