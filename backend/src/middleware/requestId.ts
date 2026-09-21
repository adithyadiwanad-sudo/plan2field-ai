import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
export const requestId: RequestHandler = (_req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader("X-Request-ID", res.locals.requestId);
  next();
};
export const throttled:RequestHandler=(_req,res)=>{res.status(429).json({code:'RATE_LIMITED',message:'Too many requests. Please wait and try again.',fieldErrors:{},requestId:res.locals.requestId});};
