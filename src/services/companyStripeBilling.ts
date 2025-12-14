import Stripe from "stripe";
import CompanyModel from "../models/company";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

function requireEnv(name: string) {
  if (!process.env[name]) throw new Error(`Missing env var ${name}`);
  return process.env[name] as string;
}

/**
 * On part sur :
 * - PRICE = 1€ / mois (unit_amount=100)
 * - quantity = company.monthlyTotalAmount (en €)
 */
export async function ensureStripeCustomerForCompany(companyId: string) {
  const company = await CompanyModel.findById(companyId);
  if (!company) throw new Error("Company not found");

  if (company.stripeCustomerId) return company.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: company.email,
    name: company.name,
    metadata: { companyId: company._id.toString() },
  });

  company.stripeCustomerId = customer.id;
  await company.save();

  return customer.id;
}

export async function createCompanyCheckoutSession(companyId: string) {
  const company = await CompanyModel.findById(companyId);
  if (!company) throw new Error("Company not found");

  const customerId = await ensureStripeCustomerForCompany(companyId);

  const priceId = company.stripePriceId || requireEnv("STRIPE_PRICE_ID_1_EUR_MONTH");

  // quantity = monthlyTotalAmount en euros
  const quantity = Math.max(1, Math.floor(Number(company.monthlyTotalAmount || 0)));

  const appUrl = requireEnv("FRONTEND_URL");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity }],
    success_url: `${appUrl}/admin/company?stripe=success`,
    cancel_url: `${appUrl}/admin/company?stripe=cancel`,
    subscription_data: {
      metadata: { companyId: company._id.toString() },
    },
    metadata: { companyId: company._id.toString() },
  });

  return session;
}

export async function syncSubscriptionQuantityFromCompany(companyId: string) {
  const company = await CompanyModel.findById(companyId);
  if (!company) throw new Error("Company not found");

  if (!company.stripeSubscriptionId) return;

  const quantity = Math.max(1, Math.floor(Number(company.monthlyTotalAmount || 0)));

  const sub = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);

  const itemId = sub.items.data[0]?.id;
  if (!itemId) return;

  await stripe.subscriptions.update(company.stripeSubscriptionId, {
    items: [{ id: itemId, quantity }],
    proration_behavior: "create_prorations",
  });
}

export { stripe };
