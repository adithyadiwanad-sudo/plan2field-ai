import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const errors: ErrorRequestHandler = (err, req, res, _next) => {
  const validation = err instanceof ZodError;
  const status = validation
    ? 400
    : err.status ||
      (err.code === "LIMIT_FILE_SIZE"
        ? 413
        : err.name === "MulterError"
          ? 400
          : 500);
  if (status >= 500)
    console.error(
      JSON.stringify({ requestId: res.locals.requestId, error: err.message }),
    );
  res.status(status).json({
    code: validation
      ? "VALIDATION_ERROR"
      : status < 500
        ? err.code || "REQUEST_ERROR"
        : "INTERNAL_ERROR",
    message:
      status < 500
        ? err.message
        : "The request failed. See server logs with this request ID.",
    fieldErrors: validation ? err.flatten().fieldErrors : {},
    requestId: res.locals.requestId,
  });
};
