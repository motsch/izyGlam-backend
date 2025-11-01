import * as admin from 'firebase-admin';
import mongoose, { Types } from 'mongoose';
import { sendEmail } from '../utils/mailer';
import UserModel from '../models/user';

/** Langues supportées */
export const SUPPORTED_LANGS = new Set([
  'ar','be','bn','ca','da','de','en','es','et','eu','fa','fi','fr','gl','hi','id','it','ja','ko','ku','ms','nl','pl','pt','ro','ru','so','sq','sv','th','tl','tr','uk','vi','zh'
]);

/** ===== Helpers i18n très légers pour l'email (footer/bouton) ===== */
const RTL_LANGS = new Set<string>(['ar', 'fa']);

const EMAIL_FOOTER_I18N: Record<string, {help: string; rights: string; hello: string; view: string; details: string; }> = {
  fr: {
    hello: 'Bonjour,',
    help: 'Besoin d’aide ?',
    rights: 'Tous droits réservés.',
    view: 'Voir mon rendez-vous',
    details: 'Détails du rendez-vous',
  },
  en: {
    hello: 'Hello,',
    help: 'Need help?',
    rights: 'All rights reserved.',
    view: 'View my appointment',
    details: 'Appointment details',
  },
  es: {
    hello: 'Hola,',
    help: '¿Necesitas ayuda?',
    rights: 'Todos los derechos reservados.',
    view: 'Ver mi cita',
    details: 'Detalles de la cita',
  },
  it: {
    hello: 'Ciao,',
    help: 'Serve aiuto?',
    rights: 'Tutti i diritti riservati.',
    view: 'Vedi il mio appuntamento',
    details: 'Dettagli dell’appuntamento',
  },
  de: {
    hello: 'Hallo,',
    help: 'Brauchst du Hilfe?',
    rights: 'Alle Rechte vorbehalten.',
    view: 'Termin ansehen',
    details: 'Termindetails',
  },
  pt: {
    hello: 'Olá,',
    help: 'Precisa de ajuda?',
    rights: 'Todos os direitos reservados.',
    view: 'Ver minha consulta',
    details: 'Detalhes da consulta',
  },
  ar: {
    hello: 'مرحبًا،',
    help: 'هل تحتاج إلى مساعدة؟',
    rights: 'جميع الحقوق محفوظة.',
    view: 'عرض موعدي',
    details: 'تفاصيل الموعد',
  },
  fa: {
    hello: 'سلام،',
    help: 'کمک لازم دارید؟',
    rights: 'کلیه حقوق محفوظ است.',
    view: 'مشاهده نوبت',
    details: 'جزئیات نوبت',
  },
};

/** Tiny helper: retourne une clé i18n simple avec fallback en/ fr */
function pickEmailCopy(lang: string) {
  const key = SUPPORTED_LANGS.has(lang) ? lang : 'en';
  return EMAIL_FOOTER_I18N[key] || EMAIL_FOOTER_I18N.en;
}

/** Traductions pour notification "nouvelle réservation" */
const NEW_BOOKING_TITLES_I18N: Record<string, string> = {
  ar: "حجز جديد 💌",
  be: "Новае браніраванне 💌",
  bn: "নতুন বুকিং 💌",
  ca: "Nova reserva 💌",
  da: "Ny reservation 💌",
  de: "Neue Buchung 💌",
  en: "New booking 💌",
  es: "Nueva reserva 💌",
  et: "Uus broneering 💌",
  eu: "Erreserba berria 💌",
  fa: "رزرو جدید 💌",
  fi: "Uusi varaus 💌",
  fr: "Nouvelle réservation 💌",
  gl: "Nova reserva 💌",
  hi: "नई बुकিং 💌",
  id: "Pemesanan baru 💌",
  it: "Nuova prenotazione 💌",
  ja: "新規予約 💌",
  ko: "새 예약 💌",
  ku: "Rezervasyona nû 💌",
  ms: "Tempahan baharu 💌",
  nl: "Nieuwe reservering 💌",
  pl: "Nowa rezerwacja 💌",
  pt: "Nova reserva 💌",
  ro: "Rezervare nouă 💌",
  ru: "Новая бронь 💌",
  so: "Ballan cusub 💌",
  sq: "Rezervim i ri 💌",
  sv: "Ny bokning 💌",
  th: "การจองใหม่ 💌",
  tl: "Bagong reserbasyon 💌",
  tr: "Yeni rezervasyon 💌",
  uk: "Нове бронювання 💌",
  vi: "Đặt lịch mới 💌",
  zh: "新预订 💌"
};

