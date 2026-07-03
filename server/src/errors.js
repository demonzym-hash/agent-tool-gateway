export class HttpError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFound(resource) {
  return new HttpError(404, "not_found", `${resource} not found`);
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const statusCode = err.statusCode || 500;
  req.log?.error({ err }, "request failed");
  res.status(statusCode).json({
    error: {
      code: err.code || "internal_error",
      message: statusCode >= 500 ? "Internal server error" : err.message,
      details: err.details,
    },
  });
}
