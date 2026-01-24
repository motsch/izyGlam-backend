type RefundEmailLang = "fr" | "en";

function escapeHtml(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dt: any) {
  try {
    const d = new Date(dt);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
  } catch {
    return "";
  }
}

const COPY: Record<RefundEmailLang, any> = {
  fr: {
    subject: "Remboursement confirmé",
    title: "Remboursement confirmé",
    hello: (name: string) => `Bonjour ${name},`,
    intro:
      "Nous vous confirmons l’annulation de votre réservation et le lancement du remboursement.",
    outro:
      "Le remboursement apparaîtra sur votre compte bancaire selon les délais de votre établissement (généralement 2 à 10 jours ouvrés).",
    details: "Détails de la réservation",
    establishment: "Établissement",
    service: "Prestation",
    date: "Date",
    amount: "Montant remboursé",
    ref: "Référence",
    support: "Besoin d’aide ? Répondez simplement à cet email.",
    footer: "© IzyGlam • Tous droits réservés.",
  },
  en: {
    subject: "Refund confirmed",
    title: "Refund confirmed",
    hello: (name: string) => `Hello ${name},`,
    intro:
      "We confirm that your booking has been cancelled and your refund has been initiated.",
    outro:
      "The refund will appear on your bank account depending on your bank processing times (usually 2–10 business days).",
    details: "Booking details",
    establishment: "Establishment",
    service: "Service",
    date: "Date",
    amount: "Refunded amount",
    ref: "Reference",
    support: "Need help? Just reply to this email.",
    footer: "© IzyGlam • All rights reserved.",
  },
};

export function renderClientRefundEmailHTML(params: {
  lang: string;
  clientName: string;
  establishmentName: string;
  productName: string;
  start: Date;
  price: string;
  bookingId: string;
}) {
  const lang2: RefundEmailLang = params.lang === "fr" ? "fr" : "en";
  const c = COPY[lang2];
  const year = new Date().getFullYear();

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(c.subject)}</title>
</head>
<body style="margin:0;background:#f7f7fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(90deg,#ff5fa2,#ff86b8);padding:22px 28px;color:#fff;">
              <div style="font-size:18px;font-weight:700;letter-spacing:0.2px;">IzyGlam</div>
              <div style="margin-top:6px;font-size:14px;opacity:0.95;">${escapeHtml(c.title)}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 28px;color:#2b2b33;">
              <div style="font-size:18px;font-weight:700;margin-bottom:10px;">${escapeHtml(
                c.hello(params.clientName)
              )}</div>

              <div style="font-size:14px;line-height:1.6;color:#44445a;">
                ${escapeHtml(c.intro)}
              </div>

              <div style="margin-top:10px;font-size:14px;line-height:1.6;color:#44445a;">
                ${escapeHtml(c.outro)}
              </div>

              <div style="margin-top:18px;padding:14px 16px;border:1px solid #f0e6f2;border-radius:14px;background:#fff7fb;">
                <div style="font-size:13px;color:#6a5a77;font-weight:700;margin-bottom:8px;">${escapeHtml(
                  c.details
                )}</div>
                <div style="font-size:14px;line-height:1.7;color:#2b2b33;">
                  <div><strong>${escapeHtml(c.establishment)} :</strong> ${escapeHtml(
                    params.establishmentName
                  )}</div>
                  <div><strong>${escapeHtml(c.service)} :</strong> ${escapeHtml(params.productName)}</div>
                  <div><strong>${escapeHtml(c.date)} :</strong> ${escapeHtml(formatDate(params.start))}</div>
                  <div><strong>${escapeHtml(c.amount)} :</strong> ${escapeHtml(params.price)} €</div>
                  <div><strong>${escapeHtml(c.ref)} :</strong> ${escapeHtml(params.bookingId)}</div>
                </div>
              </div>

              <div style="margin-top:18px;font-size:14px;line-height:1.6;color:#44445a;">
                ${escapeHtml(c.support)}
              </div>

              <div style="margin-top:24px;border-top:1px solid #f2edf4;padding-top:14px;font-size:12px;color:#7d7386;">
                © ${year} IzyGlam • ${escapeHtml(c.footer)}
              </div>
            </td>
          </tr>
        </table>

        <div style="width:640px;max-width:100%;text-align:center;font-size:11px;color:#9a92a3;margin-top:12px;">
          Cet email a été envoyé automatiquement, merci de ne pas partager d’informations sensibles.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    c.subject,
    "",
    c.hello(params.clientName),
    c.intro,
    c.outro,
    "",
    `${c.establishment}: ${params.establishmentName}`,
    `${c.service}: ${params.productName}`,
    `${c.date}: ${formatDate(params.start)}`,
    `${c.amount}: ${params.price} €`,
    `${c.ref}: ${params.bookingId}`,
  ].join("\n");

  return { subject: c.subject, html, text };
}

export function renderAdminBlockRecapEmailHTML(params: {
  shopName: string;
  shopId: string;
  reason: string;
  dateTime: string;
  rowsHtml: string;
}) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Shop bloqué + remboursements</title>
</head>
<body style="margin:0;background:#0b0b10;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b10;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="760" cellpadding="0" cellspacing="0" style="background:#12121a;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:18px 22px;background:#151521;color:#fff;">
              <div style="font-size:16px;font-weight:800;">IzyGlam • Admin</div>
              <div style="font-size:12px;opacity:0.85;margin-top:4px;">Action critique : blocage shop + remboursements</div>
            </td>
          </tr>

          <tr>
            <td style="padding:22px;color:#e9e9f2;">
              <div style="font-size:14px;line-height:1.6;color:#cfcfe3;">
                <strong>Shop bloqué :</strong> ${escapeHtml(params.shopName)} (${escapeHtml(params.shopId)})<br/>
                <strong>Motif :</strong> ${escapeHtml(params.reason)}<br/>
                <strong>Date :</strong> ${escapeHtml(params.dateTime)}
              </div>

              <div style="margin-top:16px;padding:14px 16px;background:#0f0f16;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:13px;font-weight:700;margin-bottom:10px;">Bookings impactés (pending/accepted)</div>
                ${params.rowsHtml || `<div style="font-size:12px;color:#b7b7cc;">Aucun booking à rembourser.</div>`}
              </div>

              <div style="margin-top:16px;font-size:12px;color:#9b9bb3;">
                NB : chaque booking a été passé en <strong>cancelled</strong> après remboursement Stripe (si PaymentIntent disponible).
              </div>
            </td>
          </tr>
        </table>

        <div style="width:760px;max-width:100%;text-align:center;font-size:11px;color:#7f7f96;margin-top:12px;">
          Journal interne • IzyGlam
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "Shop bloqué + remboursements",
    `Shop: ${params.shopName} (${params.shopId})`,
    `Motif: ${params.reason}`,
    `Date: ${params.dateTime}`,
  ].join("\n");

  return { subject: `Shop bloqué : ${params.shopName}`, html, text };
}