/** === I18N Chat messages === */
const CHAT_TITLE_I18N: Record<string, string> = {
  ar: "رسالة جديدة ✉️",
  be: "Новае паведамленне ✉️",
  bn: "নতুন বার্তা ✉️",
  ca: "Missatge nou ✉️",
  da: "Ny besked ✉️",
  de: "Neue Nachricht ✉️",
  en: "New message ✉️",
  es: "Nuevo mensaje ✉️",
  et: "Uus sõnum ✉️",
  eu: "Mezu berria ✉️",
  fa: "پیام جدید ✉️",
  fi: "Uusi viesti ✉️",
  fr: "Nouveau message ✉️",
  gl: "Nova mensaxe ✉️",
  hi: "नया संदेश ✉️",
  id: "Pesan baru ✉️",
  it: "Nuovo messaggio ✉️",
  ja: "新しいメッセージ ✉️",
  ko: "새 메시지 ✉️",
  ku: "Peyamê nû ✉️",
  ms: "Mesej baharu ✉️",
  nl: "Nieuw bericht ✉️",
  pl: "Nowa wiadomość ✉️",
  pt: "Nova mensagem ✉️",
  ro: "Mesaj nou ✉️",
  ru: "Новое сообщение ✉️",
  so: "Fariin cusub ✉️",
  sq: "Mesazh i ri ✉️",
  sv: "Nytt meddelande ✉️",
  th: "ข้อความใหม่ ✉️",
  tl: "Bagong mensahe ✉️",
  tr: "Yeni mesaj ✉️",
  uk: "Нове повідомлення ✉️",
  vi: "Tin nhắn mới ✉️",
  zh: "新消息 ✉️"
};

const CHAT_PHOTO_BODY_I18N: Record<string, (sender: string) => string> = {
  ar: (s) => `${s} أرسل لك صورة`,
  be: (s) => `${s} адправіў(ла) вам фота`,
  bn: (s) => `${s} আপনাকে একটি ছবি পাঠিয়েছে`,
  ca: (s) => `${s} t'ha enviat una foto`,
  da: (s) => `${s} sendte dig et foto`,
  de: (s) => `${s} hat dir ein Foto gesendet`,
  en: (s) => `${s} sent you a photo`,
  es: (s) => `${s} te envió una foto`,
  et: (s) => `${s} saatis sulle foto`,
  eu: (s) => `${s} argazki bat bidali dizu`,
  fa: (s) => `${s} برایت یک عکس فرستاد`,
  fi: (s) => `${s} lähetti sinulle kuvan`,
  fr: (s) => `${s} vous a envoyé une photo`,
  gl: (s) => `${s} enviouche unha foto`,
  hi: (s) => `${s} ने आपको एक फ़ोटो भेजी`,
  id: (s) => `${s} mengirimi Anda foto`,
  it: (s) => `${s} ti ha inviato una foto`,
  ja: (s) => `${s} が写真を送信しました`,
  ko: (s) => `${s}님이 사진을 보냈습니다`,
  ku: (s) => `${s} wênekek ji te re şand`,
  ms: (s) => `${s} menghantar foto kepada anda`,
  nl: (s) => `${s} heeft je een foto gestuurd`,
  pl: (s) => `${s} wysłał(a) Ci zdjęcie`,
  pt: (s) => `${s} enviou-lhe uma foto`,
  ro: (s) => `${s} ți-a trimis o fotografie`,
  ru: (s) => `${s} отправил(а) вам фото`,
  so: (s) => `${s} wuxuu kuu soo diray sawir`,
  sq: (s) => `${s} të dërgoi një foto`,
  sv: (s) => `${s} skickade dig ett foto`,
  th: (s) => `${s} ส่งรูปภาพให้คุณ`,
  tl: (s) => `${s} ay nagpadala sa iyo ng litrato`,
  tr: (s) => `${s} sana bir fotoğraf gönderdi`,
  uk: (s) => `${s} надіслав(ла) вам фото`,
  vi: (s) => `${s} đã gửi cho bạn một ảnh`,
  zh: (s) => `${s} 给你发送了一张照片`
};

const CHAT_TEXT_BODY_I18N: Record<string, (sender: string, preview: string) => string> = {
  ar: (s, p) => `${s}: ${p}`,
  be: (s, p) => `${s}: ${p}`,
  bn: (s, p) => `${s}: ${p}`,
  ca: (s, p) => `${s}: ${p}`,
  da: (s, p) => `${s}: ${p}`,
  de: (s, p) => `${s}: ${p}`,
  en: (s, p) => `${s}: ${p}`,
  es: (s, p) => `${s}: ${p}`,
  et: (s, p) => `${s}: ${p}`,
  eu: (s, p) => `${s}: ${p}`,
  fa: (s, p) => `${s}: ${p}`,
  fi: (s, p) => `${s}: ${p}`,
  fr: (s, p) => `${s}: ${p}`,
  gl: (s, p) => `${s}: ${p}`,
  hi: (s, p) => `${s}: ${p}`,
  id: (s, p) => `${s}: ${p}`,
  it: (s, p) => `${s}: ${p}`,
  ja: (s, p) => `${s}: ${p}`,
  ko: (s, p) => `${s}: ${p}`,
  ku: (s, p) => `${s}: ${p}`,
  ms: (s, p) => `${s}: ${p}`,
  nl: (s, p) => `${s}: ${p}`,
  pl: (s, p) => `${s}: ${p}`,
  pt: (s, p) => `${s}: ${p}`,
  ro: (s, p) => `${s}: ${p}`,
  ru: (s, p) => `${s}: ${p}`,
  so: (s, p) => `${s}: ${p}`,
  sq: (s, p) => `${s}: ${p}`,
  sv: (s, p) => `${s}: ${p}`,
  th: (s, p) => `${s}: ${p}`,
  tl: (s, p) => `${s}: ${p}`,
  tr: (s, p) => `${s}: ${p}`,
  uk: (s, p) => `${s}: ${p}`,
  vi: (s, p) => `${s}: ${p}`,
  zh: (s, p) => `${s}: ${p}`
};

