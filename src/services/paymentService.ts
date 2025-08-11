import axios from "axios";

interface SepaPaymentPayload {
  iban: string;
  bic: string;
  amount: number;
  label: string;
  recipient: string;
}

/**
 * Envoie un virement SEPA au prestataire
 */
export const sendSepaTransferToPro = async ({
  iban,
  bic,
  amount,
  label,
  recipient,
}: SepaPaymentPayload) => {
  try {
    // 👉 Ici, tu branches l’API de ta banque ou Stripe
    // Pour le test, on simule un appel (à remplacer)

    console.log(`💸 Paiement de ${amount}€ à ${recipient} (${iban} - ${bic})`);
    console.log(`📝 Motif : ${label}`);

    // Exemple si tu utilises Stripe Connect ou un agrégateur (ex : Treezor, MangoPay, Qonto API...)
    /*
    await axios.post('https://api.ta-banque.fr/sepa-transfers', {
      iban, bic, amount, label, recipient
    }, {
      headers: { Authorization: `Bearer ${process.env.BANK_API_KEY}` }
    });
    */

    return true;
  } catch (err) {
    console.error("Erreur lors du virement SEPA :", err);
    throw err;
  }
};
