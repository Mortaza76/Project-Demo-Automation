import { Router } from 'express';
import { getLeadById, getTransitions, listLeads } from '../db';

export const adminRouter = Router();

adminRouter.get('/leads', (_req, res) => {
  const leads = listLeads();
  return res.json(leads);
});

adminRouter.get('/leads/:id', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const lead = getLeadById(id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  return res.json({ lead, transitions: getTransitions(id) });
});