// --- Firebase Admin (une seule init) ---
if (!admin.apps.length) {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b4) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 manquant'); // <-- correct var below; keep type safety
}
// Fix: correct typo (keep above block readable)
if (!admin.apps.length) {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 manquant');
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount as any) });
}
const messaging = admin.messaging();

// --- Modèle DeviceToken (ou réutilise s'il existe déjà) ---
let DeviceToken: mongoose.Model<any>;
try {
  DeviceToken = mongoose.model('DeviceToken');
} catch {
  const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
    lastSeenAt: { type: Date, default: Date.now },
    enabled: { type: Boolean, default: true },
  }, { timestamps: true });
  DeviceToken = mongoose.model('DeviceToken', schema);
}

// ---- utils --------------------------------------------------
function toId(x: any): string | null {
  if (!x) return null;
  if (typeof x === 'string') return x;
  if ((x as Types.ObjectId)._id) return String((x as any)._id);
  try { return String(x); } catch { return null; }
}

async function getUserLang(userId: string | Types.ObjectId): Promise<string> {
  try {
    const u = await UserModel.findById(userId).lean();
    const langRaw =
      (u as any)?.language ||
      (u as any)?.lang ||
      (u as any)?.locale ||
      (u as any)?.settings?.language ||
      (u as any)?.profile?.language ||
      'fr';

    const lang2 = String(langRaw).toLowerCase().slice(0, 2);
    return SUPPORTED_LANGS.has(lang2) ? lang2 : 'en';
  } catch {
    return 'en';
  }
}

/** URL booking (pour le bouton). Retourne null si base inconnue */
function buildBookingUrl(booking: any): string | null {
  const base = process.env.APP_WEB_BASE_URL || process.env.FRONTEND_BASE_URL || '';
  if (!base) return null;
  const id = String(booking?._id || '').trim();
  if (!id) return base; // fallback homepage si pas d’id
  // Ajuste le path selon ton routing web/app
  return `${base.replace(/\/$/, '')}/booking/${encodeURIComponent(id)}`;
}

