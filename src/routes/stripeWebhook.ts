import * as express from "express";
import { stripe } from "../services/companyStripeBilling";
import CompanyModel from "../models/company";
import UserModel from "../models/user";
import { logger } from "../utils/logger";

const router = express.Router();

function isBillableEmployee(u: any): boolean {
  if (u.active === false) return false;
  if (u.companyContractEnd) {
    const end = new Date(u.companyContractEnd);
    if (end.getTime() < Date.now()) return false;
  }
  return true;
}

/**
 * Top-up : si employee.credit < employee.companyMonthlyCredit => compléter depuis company.credit
 * sans effacer le restant.
 */
async function topUpEmployeesFromCompany(companyId: string) {
  const company = await CompanyModel.findById(companyId);
  if (!company) return;

  const employees = await UserModel.find({ companyId }).select("active credit companyMonthlyCredit companyContractEnd").lean();
  const billables = employees.filter(isBillableEmployee);

  for (const emp of billables) {
    const current = Number(emp.credit) || 0;
    const target = Number(emp.companyMonthlyCredit) || 0;
    if (target <= 0) continue;

    if (current < target) {
      const missing = target - current;
      if (company.credit >= missing) {
        await UserModel.updateOne({ _id: emp._id }, { $inc: { credit: missing } });
        company.credit -= missing;
      }
    }
  }
  await company.save();
}

router.post("/webhooks/stripe", async (req: any, res: any) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // ✅ Subscription created (via Checkout)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const subscriptionId = session.subscription;
      const customerId = session.customer;
      const companyId = session.metadata?.companyId;

      if (companyId && subscriptionId) {
        await CompanyModel.findByIdAndUpdate(companyId, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "active",
        });
      }
    }

    // ✅ Paiement confirmé => on crédite l'entreprise
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as any;

      const subscriptionId = invoice.subscription as string;
      const amountPaidCents = Number(invoice.amount_paid || 0);
      const amountPaidEur = Math.round(amountPaidCents / 100);

      const company = await CompanyModel.findOne({ stripeSubscriptionId: subscriptionId });
      if (company) {
        // période en cours (Stripe period end)
        // invoice.lines.data[0].period.end est le plus simple
        const periodEndUnix = invoice?.lines?.data?.[0]?.period?.end;
        const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

        company.credit = Number(company.credit || 0) + Number(amountPaidEur || 0);
        company.subscriptionStatus = "active";
        company.abonnement_end = periodEnd || company.abonnement_end;
        company.creditsZeroedAt = null; // si ça repart, on “réactive”
        await company.save();

        // top-up
        await topUpEmployeesFromCompany(company._id.toString());

        logger.info({
          msg: "invoice.paid processed",
          companyId: company._id.toString(),
          amountPaidEur,
          abonnement_end: company.abonnement_end,
        });
      }
    }

    // ✅ statut / cancel / end
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as any;
      const company = await CompanyModel.findOne({ stripeSubscriptionId: sub.id });
      if (company) {
        const status = sub.status || "unknown";
        company.subscriptionStatus = status;

        const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
        company.abonnement_end = currentPeriodEnd || company.abonnement_end;

        if (status === "canceled") {
          company.canceledAt = new Date();
        }

        await company.save();
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    logger.error({ msg: "stripe webhook failed", errorMessage: err?.message, stack: err?.stack });
    return res.status(500).json({ error: "Webhook handler failed" });
  }
});

export default router;
