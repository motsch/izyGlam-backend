import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("[STRIPE] Missing STRIPE_SECRET_KEY in env");

  stripeSingleton = new Stripe(key, {
    apiVersion: "2024-06-20" as any, // OK si TS chipote : garde as any
  });

  return stripeSingleton;
}
