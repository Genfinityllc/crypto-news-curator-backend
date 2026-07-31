/**
 * REWRITE JOB SERVICE (Phase 2)
 *
 * Durable job store for the multi-stage rewrite pipeline. Jobs are persisted to
 * a Supabase table (`rewrite_jobs`) so they survive a page refresh, the user
 * leaving and returning, and a backend restart. An in-memory Map is a
 * write-through cache for the current process. If Supabase is unavailable the
 * service degrades to in-memory only (not durable) rather than crashing.
 *
 * One-time table setup (run in the Supabase SQL editor):
 *
 *   create table if not exists rewrite_jobs (
 *     id text primary key,
 *     status text not null default 'running',
 *     step text,
 *     step_label text,
 *     progress int default 0,
 *     title text,
 *     used_fallback boolean default false,
 *     error text,
 *     result jsonb,
 *     created_at timestamptz default now(),
 *     updated_at timestamptz default now()
 *   );
 */

const logger = require('../utils/logger');
const { getSupabaseClient } = require('../config/supabase');

const TABLE = 'rewrite_jobs';
const jobs = new Map(); // in-memory write-through cache
let counter = 0;

function newId() {
  counter += 1;
  return `rw_${Date.now().toString(36)}_${counter}`;
}

// Map an in-memory job to the Supabase row shape.
function toRow(job) {
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    step_label: job.stepLabel,
    progress: job.progress,
    title: job.title,
    used_fallback: job.usedFallback,
    error: job.error,
    result: job.result,
    updated_at: new Date().toISOString()
  };
}

// Map a Supabase row back to the in-memory job shape.
function fromRow(row) {
  return {
    id: row.id,
    status: row.status,
    step: row.step,
    stepLabel: row.step_label,
    progress: row.progress,
    title: row.title,
    usedFallback: row.used_fallback,
    error: row.error,
    result: row.result,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
  };
}

// Fire-and-forget Supabase write; never throws into the caller.
function persist(job, isInsert) {
  const client = getSupabaseClient();
  if (!client) return;
  const row = toRow(job);
  if (isInsert) row.created_at = new Date(job.createdAt).toISOString();
  Promise.resolve(
    client.from(TABLE).upsert(row, { onConflict: 'id' })
  ).then(({ error }) => {
    if (error) logger.warn(`rewrite_jobs persist failed (${job.id}): ${error.message || JSON.stringify(error)}`);
  }).catch((e) => logger.warn(`rewrite_jobs persist threw (${job.id}): ${e.message}`));
}

function createJob(meta = {}) {
  const id = newId();
  const now = Date.now();
  const job = {
    id,
    status: 'running',
    step: 'queued',
    stepLabel: 'Queued',
    progress: 0,
    title: meta.title || '',
    result: null,
    error: null,
    usedFallback: false,
    createdAt: now,
    updatedAt: now
  };
  jobs.set(id, job);
  persist(job, true);
  return job;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
  persist(job, false);
}

async function getJob(id) {
  if (jobs.has(id)) return jobs.get(id);
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    const job = fromRow(data);
    jobs.set(id, job); // warm the cache
    return job;
  } catch (e) {
    logger.warn(`getJob(${id}) failed: ${e.message}`);
    return null;
  }
}

/**
 * List recent jobs (shared across all users) for the Article Studio page.
 * Summaries only (no full result) so the list is light.
 */
async function listJobs(limit = 40) {
  const client = getSupabaseClient();
  if (!client) {
    return [...jobs.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(summaryView);
  }
  try {
    const { data, error } = await client
      .from(TABLE)
      .select('id,status,step,step_label,progress,title,used_fallback,error,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row) => summaryView(fromRow(row)));
  } catch (e) {
    logger.warn(`listJobs failed: ${e.message}`);
    return [];
  }
}

function summaryView(job) {
  return {
    jobId: job.id,
    status: job.status,
    step: job.step,
    stepLabel: job.stepLabel,
    progress: job.progress,
    title: job.title,
    usedFallback: job.usedFallback,
    error: job.error,
    createdAt: job.createdAt
  };
}

// Full view including the result (for a single job).
function publicView(job) {
  if (!job) return null;
  return {
    ...summaryView(job),
    result: job.status === 'completed' ? job.result : null
  };
}

// Recover jobs orphaned by a server restart. A 'running' job lives in the
// process; if the process restarts (deploy/crash) mid-run, the pipeline dies and
// the job can never complete. Any 'running' job with no update for a while is
// flipped to 'failed' with a clear message, instead of hanging at "running"
// forever. A real run updates every stage, so a long silence means it died.
const STALE_MS = 8 * 60 * 1000;
const INTERRUPTED = 'Interrupted by a server restart. Please run the rewrite again.';

async function sweepStaleJobs() {
  const now = Date.now();
  for (const job of jobs.values()) {
    if (job.status === 'running' && (now - job.updatedAt) > STALE_MS) {
      job.status = 'failed';
      job.error = INTERRUPTED;
      job.updatedAt = now;
      persist(job, false);
    }
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const cutoff = new Date(now - STALE_MS).toISOString();
    await client.from(TABLE)
      .update({ status: 'failed', error: INTERRUPTED, updated_at: new Date(now).toISOString() })
      .eq('status', 'running')
      .lt('updated_at', cutoff);
  } catch (e) {
    logger.warn(`sweepStaleJobs failed: ${e.message}`);
  }
}

// Sweep shortly after boot (clears jobs orphaned by the restart that just
// happened) and periodically thereafter. Guarded so it never crashes the process.
setTimeout(() => { sweepStaleJobs().catch(() => {}); }, 20000);
setInterval(() => { sweepStaleJobs().catch(() => {}); }, 4 * 60 * 1000);

module.exports = { createJob, updateJob, getJob, listJobs, publicView, summaryView, sweepStaleJobs };
