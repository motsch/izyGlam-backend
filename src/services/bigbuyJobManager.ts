import { logger } from "../utils/logger";

/**
 * Types de jobs BigBuy
 */
export type BigBuyJobType =
  | "BOOTSTRAP"
  | "SYNC_STOCK"
  | "SYNC_PRICES"
  | "SYNC_INFO"
  | "SYNC_IMAGES";

/**
 * État interne du job
 */
export type BigBuyJobState = {
  running: boolean;
  type: BigBuyJobType | null;
  startedAt: string | null;
  updatedAt: string | null;
  progress?: {
    step?: string;
    runIndex?: number;
    totalRuns?: number;
    page?: number;
    processed?: number;
  };
  logs: Array<{
    at: string;
    level: "info" | "warn" | "error";
    msg: string;
    data?: any;
  }>;
  lastError?: {
    message?: string;
    stack?: string;
    name?: string;
  } | null;
};

/**
 * Singleton en mémoire
 * (volontairement simple : 1 job BigBuy à la fois)
 */
const state: BigBuyJobState = {
  running: false,
  type: null,
  startedAt: null,
  updatedAt: null,
  logs: [],
  lastError: null,
};

/**
 * Log interne (utilisé aussi par le bootstrap)
 */
function pushLog(
  level: "info" | "warn" | "error",
  msg: string,
  data?: any
) {
  state.logs.unshift({
    at: new Date().toISOString(),
    level,
    msg,
    data,
  });

  // garde les 200 derniers logs max
  state.logs = state.logs.slice(0, 200);
  state.updatedAt = new Date().toISOString();
}

/**
 * Lecture du statut (API admin)
 */
export function getBigBuyJobStatus(): BigBuyJobState {
  return state;
}

/**
 * Vérification simple
 */
export function isBigBuyJobRunning(): boolean {
  return state.running;
}

/**
 * Lancement exclusif d’un job BigBuy
 */
export async function runExclusiveBigBuyJob(
  type: BigBuyJobType,
  runner: () => Promise<void>
) {
  if (state.running) {
    throw new Error(`BigBuy job already running (${state.type})`);
  }

  // init job
  state.running = true;
  state.type = type;
  state.startedAt = new Date().toISOString();
  state.updatedAt = state.startedAt;
  state.progress = {};
  state.logs = [];
  state.lastError = null;

  logger.info({ msg: "[BigBuyJob] started", type });
  pushLog("info", `Job started: ${type}`);

  try {
    await runner();

    pushLog("info", `Job finished: ${type}`);
    logger.info({ msg: "[BigBuyJob] success", type });
  } catch (e: any) {
    state.lastError = {
      message: e?.message,
      stack: e?.stack,
      name: e?.name,
    };

    pushLog("error", `Job failed: ${type}`, state.lastError);
    logger.error({
      msg: "[BigBuyJob] failed",
      type,
      errorMessage: e?.message,
      stack: e?.stack,
    });

    throw e;
  } finally {
    state.running = false;
    state.type = null;
    state.progress = {};
    state.updatedAt = new Date().toISOString();
  }
}

/**
 * Mise à jour de la progression (appelée depuis les scripts BigBuy)
 */
export function jobProgressUpdate(
  progress: BigBuyJobState["progress"],
  logLine?: {
    level?: "info" | "warn" | "error";
    msg: string;
    data?: any;
  }
) {
  state.progress = { ...(state.progress || {}), ...(progress || {}) };
  state.updatedAt = new Date().toISOString();

  if (logLine) {
    pushLog(logLine.level || "info", logLine.msg, logLine.data);
  }
}
