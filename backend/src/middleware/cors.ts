import type { RequestHandler } from "express";
import { isAllowedOrigin } from "../config.js";
import { ApiError } from "./errors.js";
export const cors: RequestHandler = (req, res, next) => {
  const origin = req.get("Origin");
  res.vary("Origin");
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin!);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,HEAD,POST,PATCH,OPTIONS",
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token");
  }
  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin))
      return next(
        new ApiError(403, "ORIGIN_REJECTED", "Invalid request origin."),
      );
    res.status(204).end();
    return;
  }
  next();
};
