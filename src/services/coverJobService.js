/**
 * COVER JOB SERVICE
 *
 * Durable-enough job store for the Cover Generator tab, so a generation is never
 * lost when the user refreshes or leaves the page. Jobs live in an in-memory Map
 * (survives a page refresh since the server process keeps running) and are also
 * best-effort persisted as small JSON blobs in the existing `covers` Supabase
 * bucket (survives a server restart for finished jobs). We do NOT create a new
 * table: the service-role key on this project cannot create buckets/tables, so
 * we reuse the `covers` bucket with a `jobs/` prefix.
 *
 * This wraps the LIVE /api/cover-generator/generate path over localhost; it never
 * modifies the generator itself.
 */

const logger = require('../utils/logger');
const { getSupabaseClient } = require('../config/supabase');

const BUCKET = 'covers';
const PREFIX = 'jobs';
const jobs = new Map();
let counter = 0;

function newId() {
  counter += 1;
  return `cv_${Date.now().toString(36)}_${counter}`;
}

function persist(job) {
  try {
    const client = getSupabaseClient();
    if (!client) return;
    const body = Buffer.from(JSON.stringify(job));
    Promise.resolve(
      client.storage.from(BUCKET).upload(`${PREFIX}/${job.id}.json`, body, {
        contentType: 'application/json', cacheControl: '60', upsert: true
      })
    ).then(({ error }) => {
      if (error) logger.warn(`cover job persist failed (${job.id}): ${error.message || JSON.stringify(error)}`);
    }).catch((e) => logger.warn(`cover job persist threw (${job.id}): ${e.message}`));
  } catch (e) {
    logger.warn(`cover job persist error (${job.id}): ${e.message}`);
  }
}

// Keep the in-memory map bounded so long-running processes never leak memory
// from accumulated cover jobs. Finished jobs older than the cap are dropped from
// memory (a persisted copy still exists in storage for late polls).
const MAX_JOBS = 250;
function evictIfNeeded() {
  if (jobs.size <= MAX_JOBS) return;
  const sorted = [...jobs.values()].sort((a, b) => a.updatedAt - b.updatedAt);
  for (const j of sorted) {
    if (jobs.size <= MAX_JOBS) break;
    if (j.status !== 'running') jobs.delete(j.id);
  }
}

function createJob(meta = {}) {
  const id = newId();
  const now = Date.now();
  evictIfNeeded();
  const job = {
    id, status: 'running', progress: 5, stepLabel: 'Starting',
    title: meta.title || '', result: null, error: null,
    createdAt: now, updatedAt: now
  };
  jobs.set(id, job);
  persist(job);
  return job;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
  // Persist on terminal states (and creation) only, to avoid chatty writes.
  if (patch.status === 'completed' || patch.status === 'failed') persist(job);
}

async function getJob(id) {
  if (jobs.has(id)) return jobs.get(id);
  // Miss: the server may have restarted. Try the persisted JSON (finished jobs).
  try {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.storage.from(BUCKET).download(`${PREFIX}/${id}.json`);
    if (error || !data) return null;
    const job = JSON.parse(await data.text());
    jobs.set(id, job);
    return job;
  } catch (e) {
    logger.warn(`cover getJob(${id}) failed: ${e.message}`);
    return null;
  }
}

function publicView(job) {
  if (!job) return null;
  return {
    jobId: job.id, status: job.status, progress: job.progress,
    stepLabel: job.stepLabel, title: job.title, error: job.error,
    result: job.status === 'completed' ? job.result : null,
    createdAt: job.createdAt
  };
}

// A cover job that has been 'running' with no update for a while died with the
// process (deploy/crash). Flip it to failed so the client stops waiting forever.
const STALE_MS = 6 * 60 * 1000;
function sweepStale() {
  const now = Date.now();
  for (const job of jobs.values()) {
    if (job.status === 'running' && (now - job.updatedAt) > STALE_MS) {
      job.status = 'failed';
      job.error = 'Interrupted by a server restart. Please generate again.';
      job.updatedAt = now;
      persist(job);
    }
  }
}
setInterval(() => { try { sweepStale(); } catch (e) {} }, 3 * 60 * 1000);

module.exports = { createJob, updateJob, getJob, publicView };
