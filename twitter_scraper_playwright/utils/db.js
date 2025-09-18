import { Pool } from 'pg';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.resolve('/root/programming/clarityFeed/.env') });
const pool = new Pool({
    user: 'your_username',
    host: 'localhost',
    database: 'your_db',
    password: 'your_password',
    port: 5432,
});
// simple wrapper for queries
export const query = (text, params) => pool.query(text, params);
