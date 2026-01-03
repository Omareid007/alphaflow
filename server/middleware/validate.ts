import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { log } from "../utils/logger";

type ValidationTarget = "body" | "query" | "params";

interface ValidatedRequest extends Request {
  validatedBody?: unknown;
  validatedQuery?: unknown;
  validatedParams?: unknown;
}

/**
 * Express middleware for Zod schema validation
 * @param schema - Zod schema to validate against
 * @param target - Which part of the request to validate (body, query, or params)
 */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  target: ValidationTarget = "body"
) {
  return (req: ValidatedRequest, res: Response, next: NextFunction) => {
    const data = req[target];
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        path: err.path.join("."),
        message: err.message,
        code: err.code,
      }));

      log.warn("Validation", `Failed for ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        errors,
      });

      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    // Attach validated data to request
    if (target === "body") {
      req.validatedBody = result.data;
    } else if (target === "query") {
      req.validatedQuery = result.data;
    } else if (target === "params") {
      req.validatedParams = result.data;
    }
    next();
  };
}

/**
 * Validate multiple parts of the request at once
 */
export function validateAll(schemas: {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}) {
  return (req: ValidatedRequest, res: Response, next: NextFunction) => {
    const allErrors: Array<{ target: string; path: string; message: string }> =
      [];
    const validatedData: Record<string, unknown> = {};

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      const data = req[target as keyof Request];
      const result = schema.safeParse(data);

      if (!result.success) {
        allErrors.push(
          ...result.error.errors.map((err) => ({
            target,
            path: err.path.join("."),
            message: err.message,
          }))
        );
      } else {
        validatedData[target] = result.data;
      }
    }

    if (allErrors.length > 0) {
      log.warn("Validation", `Failed for ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        errors: allErrors,
      });

      return res.status(400).json({
        error: "Validation failed",
        details: allErrors,
      });
    }

    // Attach all validated data
    req.validatedBody = validatedData.body;
    req.validatedQuery = validatedData.query;
    req.validatedParams = validatedData.params;

    next();
  };
}

/**
 * Type helper to extract the validated data type from a schema
 */
export type ValidatedData<T extends z.ZodTypeAny> = z.infer<T>;

/**
 * Get validated body with type safety
 */
export function getValidatedBody<T>(req: ValidatedRequest): T {
  return req.validatedBody as T;
}

/**
 * Get validated query with type safety
 */
export function getValidatedQuery<T>(req: ValidatedRequest): T {
  return req.validatedQuery as T;
}

/**
 * Get validated params with type safety
 */
export function getValidatedParams<T>(req: ValidatedRequest): T {
  return req.validatedParams as T;
}
