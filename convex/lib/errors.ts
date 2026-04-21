/**
 * Standardized error codes for the Queue application.
 * All ConvexError usages should use these codes.
 *
 * Security considerations:
 * - Error codes are safe to expose to clients
 * - Error messages should not leak internal implementation details
 * - Use consistent message formats across the codebase
 */

export const ErrorCode = {
  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",

  // Resource Not Found
  NOT_FOUND: "NOT_FOUND",
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND",
  STUDIO_NOT_FOUND: "STUDIO_NOT_FOUND",
  INSTRUCTOR_PROFILE_NOT_FOUND: "INSTRUCTOR_PROFILE_NOT_FOUND",
  STUDIO_PROFILE_NOT_FOUND: "STUDIO_PROFILE_NOT_FOUND",
  JOB_NOT_FOUND: "JOB_NOT_FOUND",
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND",
  CERTIFICATE_NOT_FOUND: "CERTIFICATE_NOT_FOUND",
  INSURANCE_NOT_FOUND: "INSURANCE_NOT_FOUND",
  CALENDAR_PROFILE_NOT_FOUND: "CALENDAR_PROFILE_NOT_FOUND",

  // Duplicate Resources
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  MULTIPLE_PROFILES_FOUND: "MULTIPLE_PROFILES_FOUND",
  AMBIGUOUS_ACCOUNT_RESOLUTION: "AMBIGUOUS_ACCOUNT_RESOLUTION",

  // Validation Errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_COORDINATES: "INVALID_COORDINATES",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Business Rule Violations
  OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED",
  RESOURCE_LIMIT_REACHED: "RESOURCE_LIMIT_REACHED",
  CONFLICT_STATE: "CONFLICT_STATE",
  CANNOT_ARCHIVE_PRIMARY_BRANCH: "CANNOT_ARCHIVE_PRIMARY_BRANCH",
  CANNOT_ARCHIVE_LAST_BRANCH: "CANNOT_ARCHIVE_LAST_BRANCH",
  CANNOT_ARCHIVE_BRANCH_WITH_OPEN_JOBS: "CANNOT_ARCHIVE_BRANCH_WITH_OPEN_JOBS",
  ONLY_ACTIVE_BRANCHES_CAN_BE_PRIMARY: "ONLY_ACTIVE_BRANCHES_CAN_BE_PRIMARY",

  // Payment & Billing
  PAYMENT_BLOCKED: "PAYMENT_BLOCKED",
  PAYMENT_METHOD_REQUIRED: "PAYMENT_METHOD_REQUIRED",
  STRIPE_ERROR: "STRIPE_ERROR",

  // External Integrations
  EXTERNAL_SERVICE_UNAVAILABLE: "EXTERNAL_SERVICE_UNAVAILABLE",
  EXTERNAL_API_ERROR: "EXTERNAL_API_ERROR",
  GOOGLE_CALENDAR_NOT_CONNECTED: "GOOGLE_CALENDAR_NOT_CONNECTED",
  GOOGLE_CALENDAR_ERROR: "GOOGLE_CALENDAR_ERROR",
  GEMINI_SERVICE_ERROR: "GEMINI_SERVICE_ERROR",
  GEMINI_UPLOAD_ERROR: "GEMINI_UPLOAD_ERROR",
  GEMINI_REVIEW_ERROR: "GEMINI_REVIEW_ERROR",
  STRIPE_CONNECT_ERROR: "STRIPE_CONNECT_ERROR",

  // Configuration
  MISSING_CONFIGURATION: "MISSING_CONFIGURATION",
  INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
  ENVIRONMENT_NOT_ALLOWED: "ENVIRONMENT_NOT_ALLOWED",

  // Upload & Storage
  UPLOAD_SESSION_INVALID: "UPLOAD_SESSION_INVALID",
  UPLOAD_SESSION_EXPIRED: "UPLOAD_SESSION_EXPIRED",
  UPLOAD_SESSION_ALREADY_USED: "UPLOAD_SESSION_ALREADY_USED",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_TYPE_NOT_ALLOWED: "FILE_TYPE_NOT_ALLOWED",
  CONTENT_TYPE_MISSING: "CONTENT_TYPE_MISSING",
  DOCUMENT_UNAVAILABLE: "DOCUMENT_UNAVAILABLE",
  DOCUMENT_INTEGRITY_ERROR: "DOCUMENT_INTEGRITY_ERROR",

  // Compliance
  COMPLIANCE_REQUIRED: "COMPLIANCE_REQUIRED",
  BILLING_EMAIL_INVALID: "BILLING_EMAIL_INVALID",
  IDENTITY_NOT_VERIFIED: "IDENTITY_NOT_VERIFIED",

  // Rate Limiting
  RATE_LIMITED: "RATE_LIMITED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",

  // Generic
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
  PRODUCTION_BLOCKED: "PRODUCTION_BLOCKED",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * User-facing error messages that don't leak implementation details.
 * Messages are intentionally generic for security.
 */
export const ErrorMessage = {
  [ErrorCode.UNAUTHORIZED]: "You are not logged in",
  [ErrorCode.FORBIDDEN]: "You don't have permission to perform this action",
  [ErrorCode.AUTHENTICATION_REQUIRED]: "Authentication required",
  [ErrorCode.ACCOUNT_DISABLED]: "Your account has been disabled",

  [ErrorCode.NOT_FOUND]: "The requested resource was not found",
  [ErrorCode.PROFILE_NOT_FOUND]: "Profile not found",
  [ErrorCode.STUDIO_NOT_FOUND]: "Studio not found",
  [ErrorCode.INSTRUCTOR_PROFILE_NOT_FOUND]: "Instructor profile not found",
  [ErrorCode.STUDIO_PROFILE_NOT_FOUND]: "Studio profile not found",
  [ErrorCode.JOB_NOT_FOUND]: "Job not found",
  [ErrorCode.BRANCH_NOT_FOUND]: "Branch not found",
  [ErrorCode.PAYMENT_NOT_FOUND]: "Payment not found",
  [ErrorCode.CERTIFICATE_NOT_FOUND]: "Certificate not found",
  [ErrorCode.INSURANCE_NOT_FOUND]: "Insurance policy not found",
  [ErrorCode.CALENDAR_PROFILE_NOT_FOUND]: "Calendar profile not found",

  [ErrorCode.DUPLICATE_RESOURCE]: "This resource already exists",
  [ErrorCode.MULTIPLE_PROFILES_FOUND]: "Multiple profiles found for this account",
  [ErrorCode.AMBIGUOUS_ACCOUNT_RESOLUTION]: "Account resolution failed due to ambiguous data",

  [ErrorCode.VALIDATION_ERROR]: "Invalid input provided",
  [ErrorCode.INVALID_INPUT]: "Invalid input provided",
  [ErrorCode.INVALID_COORDINATES]: "Invalid coordinates",
  [ErrorCode.MISSING_REQUIRED_FIELD]: "Required field is missing",

  [ErrorCode.OPERATION_NOT_ALLOWED]: "This operation is not allowed",
  [ErrorCode.RESOURCE_LIMIT_REACHED]: "Resource limit reached",
  [ErrorCode.CONFLICT_STATE]: "Operation conflicts with current state",
  [ErrorCode.CANNOT_ARCHIVE_PRIMARY_BRANCH]: "Cannot archive the primary branch",
  [ErrorCode.CANNOT_ARCHIVE_LAST_BRANCH]: "Cannot archive the last active branch",
  [ErrorCode.CANNOT_ARCHIVE_BRANCH_WITH_OPEN_JOBS]: "Cannot archive a branch with open jobs",
  [ErrorCode.ONLY_ACTIVE_BRANCHES_CAN_BE_PRIMARY]: "Only active branches can be primary",

  [ErrorCode.PAYMENT_BLOCKED]: "Studio has an active payment block",
  [ErrorCode.PAYMENT_METHOD_REQUIRED]: "A payment method is required",
  [ErrorCode.STRIPE_ERROR]: "Payment processing error",

  [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: "External service is temporarily unavailable",
  [ErrorCode.EXTERNAL_API_ERROR]: "External service request failed",
  [ErrorCode.GOOGLE_CALENDAR_NOT_CONNECTED]: "Google Calendar is not connected",
  [ErrorCode.GOOGLE_CALENDAR_ERROR]: "Google Calendar operation failed",
  [ErrorCode.GEMINI_SERVICE_ERROR]: "Document review service is temporarily unavailable",
  [ErrorCode.GEMINI_UPLOAD_ERROR]: "Document upload failed",
  [ErrorCode.GEMINI_REVIEW_ERROR]: "Document review failed",
  [ErrorCode.STRIPE_CONNECT_ERROR]: "Stripe Connect operation failed",

  [ErrorCode.MISSING_CONFIGURATION]: "Required configuration is missing",
  [ErrorCode.INVALID_CONFIGURATION]: "Invalid configuration",
  [ErrorCode.ENVIRONMENT_NOT_ALLOWED]: "Operation not allowed in this environment",

  [ErrorCode.UPLOAD_SESSION_INVALID]: "Invalid upload session",
  [ErrorCode.UPLOAD_SESSION_EXPIRED]: "Upload session has expired",
  [ErrorCode.UPLOAD_SESSION_ALREADY_USED]: "Upload session has already been used",
  [ErrorCode.FILE_NOT_FOUND]: "File not found",
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: "File type not allowed",
  [ErrorCode.CONTENT_TYPE_MISSING]: "Content type missing",
  [ErrorCode.DOCUMENT_UNAVAILABLE]: "Document is unavailable",
  [ErrorCode.DOCUMENT_INTEGRITY_ERROR]: "Document integrity check failed",

  [ErrorCode.COMPLIANCE_REQUIRED]: "Compliance requirements not met",
  [ErrorCode.BILLING_EMAIL_INVALID]: "Invalid billing email",
  [ErrorCode.IDENTITY_NOT_VERIFIED]: "Identity verification required",

  [ErrorCode.RATE_LIMITED]: "Too many requests, please try again later",
  [ErrorCode.TOO_MANY_REQUESTS]: "Too many requests, please try again later",

  [ErrorCode.INTERNAL_ERROR]: "An internal error occurred",
  [ErrorCode.UNEXPECTED_ERROR]: "An unexpected error occurred",
  [ErrorCode.PRODUCTION_BLOCKED]: "Operation blocked in production",
} as const;

/**
 * Creates a standardized ConvexError object.
 *
 * @param code - The error code from ErrorCode enum
 * @param customMessage - Optional custom message (defaults to ErrorMessage[code])
 * @returns ConvexError object with standardized format
 */
export function createError(
  code: ErrorCodeType,
  customMessage?: string,
): { code: ErrorCodeType; message: string } {
  return {
    code,
    message: customMessage ?? ErrorMessage[code],
  };
}

/**
 * Type guard for ConvexError data
 */
export function isConvexErrorData(
  data: unknown,
): data is { code: string; message: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    "message" in data &&
    typeof (data as { code: unknown }).code === "string" &&
    typeof (data as { message: unknown }).message === "string"
  );
}

/**
 * Sanitizes error for client-facing code to prevent information leakage.
 * 
 * In client code (React components), we need to be careful about what error
 * details we expose. This function ensures only safe error information is
 * returned.
 *
 * @param error - The error or unknown value
 * @returns Sanitized error object safe for client consumption
 */
export function sanitizeErrorForClient(error: unknown): {
  code: string;
  message: string;
  isNetworkError: boolean;
  isTimeoutError: boolean;
} {
  // If it's a ConvexError with our format, use it directly
  if (isConvexErrorData(error)) {
    const message = error.message;
    return {
      code: error.code,
      message,
      isNetworkError: message.includes("network") || message.includes("fetch"),
      isTimeoutError: message.includes("timeout") || message.includes("timed out"),
    };
  }

  // For other errors, sanitize the message
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isNetworkError =
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("ECONNREFUSED") ||
    errorMessage.includes("ENOTFOUND");
  const isTimeoutError =
    errorMessage.includes("timeout") ||
    errorMessage.includes("timed out") ||
    errorMessage.includes("ETIMEDOUT");

  // Log the full error internally for debugging
  if (error instanceof Error) {
    console.debug("[ErrorSanitized]", {
      name: error.name,
      message: errorMessage,
      stack: error.stack,
    });
  }


  return {
    code: ErrorCode.UNEXPECTED_ERROR,
    message: "An unexpected error occurred",
    isNetworkError,
    isTimeoutError,
  };
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Use this when comparing sensitive strings like API keys or tokens.
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates that an error message doesn't contain potentially sensitive information.
 * Used to prevent accidental leakage of internal details.
 *
 * @param message - The error message to validate
 * @returns true if the message is safe to expose to clients
 */
export function isMessageSafeToExpose(message: string): boolean {
  // Check for patterns that might indicate internal details
  const sensitivePatterns = [
    /\/\/\s*\/\*/, // Comments
    /stack\s*trace/i,
    /at\s+[A-Z][a-zA-Z]+\.[a-zA-Z]+\(/i, // Function calls like Class.method()
    /\b(node_modules|convex|bundled)\b/i,
    /\.(ts|js):\d+/, // File references with line numbers
    /0x[a-f0-9]{8,}/i, // Hex addresses
    /\b(AWS_|GOOGLE_|STRIPE_|GEMINI_)[A-Z_]+\b/, // Environment variable names
  ];

  return !sensitivePatterns.some((pattern) => pattern.test(message));
}
