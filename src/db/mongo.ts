import mongoose from "mongoose";
import { logger } from "../utils/logger";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`[Mongo] Missing env var: ${name}`);
  return v;
}

const MONGO_CATALOG_URI = assertEnv("MONGO_CATALOG_URI");

function attachConnectionLogs(conn: mongoose.Connection, label: string) {
  conn.on("connected", () => {
    logger.info({ msg: `[Mongo] ${label} connected ✅`, host: conn.host, name: conn.name });
  });

  conn.on("disconnected", () => {
    logger.warn({ msg: `[Mongo] ${label} disconnected ⚠️` });
  });

  conn.on("error", (err) => {
    logger.error({
      msg: `[Mongo] ${label} error ❌`,
      errorName: (err as any)?.name,
      errorMessage: (err as any)?.message,
      stack: (err as any)?.stack,
    });
  });
}

// ✅ Mongo "catalog" (BigBuy) : une connexion séparée
export const catalogConnection = mongoose.createConnection(MONGO_CATALOG_URI, {
  maxPoolSize: 10,
});

attachConnectionLogs(catalogConnection, "Catalog (BigBuy)");

export async function waitForCatalogConnection() {
  await catalogConnection.asPromise();
  logger.info({
    msg: "[Mongo] Catalog is ready ✅",
    catalogDb: catalogConnection.name,
  });
}
