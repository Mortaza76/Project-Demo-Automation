import express from 'express';
import path from 'path';
import './db';
import { config } from './config';
import { intakeRouter } from './routes/intake';
import { respondRouter } from './routes/respond';
import { adminRouter } from './routes/admin';
import { logger } from './utils/logger';
import { startWorker } from './services/worker';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve('public')));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', intakeRouter);
app.use('/', respondRouter);
app.use('/api', adminRouter);

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Server started');
});

startWorker();