/** Email HTML harmonisé (design verify/reset) pour notifications */
function renderNotificationEmailHTML(
  params: {
    lang: string;
    subject: string;
    title: string;       // même que subject en général, traduit
    summaryLine: string; // ex: "MaxBurn • 29/10 16:00 • Vincent F. • Non effectué"
    product?: string;
    when?: string;
    shop?: string;       // avec " • " déjà géré si fourni, ou brut
    statusLabel?: string; // "Non effectué", "Terminé", etc. (option)
    logoCid?: string;    // par défaut "logo"
    recipientHelloName?: string | null;
    actionUrl?: string | null;
  }
) {
  const {
    lang, subject, title, summaryLine,
    product = '', when = '', shop = '', statusLabel = '',
    logoCid = 'logo',
    recipientHelloName, actionUrl
  } = params;

  const copy = pickEmailCopy(lang);
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
  const helloLine = recipientHelloName
    ? `${copy.hello} ${recipientHelloName},`
    : `${copy.hello}`;

  // Carte “détails”
  const detailsRows: string[] = [];
  if (product) detailsRows.push(`<tr><td class="k">${dir === 'rtl' ? '' : ''}</td><td class="v"><b>${escapeHtml(product)}</b></td></tr>`);
  if (when)    detailsRows.push(`<tr><td class="k"></td><td class="v">${escapeHtml(when)}${shop ? escapeHtml(' • ' + shop) : ''}</td></tr>`);
  if (statusLabel) detailsRows.push(`<tr><td class="k"></td><td class="v"><span class="badge">${escapeHtml(statusLabel)}</span></td></tr>`);

  const detailsBlock = detailsRows.length
    ? `
      <div class="card">
        <div class="card-title">${copy.details}</div>
        <table class="kv" role="presentation">${detailsRows.join('')}</table>
      </div>
    `
    : '';

  const buttonBlock = actionUrl
    ? `
      <div class="button-container">
        <a class="button" href="${escapeAttr(actionUrl)}" target="_blank" rel="noreferrer noopener">${copy.view}</a>
      </div>
    `
    : '';

  const html = `
  <!DOCTYPE html>
  <html lang="${lang}" dir="${dir}">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>${escapeHtml(subject)}</title>
      <style>
        /* Reset simple */
        body { margin:0; padding:0; background:#f9f9fb; font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, 'Helvetica Neue', sans-serif; color:#222; }
        a { text-decoration: none; }

        .container { max-width:640px; margin:24px auto; background:#ffffff; border-radius:16px; box-shadow:0 6px 24px rgba(0,0,0,.08); overflow:hidden; }
        .header { background:linear-gradient(90deg,#ff95c1,#ffdcec); padding:28px 16px; text-align:center; }
        .header img { max-width:160px; display:inline-block; }

        .content { padding:24px 20px; text-align:${dir === 'rtl' ? 'right' : 'left'}; }
        h1 { margin:0 0 8px 0; font-size:22px; line-height:1.25; color:#ff8fbe; }
        p { margin:0 0 16px 0; font-size:15px; line-height:1.6; color:#333; }

        .summary { margin:12px 0 20px 0; font-size:16px; font-weight:600; color:#1a1a1a; }

        .button-container { text-align:center; margin:24px 0; }
        .button {
          display:inline-block; padding:14px 22px; font-size:16px; font-weight:700;
          color:#fff !important; border-radius:8px;
          background:linear-gradient(90deg,#ffdcec,#ff95c1);
        }
        .button:hover { opacity:.95; }

        .card { border:1px solid #f1e7ee; border-radius:12px; padding:14px; margin:8px 0 16px; background:#fff; }
        .card-title { font-weight:700; font-size:14px; color:#a85886; margin-bottom:8px; }
        .kv { width:100%; border-collapse:collapse; }
        .kv .k { width:1%; white-space:nowrap; padding:6px 8px; color:#666; }
        .kv .v { padding:6px 8px; color:#222; }
        .badge { display:inline-block; padding:3px 8px; border-radius:999px; font-size:12px; background:#ffe6f1; color:#a85886; border:1px solid #f7cfe1; }

        .footer { background:#f6f6f8; padding:14px; text-align:center; color:#8a8a8a; font-size:13px; }
        .footer a { color:#ff8fbe; }
        @media (max-width: 480px) {
          .content { padding:18px 16px; }
          .button { width:100%; text-align:center; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="cid:${logoCid}" alt="izyGlam Logo" />
        </div>
        <div class="content">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(helloLine)}</p>
          <p class="summary">${escapeHtml(summaryLine)}</p>
          ${detailsBlock}
          ${buttonBlock}
          <p style="margin-top:20px;">&nbsp;</p>
        </div>
        <div class="footer">
          <p>${copy.help} <a href="mailto:support@izyglam.com">support@izyglam.com</a></p>
          <p>&copy; ${new Date().getFullYear()} izyGlam. ${copy.rights}</p>
        </div>
      </div>
    </body>
  </html>
  `;
  return html;
}

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/** Enveloppe d’envoi vers l’utilisateur via FCM */
export async function sendToUser(
  userId: string | Types.ObjectId,
  payload: { notification: { title: string; body: string }; data?: Record<string, string> }
) {
  const uid = toId(userId);
  if (!uid) return { success: 0, failure: 0 };

  const rows = await DeviceToken.find({ userId: uid, enabled: true }).lean();
  if (!rows.length) {
    console.log('[NOTIFY] no device for user', uid);
    return { success: 0, failure: 0 };
  }
  const tokens = rows.map(r => r.token);

  const batch = await messaging.sendEachForMulticast({
    tokens,
    notification: payload.notification,
    data: payload.data || {},
    android: {
      priority: 'high',
      notification: { channelId: 'default', sound: 'default' }
    },
    apns: { payload: { aps: { sound: 'default' } } }
  });

  console.log(`[NOTIFY] to user ${uid}: success=${batch.successCount} failure=${batch.failureCount}`);

  // désactiver les tokens invalides
  batch.responses.forEach((r, i) => {
    if (!r.success) {
      const code = (r.error as any)?.code || '';
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        DeviceToken.updateOne({ token: tokens[i] }, { $set: { enabled: false } }).exec();
      } else {
        console.warn('[NOTIFY] send error', code, 'token', tokens[i].slice(0, 12) + '…');
      }
    }
  });

  return { success: batch.successCount, failure: batch.failureCount };
}

function tNewBooking(lang: string): string {
  return NEW_BOOKING_TITLES_I18N[lang] || NEW_BOOKING_TITLES_I18N["en"];
}

/** Notifier le prestataire d'une nouvelle réservation */
export async function notifyProNewBooking(booking: any, lang: string = "fr") {
  try {
    const proId = booking.userProId;
    if (!proId) return;

    const when = formatSlot(booking.start);
    const prod = booking.productName || "Réservation";
    const client = booking.clientName || booking.customerName || "";
    const price = booking.price ? `${booking.price} €` : "";

    // 🌍 Traduction du titre
    const title = tNewBooking(lang);

    // 🌍 Corps du message
    let body = `${prod} • ${when}`;
    if (client) body += ` • ${client}`;
    if (price) body += ` • ${price}`;

    await sendToUser(proId, {
      notification: { title, body: truncate(body) },
      data: {
        type: "new_booking",
        screen: "booking",
        bookingId: String(booking._id || ""),
        clientId: String(booking.clientId || ""),
        price: String(booking.price || ""),
        lang
      }
    });

  } catch (err) {
    console.error("[NOTIFY][pro_new_booking] error", err);
  }
}

