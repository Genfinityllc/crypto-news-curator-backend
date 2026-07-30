/**
 * REWRITE JOB SERVICE (Phase 2)
 *
 * Minimal in-memory job store for the multi-stage rewrite pipeline, which is
 * too slow for a synchronous request. A job is started, runs in the background,
 * and the client polls for progress. numReplicas is 1, so in-memory is safe;
 * if the service is ever scaled beyond 1 replica this must move to a shared
 * store (Redis/Supabase).
 */

const logger = require('../utils/logger');

const jobs = new Map();
const TTL_MS = 60 * 60 * 1000; // keep finished jobs for 1 hour
let counter = 0;

function newId() {
  counter += 1;
  return `rw_${Date.now().toString(36)}_${counter}`;
}

function createJob() {
  const id = newId();
  const job = {
    id,
    status: 'running', // running | completed | failed
    step: 'queued',
    stepLabel: 'Queued',
    progress: 0,
    result: null,
    error: null,
    usedFallback: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  jobs.set(id, job);
  return job;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
}

function getJob(id) {
  return jobs.get(id) || null;
}

// Public view (omit nothing sensitive; result is the publishing package)
function publicView(job) {
  if (!job) return null;
  return {
    jobId: job.id,
    status: job.status,
    step: job.step,
    stepLabel: job.stepLabel,
    progress: job.progress,
    usedFallback: job.usedFallback,
    error: job.error,
    result: job.status === 'completed' ? job.result : null
  };
}

// Periodic cleanup of old jobs (guarded so it never crashes the process)
setInterval(() => {
  try {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - job.updatedAt > TTL_MS) jobs.delete(id);
    }
  } catch (e) {
    logger.warn(`rewriteJobService cleanup error: ${e.message}`);
  }
}, 10 * 60 * 1000);

module.exports = { createJob, updateJob, getJob, publicView };
