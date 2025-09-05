import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // ou ton SMTP (ex: mailgun, sendgrid, ovh…)
  port: 587,
  secure: false, // true si port 465
  auth: {
    user: process.env.SMTP_USER, // mets ça dans ton .env
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  return transporter.sendMail({
    from: `"IzyGlam" <${process.env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}
