import * as admin from 'firebase-admin';
import mongoose, { Types } from 'mongoose';
import { sendEmail } from '../utils/mailer';
import UserModel from '../models/user';

/** Traductions pour notification "nouvelle réservation" */
const NEW_BOOKING_TITLES_I18N: Record<string, string> = {
  fr: "Nouvelle réservation 💌",
  en: "New booking 💌",
  es: "Nueva reserva 💌",
  de: "Neue Buchung 💌",
  it: "Nuova prenotazione 💌",
  nl: "Nieuwe reservering 💌",
  pt: "Nova reserva 💌",
  pl: "Nowa rezerwacja 💌",
  sv: "Ny bokning 💌",
  da: "Ny reservation 💌",
  fi: "Uusi varaus 💌"
};

/** === I18N Chat messages === */
const CHAT_TITLE_I18N: Record<string, string> = {
  fr: "Nouveau message ✉️",
  en: "New message ✉️",
  es: "Nuevo mensaje ✉️",
  de: "Neue Nachricht ✉️",
  it: "Nuovo messaggio ✉️",
  nl: "Nieuw bericht ✉️",
  pt: "Nova mensagem ✉️",
  pl: "Nowa wiadomość ✉️",
  sv: "Nytt meddelande ✉️",
  da: "Ny besked ✉️",
  fi: "Uusi viesti ✉️"
};

const CHAT_PHOTO_BODY_I18N: Record<string, (sender: string) => string> = {
  fr: (s) => `${s} vous a envoyé une photo`,
  en: (s) => `${s} sent you a photo`,
  es: (s) => `${s} te envió una foto`,
  de: (s) => `${s} hat dir ein Foto gesendet`,
  it: (s) => `${s} ti ha inviato una foto`,
  nl: (s) => `${s} heeft je een foto gestuurd`,
  pt: (s) => `${s} enviou-lhe uma foto`,
  pl: (s) => `${s} wysłał(a) Ci zdjęcie`,
  sv: (s) => `${s} skickade dig ett foto`,
  da: (s) => `${s} sendte dig et foto`,
  fi: (s) => `${s} lähetti sinulle kuvan`
};

const CHAT_TEXT_BODY_I18N: Record<string, (sender: string, preview: string) => string> = {
  fr: (s, p) => `${s}: ${p}`,
  en: (s, p) => `${s}: ${p}`,
  es: (s, p) => `${s}: ${p}`,
  de: (s, p) => `${s}: ${p}`,
  it: (s, p) => `${s}: ${p}`,
  nl: (s, p) => `${s}: ${p}`,
  pt: (s, p) => `${s}: ${p}`,
  pl: (s, p) => `${s}: ${p}`,
  sv: (s, p) => `${s}: ${p}`,
  da: (s, p) => `${s}: ${p}`,
  fi: (s, p) => `${s}: ${p}`
};

// --- Firebase Admin (une seule init) ---
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

    const lang = String(langRaw).toLowerCase().slice(0, 2);
    if (CHAT_TITLE_I18N[lang]) return lang;
    return 'en';
  } catch {
    return 'en';
  }
}

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
      const code = r.error?.code || '';
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
  const shop = booking.establishmentName ? ` • ${booking.establishmentName}` : '';

  // 🌍 Titre traduit
  const title = tStatus(status, lang);

  // 🌍 Body traduit
  let body = `${prod} • ${when}${shop}`;
  if (['cancelled', 'deleted', 'refused', 'no-show-client', 'no-show-pro'].includes(status)) {
    body += lang === 'fr' ? ' • Non effectué' : ' • Not done';
  }
  if (status === 'finished') {
    body += lang === 'fr' ? ' • Terminé' : ' • Completed';
  }

  body = truncate(body);

  // --- 1️⃣ Notification Push ---
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

  // --- 2️⃣ Envoi Email ---
  try {
    const user = await UserModel.findById(customerId).lean();
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: title,
        text: body,
        html: `<p><b>${prod}</b></p><p>${when}${shop}</p><p>${body}</p>`
      });
    }
  } catch (err) {
    console.error("Erreur lors de l'envoi de l'email de notification:", err);
  }
}

