import nodemailer from 'nodemailer';

/**
 * SMTP transport, configured after dotenv has loaded (see index.js import order).
 *
 * With no credentials this falls back to nodemailer's jsonTransport, which exercises the
 * exact same send path and returns a rendered message without touching the network. That
 * keeps one code path rather than scattering `if (mailEnabled)` through the service, and
 * means the whole notification flow is testable with no Brevo account.
 */

let transport = null;

export const isMailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const mailFrom = () =>
  process.env.MAIL_FROM || 'Jharkhand Tourism <no-reply@jharkhandtourism.gov.in>';

export const configureMailer = () => {
  if (!isMailConfigured()) {
    console.warn('SMTP credentials not set — emails will be rendered locally, not delivered.');
    transport = nodemailer.createTransport({ jsonTransport: true });
    return;
  }

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    // Brevo uses STARTTLS on 587, implicit TLS on 465
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log(`Mailer configured (${process.env.SMTP_HOST})`);
};

export const getTransport = () => {
  if (!transport) configureMailer();
  return transport;
};
