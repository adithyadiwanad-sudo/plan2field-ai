export const config = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL,
  origin: process.env.APP_ORIGIN || "http://localhost:8080",
  uploads: process.env.UPLOAD_DIR || "./uploads",
  secure: process.env.COOKIE_SECURE === "true",
};
