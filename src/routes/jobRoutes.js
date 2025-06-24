import express from 'express';
import rateLimit from 'express-rate-limit';
import jobController from '../controllers/jobController.js';

const router = express.Router();

const createJobLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many job creation requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const statusCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: {
    error: 'Too many status check requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/jobs', createJobLimiter, jobController.createJob);
router.get('/jobs/:request_id/status', statusCheckLimiter, jobController.getJobStatus);
router.post('/vendor-webhook/:vendor', jobController.handleWebhook);
router.get('/jobs', statusCheckLimiter, jobController.getJobs);

export default router; 