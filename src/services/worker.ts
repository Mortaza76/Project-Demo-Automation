import { claimDueJobs } from '../db';
import { processJob } from './workflow';
import { logger } from '../utils/logger';

let running = false;

export const startWorker = () => {
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const jobs = claimDueJobs(10);
      for (const job of jobs) {
        try {
          await processJob(job);
        } catch (err) {
          logger.error({ jobId: job.id, err: (err as Error).message }, 'Job processing failed');
        }
      }
    } finally {
      running = false;
    }
  }, 1500);
};
