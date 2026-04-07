import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

type EmailInput = {
  to: string;
  subject: string;
  text: string;
};

const hasSmtp = Boolean(config.smtpHost && config.smtpUser && config.smtpPass);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    })
  : null;

export const sendEmail = async ({ to, subject, text }: EmailInput) => {
  if (!transporter) {
    logger.warn({ to, subject }, 'SMTP not configured. Simulating email send.');
    return { messageId: `simulated-${Date.now()}` };
  }
  return transporter.sendMail({ from: config.fromEmail, to, subject, text });
};
