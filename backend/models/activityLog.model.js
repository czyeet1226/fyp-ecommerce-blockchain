/**
 * backend/models/activityLog.model.js
 *
 * MongoDB model for storing user activity logs.
 * Captures HTTP requests, important events, and system activities.
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    // Request details
    method: { type: String, required: true }, // GET, POST, PUT, DELETE
    path: { type: String, required: true }, // /api/users, /api/products
    statusCode: { type: Number, required: true }, // 200, 404, 500
    responseTime: { type: Number }, // milliseconds
    
    // User details
    userId: { type: String }, // User ID if authenticated
    userCode: { type: String }, // User code for easy reference
    userRole: { type: String }, // admin, customer, merchant
    ipAddress: { type: String }, // Client IP
    userAgent: { type: String }, // Browser/client info
    
    // Additional context
    message: { type: String }, // Human-readable description
    severity: { 
      type: String, 
      enum: ["info", "warn", "error", "debug"],
      default: "info" 
    },
    
    // Optional metadata
    metadata: { type: mongoose.Schema.Types.Mixed }, // Any additional data
    
    // Error details (if applicable)
    errorMessage: { type: String },
    errorStack: { type: String },
  },
  { 
    timestamps: true, // Adds createdAt and updatedAt
    collection: "activity_logs"
  }
);

// Index for faster queries
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ path: 1, createdAt: -1 });
activityLogSchema.index({ severity: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
