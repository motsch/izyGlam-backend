// src/services/pushTest.ts
import admin from 'firebase-admin';
import mongoose, { Schema, Types, model } from 'mongoose';

// ---------- Firebase Admin init (idempotent) ----------
if (!admin.apps.length) {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 manquant');
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const messaging = admin.messaging();

// ---------- Modèle DeviceToken (réutilise si déjà défini) ----------
export interface IDeviceToken {
  userId: Types.ObjectId;
  token: string;
  platform: 'android' | 'ios' | 'web';
  lastSeenAt: Date;
  enabled: boolean;
}

const DeviceTokenSchema = new Schema<IDeviceToken>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: false },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
  lastSeenAt: { type: Date, default: Date.now },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

// Evite “OverwriteModelError” si le modèle existe déjà
const DeviceToken = (mongoose.models.DeviceToken as mongoose.Model<IDeviceToken>) || model<IDeviceToken>('DeviceToken', DeviceTokenSchema);

// ---------- Gestion des timers par user ----------
type RunningEntry = { timer: NodeJS.Timeout; count: number };
const running = new Map<string, RunningEntry>(); // key = userId string

type StartOptions = { intervalMs?: number; maxSends?: number };

export function startForUser(userId: string, opts: StartOptions = {}): void {
  const key = String(userId);
  console.log('[PUSH-TEST] startForUser called for', key); 
  if (running.has(key)) return; // déjà en cours

  const intervalMs = Number(opts.intervalMs ?? process.env.PUSH_TEST_INTERVAL_MS ?? 20000); // 20s par défaut
  const maxSends  = Number(opts.maxSends  ?? process.env.PUSH_TEST_LIMIT     ?? 15);    // ~5 min

  let count = 0;

  const timer = setInterval(async () => {
    try {
      count++;
      if (count > maxSends) {
        stopForUser(key);
        return;
      }

      const devices = await DeviceToken.find({ userId, enabled: true }).lean();
      if (!devices.length) return;

      const tokens = devices.map(d => d.token);
      const now = new Date();
      const body = `Ping ${count} • ${now.toLocaleTimeString()}`;

      await messaging.sendEachForMulticast({
        tokens,
        notification: { title: 'Test push IzyGlam', body },
        data: { action: 'test', count: String(count) },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      // Log serveur (utile en dev)
      // eslint-disable-next-line no-console
      console.log(`[PUSH-TEST] Sent #${count} to user ${key}`);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[PUSH-TEST] error:', e?.message || e);
    }
  }, intervalMs);

  running.set(key, { timer, count: 0 });
}

export function stopForUser(userId: string): boolean {
  const key = String(userId);
  const entry = running.get(key);
  if (entry) {
    clearInterval(entry.timer);
    running.delete(key);
    // eslint-disable-next-line no-console
    console.log(`[PUSH-TEST] Stopped for user ${key}`);
    return true;
  }
  return false;
}

export function stopAll(): void {
  for (const [key, entry] of running.entries()) {
    clearInterval(entry.timer);
    running.delete(key);
  }
  // eslint-disable-next-line no-console
  console.log(`[PUSH-TEST] Stopped all`);
}
