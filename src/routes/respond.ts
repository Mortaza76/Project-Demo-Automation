import { Router } from 'express';
import { getLeadByToken, setLeadRequestedSlot, updateLeadStatus } from '../db';
import { queueCreateEventAndConfirm } from '../services/workflow';
import { normalizeSlot, slotSchema } from '../utils/validation';

export const respondRouter = Router();

respondRouter.get('/respond/:token', (req, res) => {
  const lead = getLeadByToken(req.params.token) as any;
  if (!lead) return res.status(404).send('Invalid response link');

  return res.send(`<!doctype html>
<html>
  <head><title>Choose demo slot</title></head>
  <body style="font-family: sans-serif; max-width: 600px; margin: 2rem auto;">
    <h2>Schedule Your BellMedEx Demo</h2>
    <p>Hello ${lead.full_name}, select your preferred 30-minute slot.</p>
    <form method="POST" action="/respond/${lead.response_token}">
      <label>Date:</label><br/>
      <input type="date" name="date" required/><br/><br/>
      <label>Time:</label><br/>
      <input type="time" name="time" step="1800" required/><br/><br/>
      <label>Timezone:</label><br/>
      <input type="text" name="timezone" value="${lead.timezone}" required/><br/><br/>
      <button type="submit">Confirm Slot</button>
    </form>
  </body>
</html>`);
});

respondRouter.post('/respond/:token', (req, res) => {
  const lead = getLeadByToken(req.params.token) as any;
  if (!lead) return res.status(404).send('Invalid response link');

  const parsed = slotSchema.safeParse({
    date: req.body.date,
    time: req.body.time,
    timezone: req.body.timezone || lead.timezone,
  });
  if (!parsed.success) return res.status(400).send('Invalid slot format');

  try {
    normalizeSlot(parsed.data.date, parsed.data.time, parsed.data.timezone);
  } catch (e) {
    return res.status(400).send(`Slot rejected: ${(e as Error).message}`);
  }

  setLeadRequestedSlot(lead.id, parsed.data.date, parsed.data.time, parsed.data.timezone);
  updateLeadStatus(lead.id, 'SLOT_RECEIVED', 'Lead selected slot', parsed.data);
  queueCreateEventAndConfirm(lead.id);

  return res.send('Thank you. Your slot is received and confirmation will be sent shortly.');
});
