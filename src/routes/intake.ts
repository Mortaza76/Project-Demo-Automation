import { Router } from 'express';
import { config } from '../config';
import { createLead } from '../db';
import { queueSendAvailabilityEmail } from '../services/workflow';
import { intakeSchema } from '../utils/validation';

export const intakeRouter = Router();

intakeRouter.post('/intake', (req, res) => {
  const parsed = intakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const lead = createLead({
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    organization: parsed.data.organization,
    products: parsed.data.products,
    timezone: config.timezone,
  }) as any;

  queueSendAvailabilityEmail(lead.id);

  return res.status(201).json({
    id: lead.id,
    status: lead.status,
    message: 'Lead created. Availability email queued.',
  });
});