/** Notifier les destinataires d’un nouveau message de chat — MULTILINGUE par destinataire */
export async function notifyChatMessage(conversation: any, message: any) {
  try {
    // Participants sauf l’expéditeur
    const recipients = (conversation.participants || [])
      .map((id: any) => String(id))
      .filter((id: string) => id !== String(message.sender));

    if (!recipients.length) return;

    // Récupération de l’expéditeur (pour afficher son nom)
    let senderName = "Utilisateur";
    try {
      const sender = await UserModel.findById(message.sender).lean();
      if (sender) {
        senderName = [ (sender as any).firstname, (sender as any).lastname ].filter(Boolean).join(" ")
          || (sender as any).username
          || (sender as any).email
          || "Utilisateur";
      }
    } catch (err) {
      console.warn("[NOTIFY][chat] impossible de charger le sender", err);
    }

    // Préview du message (limitée)
    const rawPreview =
      message.messageType === "photo"
        ? null
        : (message.contentFr || message.content || "").toString().trim();

    const preview = rawPreview ? truncate(rawPreview, 80) : "";

    // Envoi par destinataire, avec sa langue
    for (const userId of recipients) {
      const lang = await getUserLang(userId);
      const title = CHAT_TITLE_I18N[lang] || CHAT_TITLE_I18N.en;

      const body =
        message.messageType === "photo"
          ? (CHAT_PHOTO_BODY_I18N[lang]?.(senderName) || CHAT_PHOTO_BODY_I18N.en(senderName))
          : (preview
              ? (CHAT_TEXT_BODY_I18N[lang]?.(senderName, preview) || CHAT_TEXT_BODY_I18N.en(senderName, preview))
              : (CHAT_TEXT_BODY_I18N[lang]?.(senderName, "…") || CHAT_TEXT_BODY_I18N.en(senderName, "…")));

      await sendToUser(userId, {
        notification: { title, body },
        data: {
          type: "chat_message",
          screen: "conversation",
          conversationId: String(conversation._id),
          senderId: String(message.sender),
          messageId: String(message._id || "")
        }
      });
    }

    console.log(`[NOTIFY][chat] envoyé à ${recipients.length} destinataire(s).`);
  } catch (e) {
    console.error("[NOTIFY][chat] error", e);
  }
}

/** Compat: ancienne fonction → délègue vers notifyChatMessage (garde la même signature) */
export async function notifyNewMessage(conversation: any, message: any) {
  return notifyChatMessage(conversation, message);
}

// ---- cas métier ---------------------------------------------

/** Notifier le client quand le code est confirmé chez le pro */
export async function notifyBookingCodeConfirmed(booking: any) {
  const customerId =
    booking.customerId || booking.userId || booking.clientId || booking.user || booking.customer || null;

  const title = 'Prestation terminée ✨';
  const body = `Le code a été confirmé par le professionnel. Merci !`;

  return sendToUser(customerId, {
    notification: { title, body },
    data: {
      type: 'booking_code_confirmed',
      screen: 'booking',
      bookingId: String(booking._id || '')
    }
  });
}

// --- Petit helper traduction ---
function tStatus(status: string, lang: string): string {
  const s = STATUS_TITLES_I18N[status];
  if (!s) return status;
  return s[lang] || s['en'] || status; // fallback anglais si pas traduit
}

/** Notifier le client quand le statut du booking change */
export async function notifyBookingStatusChanged(booking: any, lang: string = 'fr') {
  const customerId =
    booking.clientId || booking.customerId || booking.userId ||
    booking.user || booking.client || booking.customer || null;

  const status = String(booking.status || '').toLowerCase();

  const when = formatSlot(booking.start || booking.date);
  const prod = booking.productName || 'Rendez-vous';
  const shop = booking.establishmentName || '';

  // 🌍 Titre traduit
  const title = tStatus(status, lang);

  // 🌍 Body “compact” pour push
  let body = `${prod} • ${when}${shop ? ' • ' + shop : ''}`;
  if (['cancelled', 'deleted', 'refused', 'no-show-client', 'no-show-pro'].includes(status)) {
    body += lang === 'fr' ? ' • Non effectué' : ' • Not done';
  }
  if (status === 'finished') {
    body += lang === 'fr' ? ' • Terminé' : ' • Completed';
  }
  body = truncate(body);

  // --- 1️⃣ Notification Push (inchangée) ---
  await sendToUser(customerId, {
    notification: { title, body },
    data: {
      type: 'booking_status_changed',
      screen: 'booking',
      bookingId: String(booking._id || ''),
      status,
      lang
    }
  });

  // --- 2️⃣ Email HTML PRO (nouveau design harmonisé) ---
  try {
    const user = await UserModel.findById(customerId).lean();
    const email = (user as any)?.email;
    if (email) {
      const userLang = await getUserLang(customerId);
      const copy = pickEmailCopy(userLang);

      const statusLabel =
        ['cancelled', 'deleted', 'refused', 'no-show-client', 'no-show-pro'].includes(status)
          ? (userLang === 'fr' ? 'Non effectué' : 'Not done')
          : (status === 'finished'
              ? (userLang === 'fr' ? 'Terminé' : 'Completed')
              : '');

      const summary = `${prod} • ${when}${shop ? ' • ' + shop : ''}${statusLabel ? ' • ' + statusLabel : ''}`;

      const actionUrl = buildBookingUrl(booking);

      // On utilise le même CID que tes emails verify/reset: "logo"
      const html = renderNotificationEmailHTML({
        lang: userLang,
        subject: title,
        title,
        summaryLine: summary,
        product: prod,
        when,
        shop,
        statusLabel,
        logoCid: 'logo',
        recipientHelloName: [ (user as any)?.firstname, (user as any)?.lastname ].filter(Boolean).join(' ') || null,
        actionUrl
      });

      // Texte brut propre (fallback)
      const text = [
        title,
        '',
        copy.hello,
        summary,
        actionUrl ? `\n${copy.view}: ${actionUrl}` : '',
        '',
        `${copy.help} support@izyglam.com`,
      ].filter(Boolean).join('\n');

      await sendEmail({
        to: email,
        subject: title,
        text,
        html
      });
    }
  } catch (err) {
    console.error("Erreur lors de l'envoi de l'email de notification:", err);
  }
}

