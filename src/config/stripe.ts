// src/config/stripe.ts
// src/config/stripe.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
// supprime apiVersion ici 👆

export default stripe;

