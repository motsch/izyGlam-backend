import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import path from "path";

// dossier logs à la racine du projet, adapte si besoin
const logDir = path.resolve(process.cwd(), "logs");

const rotateTransport = new (transports.DailyRotateFile)({
  dirname: logDir,
  filename: "app-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,         // compresse les anciens logs
  maxSize: "10m",              // rotate si > 10 Mo
  maxFiles: "14d",             // garde 14 jours
  level: process.env.LOG_LEVEL || "info",
});

export const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),   // inclut stack si err
    format.json()                     // JSON = facile à parser/greper
  ),
  transports: [
    rotateTransport,
    // En dev, tu peux aussi logguer sur la console
    ...(process.env.NODE_ENV !== "production"
      ? [new transports.Console({ format: format.simple() })]
      : []),
  ],
});
