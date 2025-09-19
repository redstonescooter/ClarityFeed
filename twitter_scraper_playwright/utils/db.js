import { Pool } from 'pg';
import pkg from "pg";
const { Client } = pkg;
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.resolve('/root/programming/clarityFeed/.env') });
import { PositiveInt } from "./typeZod";
const pool = new Pool({
    user: process.env.PG_USER || 'Sentiment',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DB || 'Sentiment',
    password: process.env.PG_PASSWORD || 'SentimentPassword',
    port: PositiveInt.parse(process.env.PG_PORT) || 5432,
});
// simple wrapper for queries
export const query = (text, params) => pool.query(text, params);
export async function createDatabase() {
    const client = new Client({
        user: "postgres", // superuser
        host: "localhost",
        password: "your_password",
        port: 5432,
        database: "postgres", // connect to default DB first
    });
    try {
        await client.connect();
        const dbName = "my_new_db";
        await client.query(`CREATE DATABASE ${dbName}`);
        console.log(`Database ${dbName} created successfully.`);
    }
    catch (err) {
        console.error("Error creating DB:", err);
    }
    finally {
        await client.end();
    }
}
createDatabase();
