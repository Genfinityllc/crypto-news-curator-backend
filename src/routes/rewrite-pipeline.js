const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const jobService = require('../services/rewriteJobService');
const { runPipeline } = require('../services/articlePipelineService');
const { generateFullLengthRewrite } = require('../services/enhanced-ai-rewrite');

/**
 * REWRITE PIPELINE ROUTES (Phase 2)
 *
 * Async, multi-stage fact-checked rewrite. The button starts a job and polls
 * for progress, because the pipeline takes tens of seconds to a couple of
 * minutes. If the pipeline fails at any point, it falls back to the existing
 * single-call rewrite so the button never dead-ends.
 */

/**
 * Map the legacy generateFullLengthRewrite result into the pipeline result
 * shape so the frontend can render either the same way.
 */
function mapFallback(fb) {
  return {
    fallback: true,
    article: {
      seo_title: fb.originalTitle || fb.title || '',
      headline: fb.title || '',
      subheadline: '',
      slug: '',
      meta_description: '',
      focus_keyphrase: '',
      secondary_keyphrases: [],
      categories: [],
      tags: [],
      article_markdown: fb.content || '',
      official_sources: [],
      image_alt_text: '',
      image_caption: ''
    },
    verification: null,
    audit: null,
    overallScore: null,
    mechanicalFailures: [],
    requiresHumanReview: false,
    visualBrief: null,
    sources: fb.sources || []
  };
}

async function runJob(jobId, source) {
  try {
    const result = await runPipeline(source, (step, label, pct) => {
      jobService.updateJob(jobId, { step, stepLabel: label, progress: pct });
    });
    jobService.updateJob(jobId, {
      status: 'completed', progress: 100, step: 'done', stepLabel: 'Complete', result
    });
  } catch (e) {
    logger.warn(`rewrite pipeline failed (${jobId}), falling back to standard rewrite: ${e.message}`);
    try {
      jobService.updateJob(jobId, {
        step: 'fallback', stepLabel: 'Pipeline unavailable, using standard rewrite', progress: 80, usedFallback: true
      });
      const fb = await generateFullLengthRewrite(source.title, source.content, source.url);
      jobService.updateJob(jobId, {
        status: 'completed', progress: 100, step: 'done',
        stepLabel: 'Complete (standard rewrite)', result: mapFallback(fb), usedFallback: true
      });
    } catch (e2) {
      logger.error(`rewrite fallback also failed (${jobId}): ${e2.message}`);
      jobService.updateJob(jobId, { status: 'failed', error: e2.message, usedFallback: true });
    }
  }
}

/**
 * POST /api/rewrite-pipeline/start
 * Body: { title, content, url? }
 * Returns: { success, jobId }
 */
router.post('/start', async (req, res) => {
  try {
    const { title, content, url } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'title and content are required' });
    }
    const job = jobService.createJob({ title });
    // Fire and forget; the handler is fully guarded so it never rejects here.
    runJob(job.id, { title, content, url }).catch((e) => {
      logger.error(`rewrite job ${job.id} crashed: ${e.message}`);
      jobService.updateJob(job.id, { status: 'failed', error: e.message });
    });
    return res.json({ success: true, jobId: job.id });
  } catch (error) {
    logger.error(`rewrite-pipeline start failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rewrite-pipeline/status/:jobId
 * Returns: { success, jobId, status, step, stepLabel, progress, usedFallback, error, result }
 */
router.get('/status/:jobId', async (req, res) => {
  const job = await jobService.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'job not found' });
  return res.json({ success: true, ...jobService.publicView(job) });
});

/**
 * GET /api/rewrite-pipeline/list?limit=40
 * Shared recent rewrites for the Article Studio page (summaries, no full result).
 */
router.get('/list', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 40, 100);
  const items = await jobService.listJobs(limit);
  return res.json({ success: true, jobs: items });
});

module.exports = router;
