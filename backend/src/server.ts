import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
const server = app.listen(config.port, () =>
  console.log(JSON.stringify({ event: "listening", port: config.port })),
);
process.on("SIGTERM", () =>
  server.close(() => {
    void pool.end();
  }),
);
