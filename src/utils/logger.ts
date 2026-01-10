import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import path from "path";

// dossier logs à la racine du projet
const logDir = path.resolve(process.cwd(), "logs");

const rotateTransport = new (transports as any).DailyRotateFile({
  dirname: logDir,
  filename: "app-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "10m",
  maxFiles: "14d",
  level: process.env.LOG_LEVEL || "info",
});

// ✅ format console lisible (JSON en 1 ligne)
// -> plus jamais de [object Object]
const consoleJsonFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format((info) => {
    // Winston met parfois l'objet dans info.message, parfois dans info directement
    // On normalise: si message est un objet, on le "merge" au root
    if (info && typeof info.message === "object" && info.message !== null) {
      const msgObj = info.message;
      delete (info as any).message;
      return { ...info, ...msgObj };
    }
    return info;
  })(),
  format.json()
);

export const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",

  // ✅ format de base (fichier rotate)
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),

  transports: [
    rotateTransport,

    // ✅ console en dev : JSON propre au lieu de format.simple()
    ...(process.env.NODE_ENV !== "production"
      ? [new transports.Console({ format: consoleJsonFormat })]
      : []),
  ],
});
