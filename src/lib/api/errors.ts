/**
 * Consistent API error model.
 *
 * Every error response has the shape:
 *   { "error": { "code": "VALIDATION_ERROR", "message": "..." } }
 *
 * Codes are stable strings (safe for programmatic handling and log
 * correlation). Stack traces and DB internals never leave the process.
 */
import { ZodError } from "zod";
import { NextResponse } from "next/server";

export const ERROR_CODES = {
  VALIDATION_ERROR: { status: 400, message: "Request validation failed." },
  UNAUTHORIZED: { status: 401, message: "Authentication is required." },
  FORBIDDEN: { status: 403, message: "You do not have access to this resource." },
  COMPANY_NOT_FOUND: { status: 404, message: "Company not found." },
  ROLE_NOT_FOUND: { status: 404, message: "Role not found." },
  LEVEL_NOT_FOUND: { status: 404, message: "Level not found." },
  LOCATION_NOT_FOUND: { status: 404, message: "Location not found." },
  NOT_FOUND: { status: 404, message: "Resource not found." },
  DUPLICATE_COMPENSATION: { status: 409, message: "This compensation record already exists." },
  INTERNAL_ERROR: { status: 500, message: "Something went wrong. Please try again." },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  constructor(code: ErrorCode, message?: string) {
    const spec = ERROR_CODES[code];
    super(message ?? spec.message);
    this.code = code;
    this.status = spec.status;
  }
}

/** First human-readable message from a Zod error, without leaking internals. */
export function firstZodMessage(err: ZodError): string {
  const first = err.issues[0];
  return first ? `${first.path.join(".")}: ${first.message}` : ERROR_CODES.VALIDATION_ERROR.message;
}

/**
 * Postgres unique violations surface as SQLSTATE 23505 on the pg driver error,
 * but ORMs may wrap it — walk the cause chain to find it reliably.
 */
function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i++) {
    const code = (current as { code?: string }).code;
    if (code === "23505") return true;
    const message = (current as { message?: string }).message ?? "";
    if (typeof message === "string" && message.includes("duplicate key")) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function errorResponse(code: ErrorCode, message?: string): NextResponse {
  const spec = ERROR_CODES[code];
  return NextResponse.json(
    { error: { code, message: message ?? spec.message } },
    { status: spec.status },
  );
}

/**
 * Route wrapper: normalizes thrown errors into the shared error model.
 * Unknown errors are logged server-side and returned as INTERNAL_ERROR
 * without stack traces or database details.
 */
export function safeHandler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.code, err.message);
      }
      if (err instanceof ZodError) {
        return errorResponse("VALIDATION_ERROR", firstZodMessage(err));
      }
      if (isUniqueViolation(err)) {
        // Database-level unique violation — the race-safe dedupe backstop.
        return errorResponse(
          "DUPLICATE_COMPENSATION",
          "A record with the same company, role, level, location and compensation already exists.",
        );
      }
      console.error("[api] unhandled error:", err);
      return errorResponse("INTERNAL_ERROR");
    }
  };
}
