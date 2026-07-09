import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled error:", err);

  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "Validation error",
      details: (err as any).errors,
    });
  }

  const status = (err as any).statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}