/** Map des titres par status (ajoute/ajuste librement) */
const STATUS_TITLES_I18N: Record<string, Record<string, string>> = {
  pending: {
    fr: 'RDV en attente ⏳',
    en: 'Appointment pending ⏳',
    es: 'Cita pendiente ⏳',
    de: 'Termin ausstehend ⏳',
    it: 'Appuntamento in attesa ⏳',
    nl: 'Afspraak in afwachting ⏳',
    pt: 'Consulta pendente ⏳',
    pl: 'Wizyta oczekująca ⏳',
    sv: 'Möte väntar ⏳',
    da: 'Aftale afventer ⏳',
    fi: 'Ajanvaraus odottaa ⏳'
  },
  accepted: {
    fr: 'RDV confirmé ✅',
    en: 'Appointment confirmed ✅',
    es: 'Cita confirmada ✅',
    de: 'Termin bestätigt ✅',
    it: 'Appuntamento confermato ✅',
    nl: 'Afspraak bevestigd ✅',
    pt: 'Consulta confirmada ✅',
    pl: 'Wizyta potwierdzona ✅',
    sv: 'Möte bekräftat ✅',
    da: 'Aftale bekræftet ✅',
    fi: 'Ajanvaraus vahvistettu ✅'
  },
  cancelled: {
    fr: 'RDV annulé ❌',
    en: 'Appointment cancelled ❌',
    es: 'Cita cancelada ❌',
    de: 'Termin abgesagt ❌',
    it: 'Appuntamento annullato ❌',
    nl: 'Afspraak geannuleerd ❌',
    pt: 'Consulta cancelada ❌',
    pl: 'Wizyta anulowana ❌',
    sv: 'Möte avbokad ❌',
    da: 'Aftale aflyst ❌',
    fi: 'Ajanvaraus peruttu ❌'
  },
  finished: {
    fr: 'Prestation terminée ✨',
    en: 'Service completed ✨',
    es: 'Servicio completado ✨',
    de: 'Leistung abgeschlossen ✨',
    it: 'Prestazione completata ✨',
    nl: 'Dienst voltooid ✨',
    pt: 'Serviço concluído ✨',
    pl: 'Usługa zakończona ✨',
    sv: 'Tjänst avslutad ✨',
    da: 'Tjeneste afsluttet ✨',
    fi: 'Palvelu valmis ✨'
  },
  refused:
  {
    fr: 'RDV refusé ❌',
    en: 'Service completed ✨',
    es: 'Servicio completado ✨',
    de: 'Leistung abgeschlossen ✨',
    it: 'Prestazione completata ✨',
    nl: 'Dienst voltooid ✨',
    pt: 'Serviço concluído ✨',
    pl: 'Usługa zakończona ✨',
    sv: 'Tjänst avslutad ✨',
    da: 'Tjeneste afsluttet ✨',
    fi: 'Palvelu valmis ✨'
  },
  deleted:
  {
    fr: 'RDV supprimé 🗑️',
    en: 'Service completed ✨',
    es: 'Servicio completado ✨',
    de: 'Leistung abgeschlossen ✨',
    it: 'Prestazione completata ✨',
    nl: 'Dienst voltooid ✨',
    pt: 'Serviço concluído ✨',
    pl: 'Usługa zakończona ✨',
    sv: 'Tjänst avslutad ✨',
    da: 'Tjeneste afsluttet ✨',
    fi: 'Palvelu valmis ✨'
  },
  'no-show-client':
  {
    fr: 'Client absent 🚫',
    en: 'Service completed ✨',
    es: 'Servicio completado ✨',
    de: 'Leistung abgeschlossen ✨',
    it: 'Prestazione completata ✨',
    nl: 'Dienst voltooid ✨',
    pt: 'Serviço concluído ✨',
    pl: 'Usługa zakończona ✨',
    sv: 'Tjänst avslutad ✨',
    da: 'Tjeneste afsluttet ✨',
    fi: 'Palvelu valmis ✨'
  },
  'no-show-pro':
  {
    fr: 'Pro absent 🚫',
    en: 'Service completed ✨',
    es: 'Servicio completado ✨',
    de: 'Leistung abgeschlossen ✨',
    it: 'Prestazione completata ✨',
    nl: 'Dienst voltooid ✨',
    pt: 'Serviço concluído ✨',
    pl: 'Usługa zakończona ✨',
    sv: 'Tjänst avslutad ✨',
    da: 'Tjeneste afsluttet ✨',
    fi: 'Palvelu valmis ✨'
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
