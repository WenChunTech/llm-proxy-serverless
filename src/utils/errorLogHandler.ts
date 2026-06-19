import { Context } from "hono";
import {
  clearErrorLogs,
  type ErrorLogType,
  getErrorLogs,
} from "../services/errorLog.ts";

const VALID_TYPES: ErrorLogType[] = [
  "request_conversion",
  "response_conversion",
  "response_500",
];

export async function handleGetErrorLogs(c: Context) {
  const type = c.req.query("type") as ErrorLogType | undefined;
  const limit = parseInt(c.req.query("limit") || "100", 10);

  if (type && !VALID_TYPES.includes(type)) {
    return c.json(
      {
        success: false,
        error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
      },
      400,
    );
  }

  const logs = await getErrorLogs({ type, limit });

  return c.json({
    success: true,
    data: logs,
    count: logs.length,
  });
}

export async function handleClearErrorLogs(c: Context) {
  await clearErrorLogs();
  return c.json({
    success: true,
    message: "All error logs cleared",
  });
}
