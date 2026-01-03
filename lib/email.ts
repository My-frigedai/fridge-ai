// lib/email.ts
import nodemailer from "nodemailer";

export type MailOpts = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

function getTransport() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT ?? 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error("Missing email configuration in environment variables");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: { user, pass },
  });
}

export async function sendMail(opts: MailOpts) {
  const transport = getTransport();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER!;
  const info = await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return info;
}
