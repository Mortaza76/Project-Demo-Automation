import dotenv from 'dotenv';

dotenv.config();

const get = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  appBaseUrl: get('APP_BASE_URL', 'http://localhost:3000'),
  timezone: get('DEFAULT_TIMEZONE', 'America/New_York'),
  businessStartHour: Number(process.env.BUSINESS_START_HOUR ?? 9),
  businessEndHour: Number(process.env.BUSINESS_END_HOUR ?? 18),
  dbPath: get('DB_PATH', './demo.sqlite'),
  internalEmail: get('INTERNAL_EMAIL', 'sales@bellmedex.example'),
  fromEmail: get('FROM_EMAIL', 'noreply@bellmedex.example'),
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID,
};