/** Map des titres par status */
const STATUS_TITLES_I18N: Record<string, Record<string, string>> = {
  pending: {
    ar: 'موعد قيد الانتظار ⏳',
    be: 'Прыём у чаканні ⏳',
    bn: 'অ্যাপয়েন্টমেন্ট অপেক্ষমাণ ⏳',
    ca: 'Cita pendent ⏳',
    da: 'Aftale afventer ⏳',
    de: 'Termin ausstehend ⏳',
    en: 'Appointment pending ⏳',
    es: 'Cita pendiente ⏳',
    et: 'Aja broneering ootel ⏳',
    eu: 'Hitzordua zain ⏳',
    fa: 'نوبت در انتظار ⏳',
    fi: 'Ajanvaraus odottaa ⏳',
    fr: 'RDV en attente ⏳',
    gl: 'Cita pendente ⏳',
    hi: 'अपॉइंटमेंट लंबित ⏳',
    id: 'Janji temu menunggu ⏳',
    it: 'Appuntamento in attesa ⏳',
    ja: '予約保留中 ⏳',
    ko: '예약 대기 중 ⏳',
    ku: 'Danûstandin li bendê ⏳',
    ms: 'Temu janji tertangguh ⏳',
    nl: 'Afspraak in afwachting ⏳',
    pl: 'Wizyta oczekująca ⏳',
    pt: 'Consulta pendente ⏳',
    ro: 'Programare în așteptare ⏳',
    ru: 'Запись в ожидании ⏳',
    so: 'Ballan sugitaan ku jira ⏳',
    sq: 'Takimi në pritje ⏳',
    sv: 'Möte väntar ⏳',
    th: 'นัดหมายรอดำเนินการ ⏳',
    tl: 'Nakahold ang appointment ⏳',
    tr: 'Randevu beklemede ⏳',
    uk: 'Зустріч очікує ⏳',
    vi: 'Cuộc hẹn đang chờ ⏳',
    zh: '预约待确认 ⏳'
  },
  accepted: {
    ar: 'تم تأكيد الموعد ✅',
    be: 'Прыём пацверджаны ✅',
    bn: 'অ্যাপয়েন্টমেন্ট নিশ্চিত ✅',
    ca: 'Cita confirmada ✅',
    da: 'Aftale bekræftet ✅',
    de: 'Termin bestätigt ✅',
    en: 'Appointment confirmed ✅',
    es: 'Cita confirmada ✅',
    et: 'Aja broneering kinnitatud ✅',
    eu: 'Hitzordua baieztatuta ✅',
    fa: 'نوبت تأیید شد ✅',
    fi: 'Ajanvaraus vahvistettu ✅',
    fr: 'RDV confirmé ✅',
    gl: 'Cita confirmada ✅',
    hi: 'अपॉइंटमेंट पुष्टि हुई ✅',
    id: 'Janji temu dikonfirmasi ✅',
    it: 'Appuntamento confermato ✅',
    ja: '予約が確定しました ✅',
    ko: '예약 확인됨 ✅',
    ku: 'Danûstandin piştrast bû ✅',
    ms: 'Temu janji disahkan ✅',
    nl: 'Afspraak bevestigd ✅',
    pl: 'Wizyta potwierdzona ✅',
    pt: 'Consulta confirmada ✅',
    ro: 'Programare confirmată ✅',
    ru: 'Запись подтверждена ✅',
    so: 'Ballan waa la xaqiijiyay ✅',
    sq: 'Takimi u konfirmua ✅',
    sv: 'Möte bekräftat ✅',
    th: 'ยืนยันนัดหมายแล้ว ✅',
    tl: 'Nakumpirma ang appointment ✅',
    tr: 'Randevu onaylandı ✅',
    uk: 'Зустріч підтверджена ✅',
    vi: 'Cuộc hẹn đã xác nhận ✅',
    zh: '预约已确认 ✅'
  },
  cancelled: {
    ar: 'تم إلغاء الموعد ❌',
    be: 'Прыём адменены ❌',
    bn: 'অ্যাপয়েন্টমেন্ট বাতিল ❌',
    ca: 'Cita cancel·lada ❌',
    da: 'Aftale aflyst ❌',
    de: 'Termin abgesagt ❌',
    en: 'Appointment cancelled ❌',
    es: 'Cita cancelada ❌',
    et: 'Aja broneering tühistatud ❌',
    eu: 'Hitzordua ezeztatua ❌',
    fa: 'نوبت لغو شد ❌',
    fi: 'Ajanvaraus peruttu ❌',
    fr: 'RDV annulé ❌',
    gl: 'Cita cancelada ❌',
    hi: 'अपॉइंटमेंट रद्द ❌',
    id: 'Janji temu dibatalkan ❌',
    it: 'Appuntamento annullato ❌',
    ja: '予約がキャンセルされました ❌',
    ko: '예약이 취소되었습니다 ❌',
    ku: 'Danûstandin betal kirin ❌',
    ms: 'Temu janji dibatalkan ❌',
    nl: 'Afspraak geannuleerd ❌',
    pl: 'Wizyta anulowana ❌',
    pt: 'Consulta cancelada ❌',
    ro: 'Programare anulată ❌',
    ru: 'Запись отменена ❌',
    so: 'Ballan waa la baajiyay ❌',
    sq: 'Takimi u anulua ❌',
    sv: 'Möte avbokat ❌',
    th: 'ยกเลิกนัดหมาย ❌',
    tl: 'Kanselado ang appointment ❌',
    tr: 'Randevu iptal edildi ❌',
    uk: 'Зустріч скасована ❌',
    vi: 'Cuộc hẹn đã hủy ❌',
    zh: '预约已取消 ❌'
  },
  finished: {
    ar: 'تم إكمال الخدمة ✨',
    be: 'Паслуга завершана ✨',
    bn: 'সেবা সম্পন্ন ✨',
    ca: 'Servei completat ✨',
    da: 'Tjeneste afsluttet ✨',
    de: 'Leistung abgeschlossen ✨',
    en: 'Service completed ✨',
    es: 'Servicio completado ✨',
    et: 'Teenus lõpetatud ✨',
    eu: 'Zerbitzua amaituta ✨',
    fa: 'خدمت تکمیل شد ✨',
    fi: 'Palvelu valmis ✨',
    fr: 'Prestation terminée ✨',
    gl: 'Servizo completado ✨',
    hi: 'सेवा पूर्ण हुई ✨',
    id: 'Layanan selesai ✨',
    it: 'Prestazione completata ✨',
    ja: 'サービスが完了しました ✨',
    ko: '서비스 완료 ✨',
    ku: 'Xizmet qediya ✨',
    ms: 'Perkhidmatan selesai ✨',
    nl: 'Dienst voltooid ✨',
    pl: 'Usługa zakończona ✨',
    pt: 'Serviço concluído ✨',
    ro: 'Serviciu finalizat ✨',
    ru: 'Услуга выполнена ✨',
    so: 'Adeeg waa dhamaaday ✨',
    sq: 'Shërbimi u përfundua ✨',
    sv: 'Tjänst avslutad ✨',
    th: 'ดำเนินการเสร็จสิ้น ✨',
    tl: 'Tapos na ang serbisyo ✨',
    tr: 'Hizmet tamamlandı ✨',
    uk: 'Послугу завершено ✨',
    vi: 'Dịch vụ đã hoàn tất ✨',
    zh: '服务已完成 ✨'
  },
  refused: {
    ar: 'تم رفض الموعد ❌',
    be: 'Прыём адхілены ❌',
    bn: 'অ্যাপয়েন্টমেন্ট প্রত্যাখ্যাত ❌',
    ca: 'Cita refusada ❌',
    da: 'Aftale afvist ❌',
    de: 'Termin abgelehnt ❌',
    en: 'Appointment refused ❌',
    es: 'Cita rechazada ❌',
    et: 'Aja broneering tagasi lükatud ❌',
    eu: 'Hitzordua ukatua ❌',
    fa: 'نوبت رد شد ❌',
    fi: 'Ajanvaraus hylätty ❌',
    fr: 'RDV refusé ❌',
    gl: 'Cita rexeitada ❌',
    hi: 'अपॉइंटमेंट अस्वीकार ❌',
    id: 'Janji temu ditolak ❌',
    it: 'Appuntamento rifiutato ❌',
    ja: '予約が拒否されました ❌',
    ko: '예약 거부됨 ❌',
    ku: 'Danûstandin hat red kirin ❌',
    ms: 'Temu janji ditolak ❌',
    nl: 'Afspraak geweigerd ❌',
    pl: 'Wizyta odrzucona ❌',
    pt: 'Consulta recusada ❌',
    ro: 'Programare refuzată ❌',
    ru: 'Запись отклонена ❌',
    so: 'Ballan waa la diidays ❌',
    sq: 'Takimi u refuzua ❌',
    sv: 'Möte avböjt ❌',
    th: 'ปฏิเสธนัดหมาย ❌',
    tl: 'Tinanggihan ang appointment ❌',
    tr: 'Randevu reddedildi ❌',
    uk: 'Зустріч відхилено ❌',
    vi: 'Cuộc hẹn bị từ chối ❌',
    zh: '预约被拒绝 ❌'
  },
  deleted: {
    ar: 'تم حذف الموعد 🗑️',
    be: 'Прыём выдалены 🗑️',
    bn: 'অ্যাপয়েন্টমেন্ট মুছে ফেলা হয়েছে 🗑️',
    ca: 'Cita suprimida 🗑️',
    da: 'Aftale slettet 🗑️',
    de: 'Termin gelöscht 🗑️',
    en: 'Appointment deleted 🗑️',
    es: 'Cita eliminada 🗑️',
    et: 'Aja broneering kustutatud 🗑️',
    eu: 'Hitzordua ezabatua 🗑️',
    fa: 'نوبت حذف شد 🗑️',
    fi: 'Ajanvaraus poistettu 🗑️',
    fr: 'RDV supprimé 🗑️',
    gl: 'Cita eliminada 🗑️',
    hi: 'अपॉइंटमेंट हटाया गया 🗑️',
    id: 'Janji temu dihapus 🗑️',
    it: 'Appuntamento eliminato 🗑️',
    ja: '予約が削除されました 🗑️',
    ko: '예약이 삭제되었습니다 🗑️',
    ku: 'Danûstandin jê hat birin 🗑️',
    ms: 'Temu janji dipadam 🗑️',
    nl: 'Afspraak verwijderd 🗑️',
    pl: 'Wizyta usunięta 🗑️',
    pt: 'Consulta eliminada 🗑️',
    ro: 'Programare ștearsă 🗑️',
    ru: 'Запись удалена 🗑️',
    so: 'Ballan waa la tirtiray 🗑️',
    sq: 'Takimi u fshi 🗑️',
    sv: 'Möte raderat 🗑️',
    th: 'ลบนัดหมายแล้ว 🗑️',
    tl: 'Na-delete ang appointment 🗑️',
    tr: 'Randevu silindi 🗑️',
    uk: 'Зустріч видалено 🗑️',
    vi: 'Cuộc hẹn đã xóa 🗑️',
    zh: '预约已删除 🗑️'
  },
  'no-show-client': {
    ar: 'العميل لم يحضر 🚫',
    be: 'Кліент не прыйшоў 🚫',
    bn: 'ক্লায়েন্ট উপস্থিত হয়নি 🚫',
    ca: 'Client absent 🚫',
    da: 'Kunden dukkede ikke op 🚫',
    de: 'Kunde nicht erschienen 🚫',
    en: 'Client no-show 🚫',
    es: 'Cliente ausente 🚫',
    et: 'Klient ei ilmunud 🚫',
    eu: 'Bezeroa ez da agertu 🚫',
    fa: 'مشتری حاضر نشد 🚫',
    fi: 'Asiakas ei saapunut 🚫',
    fr: 'Client absent 🚫',
    gl: 'Cliente ausente 🚫',
    hi: 'ग्राहक नहीं आया 🚫',
    id: 'Klien tidak hadir 🚫',
    it: 'Cliente assente 🚫',
    ja: '顧客が来ませんでした 🚫',
    ko: '고객 노쇼 🚫',
    ku: 'Mişterî nehat 🚫',
    ms: 'Pelanggan tidak hadir 🚫',
    nl: 'Klant niet verschenen 🚫',
    pl: 'Klient nie przyszedł 🚫',
    pt: 'Cliente ausente 🚫',
    ro: 'Client absent 🚫',
    ru: 'Клиент не пришёл 🚫',
    so: 'Macmiil ma imaan 🚫',
    sq: 'Klienti nuk erdhi 🚫',
    sv: 'Kund dök inte upp 🚫',
    th: 'ลูกค้าไม่มา 🚫',
    tl: 'Hindi dumating ang kliyente 🚫',
    tr: 'Müşteri gelmedi 🚫',
    uk: 'Клієнт не з’явився 🚫',
    vi: 'Khách không đến 🚫',
    zh: '客户未到场 🚫'
  },
  'no-show-pro': {
    ar: 'المحترف لم يحضر 🚫',
    be: 'Спецыяліст не прыйшоў 🚫',
    bn: 'পেশাদার উপস্থিত হয়নি 🚫',
    ca: 'Professional absent 🚫',
    da: 'Professionel dukkede ikke op 🚫',
    de: 'Dienstleister nicht erschienen 🚫',
    en: 'Pro no-show 🚫',
    es: 'Profesional ausente 🚫',
    et: 'Spetsialist ei ilmunud 🚫',
    eu: 'Profesionala ez da agertu 🚫',
    fa: 'متخصص حاضر نشد 🚫',
    fi: 'Ammattilainen ei saapunut 🚫',
    fr: 'Pro absent 🚫',
    gl: 'Profesional ausente 🚫',
    hi: 'प्रोফेशनल नहीं आया 🚫',
    id: 'Profesional tidak hadir 🚫',
    it: 'Professionista assente 🚫',
    ja: '施術者が来ませんでした 🚫',
    ko: '전문가 노쇼 🚫',
    ku: 'Pêşekar nehat 🚫',
    ms: 'Profesional tidak hadir 🚫',
    nl: 'Professional niet verschenen 🚫',
    pl: 'Specjalista nie przyszedł 🚫',
    pt: 'Profissional ausente 🚫',
    ro: 'Specialist absent 🚫',
    ru: 'Специалист не пришёл 🚫',
    so: 'Khabiir ma imaan 🚫',
    sq: 'Profesionalisti nuk erdhi 🚫',
    sv: 'Proffs dök inte upp 🚫',
    th: 'ผู้เชี่ยวชาญไม่มา 🚫',
    tl: 'Hindi dumating ang propesyunal 🚫',
    tr: 'Usta gelmedi 🚫',
    uk: 'Майстер не з’явився 🚫',
    vi: 'Thợ không đến 🚫',
    zh: '服务人员未到场 🚫'
  },
};

/** Format court pour l’horaire */
function formatSlot(value: any): string {
  const dt = new Date(value || Date.now());
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

function truncate(s: string, max = 90) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
