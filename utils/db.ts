import { Pool } from 'pg';
import pkg from "pg";
const { Client } = pkg;
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.resolve('/root/programming/clarityFeed/.env') });
import { PositiveInt } from "./typeZod";

const execAsync = promisify(exec);

class DB{
  PG_USER = process.env.PG_USER || 'Sentiment';
  PG_HOST = process.env.PG_HOST || 'localhost';
  PG_DB = process.env.PG_DB || 'Sentiment';
  PG_PASSWORD = process.env.PG_PASSWORD ;
  PG_PORT = PositiveInt.safeParse(process.env.PG_PORT).data ?? 5432
  // Configuration object
  dbConfig = {
    user: this.PG_USER,
    host: this.PG_HOST,
    database: this.PG_DB,
    password: this.PG_PASSWORD,
    port:this.PG_PORT,
  };
  adminMethod:string = null; // 'client' or 'sudo'
  pool:Pool = null;
  query:((text:string, params?:any[]) => Promise<any>) = null;
  // Superuser config for administrative tasks
  superUserConfig = {
      user: this.PG_USER,
    host: this.PG_HOST,
    password: process.env.PG_SUPERUSER_PASSWORD,
    port: this.PG_PORT,
    database: 'postgres', // Connect to default postgres DB for admin tasks
  };
  async init(){
    //initial pool reset
    if(this.pool != null){
      try {
        await this.pool.end();
      } catch (error) {
        console.log(error);
      }
      this.pool = null;
    }
    const testConnectionRes = await this.testConnection(this.dbConfig);
    if(testConnectionRes.success){
      console.log('✅ Database connection successful');
      if(this.pool == null){
        this.pool = new Pool(this.dbConfig);
      }
      this.query = (text, params) => {
        return this.pool.query(text, params);
      };
      return;
    }
    //determine the errors based on error codes
    const err = this.categorizeConnectionError(testConnectionRes.error);
    if(err !== 'USER_NOT_FOUND' && err !== 'DATABASE_NOT_FOUND' && !testConnectionRes.error.message.includes("password")){
      console.log('❌ Database connection failed:',testConnectionRes.error.code, testConnectionRes.error.message);
      throw new Error(err);
    }else{
      this.adminMethod = await this.determineAdminMethod();
    }
    if(err == 'USER_NOT_FOUND'){
      const userCreated = await this.createUser(this.PG_USER, this.PG_PASSWORD);
      if(!userCreated){
        throw new Error("Failed to create user: " + this.PG_USER);
      }
      await this.init();
    }
    if(err == 'DATABASE_NOT_FOUND'){
      const dbCreated = await this.createDatabase(this.PG_DB, this.PG_USER);
      if(!dbCreated){
        throw new Error("Failed to create database: " + this.PG_DB);
      }
      await this.init();
    }
    if(testConnectionRes.error.message.includes("password")){

    }
  }
  async executeAsPostgres(sqlCommand:string) {
    try {
      const command = `sudo -u postgres psql -c "${sqlCommand.replace(/"/g, '\\"')}"`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('NOTICE') && !stderr.includes('already exists')) {
        throw new Error(stderr);
      }
      
      return { success: true, output: stdout };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  async testConnection(config:Record<string, any>) {
    
    // await pool.end();
    try {
      const pool = new Pool(config);
      const client = await pool.connect();
      await client.query('SELECT 1');
      console.log('✓ db connection ok');
      this.pool = pool;
      await client.release();
      return {success : true}
    } catch (err) {
      console.error('✗ db connection fail:', err.message);
      return {success : false, error:err}
    }
  }
  categorizeConnectionError(err: any): string {
    const errorCode = err.code;
    const errorMessage = err.message?.toLowerCase() || '';

    // Database doesn't exist
    if (errorCode === '3D000') {
      return 'DATABASE_NOT_FOUND';
    }

    // Authentication failures (user doesn't exist or wrong password)
    if (errorCode === '28P01') {
      return 'AUTHENTICATION_FAILED'; // Could be wrong password or user doesn't exist
    }

    // User doesn't exist (specific case)
    if (errorCode === '28000') {
      return 'USER_NOT_FOUND';
    }

    // Connection refused - server not running or wrong host/port
    if (errorCode === 'ECONNREFUSED') {
      return 'CONNECTION_REFUSED'; // Wrong host/port or server not running
    }

    // Network unreachable - wrong host
    if (errorCode === 'ENETUNREACH' || errorCode === 'EHOSTUNREACH') {
      return 'HOST_UNREACHABLE';
    }

    // Timeout - could be network issues or wrong host/port
    if (errorCode === 'ETIMEDOUT') {
      return 'CONNECTION_TIMEOUT';
    }

    // SSL/TLS related errors
    if (errorMessage.includes('ssl') || errorMessage.includes('tls')) {
      return 'SSL_ERROR';
    }

    // Too many connections
    if (errorCode === '53300') {
      return 'TOO_MANY_CONNECTIONS';
    }

    // Generic network/DNS errors
    if (errorCode === 'ENOTFOUND') {
      return 'DNS_LOOKUP_FAILED'; // Wrong hostname
    }

    if (errorCode === 'ENOENT') {
      return 'SOCKET_PATH_NOT_FOUND'; // For Unix socket connections
    }

    // Default case
    return 'UNKNOWN_ERROR';
  }
  async determineAdminMethod() {
    console.log('🔍 Determining best admin method...');
    // Method 1: Try direct client connection as superuser
    console.log('📡 Testing direct superuser connection...');
    const clientTest = await this.testConnection(this.superUserConfig);
    if (clientTest.success) {
      console.log('✅ Direct superuser connection works');
      this.adminMethod = 'client';
      return 'client';
    }
    console.log('❌ Direct superuser connection failed:', clientTest.error.message);
    // Method 2: Try sudo approach
    console.log('🔧 Testing sudo approach...');
    const sudoTest = await this.executeAsPostgres('SELECT 1;');
    if (sudoTest.success) {
      console.log('✅ Sudo approach works');
      this.adminMethod = 'sudo';
      return 'sudo';
    }
    console.log('❌ Sudo approach failed:', sudoTest.error);
    // Both methods failed
    console.error('   - Cannot perform administrative tasks');
    throw new Error('No administrative access method available');
  }

  async sudo_checkIfUserExists(username:string) {
    const result = await this.executeAsPostgres(`SELECT 1 FROM pg_roles WHERE rolname = '${username}';`);
    if (!result.success) {
      return false;
    }
    return result.output.includes('(1 row)');
  }
  async sudo_checkIfDatabaseExists(dbname:string) {
    const result = await this.executeAsPostgres(`SELECT 1 FROM pg_database WHERE datname = '${dbname}';`);
    if (!result.success) {
      return false;
    }
    return result.output.includes('(1 row)');
  }
  async sudo_createUser(username:string, password:string) {
    try {
      console.log(`🔧 Creating user ${username} using sudo...`);
      
      // Check if user already exists
      if (await this.sudo_checkIfUserExists(username)) {
        console.log(`✗ User ${username} already exists`);
        return false;
      }
      
      // Create user with password and necessary permissions
      const createUserResult = await this.executeAsPostgres(
        `CREATE USER "${username}" WITH PASSWORD '${password}' CREATEDB;`
      );
      
      if (createUserResult.success) {
        console.log(`✓ User ${username} created successfully via sudo`);
        return true;
      } else {
        console.error(`✗ Failed to create user ${username}:`, createUserResult.error);
        return false;
      }
    } catch (error) {
      console.error(`✗ Error creating user ${username}:`, error.message);
      return false;
    }
  }
  async sudo_createDatabase(dbName:string, owner:string) {
    try {
      console.log(`🔧 Creating database ${dbName} using sudo...`);
      
      // Check if database already exists
      if (await this.sudo_checkIfDatabaseExists(dbName)) {
        console.log(`✗ Database ${dbName} already exists`);
        return true;
      }
      
      // Create database with owner
      const createDbResult = await this.executeAsPostgres(
        `CREATE DATABASE "${dbName}" OWNER "${owner}";`
      );
      
      if (createDbResult.success) {
        console.log(`✓ Database ${dbName} created successfully via sudo`);
        return true;
      } else {
        console.error(`✗ Failed to create database ${dbName}:`, createDbResult.error);
        return false;
      }
    } catch (error) {
      console.error(`✗ Error creating database ${dbName}:`, error.message);
      return false;
    }
  }
  async client_createUser(username:string, password:string) {
    const client = await this.pool.connect();
    try {
      // Check if user exists
      const userExists = await client.query(
        'SELECT 1 FROM pg_roles WHERE rolname = $1',
        [username]
      );
      
      if (userExists.rows.length === 0) {
        await client.query(`CREATE USER "${username}" WITH PASSWORD '${password}' CREATEDB`);
        console.log(`✓ User ${username} created successfully via client`);
        return true;
      } else {
        console.log(`✓ User ${username} already exists`);
        return true;
      }
    } catch (error) {
      console.error(`✗ Error creating user ${username} via client:`, error.message);
      return false;
    } finally {
      await client.release();
    }
  }

async client_createDatabase(dbName:string, owner:string) {
    const client = await this.pool.connect();
    try {
      // Check if database exists
      const dbExists = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
      );
      
      if (dbExists.rows.length === 0) {
        await client.query(`CREATE DATABASE "${dbName}" OWNER "${owner}"`);
        console.log(`✓ Database ${dbName} created successfully via client`);
        return true;
      } else {
        console.log(`✓ Database ${dbName} already exists`);
        return true;
      }
    } catch (error) {
      console.error(`✗ Error creating database ${dbName} via client:`, error.message);
      return false;
    } finally {
      await client.release();
    }
  }
  async client_checkIfUserExists(username:string) {
    const client = await this.pool.connect();
    try {
      // Check if user exists
      const userExists = await client.query(
        'SELECT 1 FROM pg_roles WHERE rolname = $1',
        [username]
      );
      
      if (userExists.rows.length === 0) {
        console.log(`✗ User ${username} doesnt exists`);
        return false;
      } else {
        console.log(`✓ User ${username} already exists`);
        return true;
      }
    } catch (error) {
      console.error(`✗ Error checking user existance ${username} via client:`, error.message);
      return false;
    } finally {
      await client.release();
    }
  }
  async client_checkIfDatabaseExists(dbname:string) {
    const client = await this.pool.connect();
    try {
      // Check if database exists
      const dbExists = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbname]
      );
      
      if (dbExists.rows.length === 0) {
        console.log(`✓ Database ${dbname} doesnt exists`);
        return false;
      } else {
        console.log(`✓ Database ${dbname} already exists`);
        return true;
      }
    } catch (error) {
      console.error(`✗ Error checking database existance ${dbname} via client:`, error.message);
      return false;
    } finally {
      await client.release();
    }
  }
  // Unified user creation that uses the determined method
  async createUser(username:string, password:string) {
    if (this.adminMethod === 'client') {
      return await this.client_createUser(username, password);
    } else if (this.adminMethod === 'sudo') {
      return await this.sudo_createUser(username, password);
    } else {
      throw new Error('No admin method determined');
    }
  }

  // Unified database creation that uses the determined method
  async createDatabase(dbName:string, owner:string) {
    if (this.adminMethod === 'client') {
      return await this.client_createDatabase(dbName, owner);
    } else if (this.adminMethod === 'sudo') {
      return await this.sudo_createDatabase(dbName, owner);
    } else {
      throw new Error('No admin method determined');
    }
  }
}

const db = new DB();
await db.init();
export { db };