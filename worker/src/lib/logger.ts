import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define log directory (relative to where the script runs)
const logDir = "logs";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports: [
    // 1. Console Transport (Best for Docker/Kubernetes)
    // Docker captures stdout/stderr, handling rotation and storage.
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, stack }) => 
            `${timestamp} [${level}]: ${message} ${stack || ""}`
        )
      ),
    }),

    // 2. File Transport (Optional, for easy local debugging or persistent volume)
    // Rotates daily, keeps 14 days of logs.
    new DailyRotateFile({
      dirname: logDir,
      filename: "worker-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
    
    // Separate error log
    new DailyRotateFile({
      dirname: logDir,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d",
      level: "error",
    }),
  ],
});

export default logger;
