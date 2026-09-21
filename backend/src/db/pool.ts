import pg from "pg";
import { config } from "../config.js";
pg.types.setTypeParser(1082, (value) => value);
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 20000,
});
