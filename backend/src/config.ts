export const config = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL,
  origin:
    process.env.APP_ORIGIN ||
    (process.env.NODE_ENV === "production"
      ? "https://plan2field-ai.vercel.app"
      : "http://localhost:8080"),
  uploads: process.env.UPLOAD_DIR || "./uploads",
  secure:
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production",
};
export const allowedOrigins = (process.env.APP_ORIGINS || config.origin)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
export const isAllowedOrigin = (origin?: string) =>
  !!origin && allowedOrigins.includes(origin);
