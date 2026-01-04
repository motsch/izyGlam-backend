import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export async function sendSms(params: { to: string; from: string; body: string }) {
  const { to, from, body } = params;

  return client.messages.create({
    from,
    to,
    body,
  });
}
