import { err } from "../utils/response";
import { logger } from "../utils/logger";

export function handleError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Internal server error";
  logger.error(message);
  return err(message, 500);
}
