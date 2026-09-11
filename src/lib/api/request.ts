/** Request parsing helpers shared by route handlers. */
import { ApiError } from "./errors";

/** Parse a JSON body, turning malformed JSON into a VALIDATION_ERROR. */
export async function readJsonBody<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}
