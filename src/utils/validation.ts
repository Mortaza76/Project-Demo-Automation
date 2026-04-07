import { DateTime } from 'luxon';
import { z } from 'zod';
import { config } from '../config';

export const intakeSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  organization: z.string().min(2),
  products: z.array(z.enum(['CRM', 'MediFusion', 'DocuHub', 'SkyUp'])).min(1),
});

export const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(3).default(config.timezone),
});

export const normalizeSlot = (date: string, time: string, timezone: string) => {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
  if (!dt.isValid) throw new Error('Invalid date/time provided');
  if (dt <= DateTime.now().setZone(timezone)) {
    throw new Error('Meeting time must be in the future');
  }
  const hour = dt.hour;
  if (hour < config.businessStartHour || hour >= config.businessEndHour) {
    throw new Error('Meeting must be within business hours');
  }
  if (dt.minute !== 0 && dt.minute !== 30) {
    throw new Error('Meeting time must be on a 30-minute slot');
  }
  return dt;
};
