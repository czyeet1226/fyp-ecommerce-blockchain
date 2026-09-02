/**
 * backend/middleware/activityLogger.js
 *
 * Middleware to log all HTTP requests and user activities to MongoDB.
 * Captures request details, user info, response time, and errors.
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

const ActivityLog = require("../models/activityLog.model");

/**
 * Activity logger middleware
 * Logs all HTTP requests with user context and response details
 */
function activityLogger(req, res, next) {
  const startTime = Date.now();
  
  // Capture the original end function
  const originalEnd = res.end;
  
  // Override res.end to log after response is sent
  res.end = function(...args) {
    // Restore original end and call it
    res.end = originalEnd;
    res.end.apply(res, args);
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Extract user info from request (if authenticated)
    const userId = req.user?.id || null;
    const userCode = req.user?.userCode || null;
    const userRole = req.user?.role || null;
    
    // Get client IP
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    
    // Get user agent
    const userAgent = req.get("user-agent") || "unknown";
    
    // Determine severity based on status code
    let severity = "info";
    if (res.statusCode >= 500) severity = "error";
    else if (res.statusCode >= 400) severity = "warn";
    else if (res.statusCode >= 300) severity = "info";
    
    // Create human-readable message
    const message = `${req.method} ${req.path} - ${res.statusCode} (${responseTime}ms)${userId ? ` by ${userCode}` : ""}`;
    
    // Skip logging for certain paths to reduce noise
    const skipPaths = ["/api/admin/logs", "/api/admin/balance"];
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return;
    }
    
    // Log to MongoDB (async, don't wait)
    ActivityLog.create({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      userId,
      userCode,
      userRole,
      ipAddress,
      userAgent,
      message,
      severity,
      metadata: {
        query: req.query,
        body: sanitizeBody(req.body), // Remove sensitive data
      },
    }).catch(err => {
      // Silently fail if logging fails (don't break the app)
      console.error("[ActivityLogger] Failed to save log:", err.message);
    });
  };
  
  next();
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeBody(body) {
  if (!body || typeof body !== "object") return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ["password", "token", "secret", "privateKey", "apiKey"];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  }
  
  return sanitized;
}

/**
 * Helper function to manually log important events
 */
async function logActivity(data) {
  try {
    await ActivityLog.create({
      method: data.method || "EVENT",
      path: data.path || "/system",
      statusCode: data.statusCode || 200,
      responseTime: data.responseTime || 0,
      userId: data.userId,
      userCode: data.userCode,
      userRole: data.userRole,
      ipAddress: data.ipAddress || "system",
      userAgent: data.userAgent || "system",
      message: data.message,
      severity: data.severity || "info",
      metadata: data.metadata,
      errorMessage: data.errorMessage,
      errorStack: data.errorStack,
    });
  } catch (err) {
    console.error("[ActivityLogger] Failed to save manual log:", err.message);
  }
}

module.exports = { activityLogger, logActivity };
