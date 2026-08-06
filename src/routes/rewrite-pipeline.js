const express = require('express');
const axios = require('axios');
const router = express.Router();
const logger = require('../utils/logger');
const jobService = require('../services/rewriteJobService');
const { runPipeline, artDirect, deriveSeoMetadata } = require('../services/articlePipelineService');
const { generateFullLengthRewrite } = require('../services/enhanced-ai-rewrite');

// Article Studio covers default to the text-enabled news collage (real factual
// clippings pulled from the article). The Cover Generator tab never uses it.
const NEWS_COLLAGE_STYLE = '32b_editorial_collage_news';

const FOR_ARTICLE_URL = `http://localhost:${process.env.PORT || 3001}/api/cover-generator/for-article`;

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

/**
 * Generate a cover for a completed pipeline result via the live /for-article
 * wrapper (real logo from the verified entities, rotated style, article 3D
 * subject, PNG X-ready). Shared by the auto-cover step and the manual endpoint.
 */
async function generateCoverForResult(result, opts = {}) {
  const a = result.article || {};
  const brief = result.visualBrief || {};
  const entities = (brief.primary_entities || []).join(', ');

  // Resolve the style. Article Studio defaults to the text-enabled news collage.
  const styleId = opts.styleId || opts.defaultStyle || NEWS_COLLAGE_STYLE;
  const isNews = styleId === NEWS_COLLAGE_STYLE;

  // For the news collage, derive a bespoke design concept + truthful text
  // clippings from the verified article (unless the caller already supplied
  // them, e.g. a re-render with edited overlays). This is what makes each
  // Article Studio cover a unique graphic keyed to the story.
  let concept = opts.concept || null;
  let textElements = opts.textElements || null;
  let subject = opts.subject;
  let paletteColors = opts.paletteColors;
  if (isNews && !concept && !textElements) {
    const facts = (result.verification && result.verification.confirmed_facts) || [];
    const c = await artDirect({
      title: a.headline || a.seo_title,
      body: a.article_markdown || '',
      logoSymbol: (brief.primary_entities || [])[0],
      withText: true,
      withTitle: opts.withTitle,
      withSubtext: opts.withSubtext,
      facts
    });
    if (c) {
      concept = c.image_prompt + (c.logo_treatment ? ` Logo: ${c.logo_treatment}.` : '');
      textElements = c.text_elements;
      if (!subject) subject = [c.focal_subject, ...(c.supporting_subjects || [])].filter(Boolean).join(', ');
      // Colours are NOT set here: leaving paletteColors undefined makes
      // /for-article pick a RANDOM pairing from the existing palettes each time.
    }
  }

  const resp = await axios.post(FOR_ARTICLE_URL, {
    title: a.headline,
    // The ORIGINAL, pre-rewrite title so person-name detection uses the name
    // even when the rewrite dropped it from the headline.
    originalTitle: opts.originalTitle || null,
    content: `${entities}. ${(a.article_markdown || '').slice(0, 500)}`,
    styleId,
    useSubject: opts.useSubject,
    subject, // focal + supporting subjects (flat) or typed 3D element (glass)
    buildings: opts.buildings, // picked buildings for the flat collage style
    concept, // bespoke visual concept (news collage only)
    textElements, // truthful factual clippings (news collage only)
    paletteColors, // [accent1, accent2] from the concept, or a caller preset
    xFormat: opts.xFormat || 'png',
    bgColor: '#000000' // article covers always use a black background
  }, { timeout: 330000, validateStatus: (s) => s < 500 });
  if (resp.status !== 200 || !resp.data || !resp.data.success) {
    throw new Error((resp.data && resp.data.error) || 'Cover generation failed');
  }
  const d = resp.data;
  return {
    imageUrl: d.imageUrl, xReadyUrl: d.xReadyUrl, symbolUsed: d.symbolUsed,
    styleUsed: d.styleUsed, subjectUsed: d.subjectUsed, mode: d.mode,
    concept, textElements // surface what was rendered so the UI can show it
  };
}

async function runJob(jobId, source) {
  try {
    const result = await runPipeline(source, (step, label, pct) => {
      jobService.updateJob(jobId, { step, stepLabel: label, progress: pct });
    });
    // Auto-generate the cover so every finished rewrite arrives with one.
    try {
      jobService.updateJob(jobId, { step: 'cover', stepLabel: 'Designing concept and generating cover', progress: 95 });
      // Rewrite covers use the text-enabled news collage with truthful clippings.
      result.cover = await generateCoverForResult(result, { defaultStyle: NEWS_COLLAGE_STYLE, withTitle: source.withTitle, withSubtext: source.withSubtext, originalTitle: source.title });
    } catch (ce) {
      logger.warn(`auto-cover failed (${jobId}): ${ce.message}`);
    }
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
 * Manual cover job: the user pastes their OWN title + article (not a rewrite),
 * and we run only the cover process on it (concept + truthful text clippings +
 * generate). No fact-check, no rewrite; the pasted text is treated as the final
 * article. The job shows up in the shared Article Studio list like any other.
 */
async function runManualJob(jobId, source) {
  const result = {
    manual: true,
    article: {
      seo_title: source.title, headline: source.title, subheadline: '', slug: '',
      meta_description: '', focus_keyphrase: '', secondary_keyphrases: [], categories: [], tags: [],
      article_markdown: source.content, official_sources: [], image_alt_text: '', image_caption: ''
    },
    verification: null, audit: null, overallScore: null, mechanicalFailures: [],
    requiresHumanReview: false, reviewReasons: [], visualBrief: null, sources: []
  };
  try {
    // Fill the SEO metadata fields from the pasted article (without rewriting it).
    jobService.updateJob(jobId, { step: 'seo', stepLabel: 'Generating SEO metadata', progress: 25 });
    try {
      const seo = await deriveSeoMetadata({ title: source.title, body: source.content });
      if (seo) {
        Object.assign(result.article, {
          seo_title: seo.seo_title || source.title,
          meta_description: seo.meta_description || '',
          focus_keyphrase: seo.focus_keyphrase || '',
          secondary_keyphrases: Array.isArray(seo.secondary_keyphrases) ? seo.secondary_keyphrases : [],
          categories: Array.isArray(seo.categories) ? seo.categories : [],
          tags: Array.isArray(seo.tags) ? seo.tags : [],
          slug: seo.slug || '',
          image_alt_text: seo.image_alt_text || '',
          image_caption: seo.image_caption || ''
        });
      }
    } catch (se) { logger.warn(`manual SEO metadata failed (${jobId}): ${se.message}`); }
    jobService.updateJob(jobId, { step: 'concept', stepLabel: 'Designing the cover concept from your article', progress: 45 });
    jobService.updateJob(jobId, { step: 'cover', stepLabel: 'Generating cover', progress: 70 });
    try {
      result.cover = await generateCoverForResult(result, { defaultStyle: NEWS_COLLAGE_STYLE, withTitle: source.withTitle, withSubtext: source.withSubtext, originalTitle: source.title });
    } catch (ce) {
      logger.warn(`manual auto-cover failed (${jobId}): ${ce.message}`);
    }
    jobService.updateJob(jobId, { status: 'completed', progress: 100, step: 'done', stepLabel: 'Complete', result });
  } catch (e) {
    logger.error(`manual job failed (${jobId}): ${e.message}`);
    jobService.updateJob(jobId, { status: 'failed', error: e.message, result });
  }
}

/**
 * POST /api/rewrite-pipeline/manual
 * Body: { title, content }
 * Runs the cover process on a pasted article (no rewrite). Returns { success, jobId }.
 */
router.post('/manual', async (req, res) => {
  try {
    const { title, content, withTitle, withSubtext } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'title and content are required' });
    }
    const job = jobService.createJob({ title });
    runManualJob(job.id, { title: String(title), content: String(content), withTitle, withSubtext }).catch((e) => {
      logger.error(`manual job ${job.id} crashed: ${e.message}`);
      jobService.updateJob(job.id, { status: 'failed', error: e.message });
    });
    return res.json({ success: true, jobId: job.id });
  } catch (error) {
    logger.error(`rewrite-pipeline manual failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rewrite-pipeline/start
 * Body: { title, content, url? }
 * Returns: { success, jobId }
 */
router.post('/start', async (req, res) => {
  try {
    const { title, content, url, withTitle, withSubtext } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'title and content are required' });
    }
    const job = jobService.createJob({ title });
    // Fire and forget; the handler is fully guarded so it never rejects here.
    runJob(job.id, { title, content, url, withTitle, withSubtext }).catch((e) => {
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

/**
 * POST /api/rewrite-pipeline/:jobId/cover
 * Body: { styleId?, useSubject?, xFormat? }
 * Generates a cover for a completed rewrite using the fact-checked headline and
 * verified entities, then persists it onto the job so it is there on reopen.
 */
router.post('/:jobId/cover', async (req, res) => {
  try {
    const job = await jobService.getJob(req.params.jobId);
    if (!job || !job.result || !job.result.article) {
      return res.status(404).json({ success: false, error: 'Completed rewrite not found' });
    }
    const opts = req.body || {};
    // Mark the cover as regenerating and persist immediately so the in-progress
    // state survives the user leaving and returning to the page.
    jobService.updateJob(job.id, { result: { ...job.result, coverStatus: 'running', coverError: null } });
    // Run in the background; persist the cover (and, for manual jobs, backfill any
    // missing SEO metadata) onto the job when done. This is a fire-and-forget
    // async task so the request returns immediately and the client polls.
    (async () => {
      try {
        const base = (await jobService.getJob(job.id)) || job;
        const patch = {};
        // Backfill SEO metadata for a manual job that never got it.
        if (base.result.manual && base.result.article && !base.result.article.meta_description) {
          try {
            const a = base.result.article;
            const seo = await deriveSeoMetadata({ title: a.headline || a.seo_title, body: a.article_markdown || '' });
            if (seo) patch.article = {
              ...a,
              seo_title: a.seo_title || seo.seo_title,
              meta_description: seo.meta_description || '',
              focus_keyphrase: seo.focus_keyphrase || '',
              secondary_keyphrases: Array.isArray(seo.secondary_keyphrases) ? seo.secondary_keyphrases : [],
              categories: Array.isArray(seo.categories) ? seo.categories : [],
              tags: Array.isArray(seo.tags) ? seo.tags : [],
              slug: seo.slug || '',
              image_alt_text: seo.image_alt_text || '',
              image_caption: seo.image_caption || ''
            };
          } catch (se) { logger.warn(`cover-SEO backfill failed (${job.id}): ${se.message}`); }
        }
        const cover = await generateCoverForResult(base.result, opts);
        const fresh = (await jobService.getJob(job.id)) || base;
        jobService.updateJob(job.id, { result: { ...fresh.result, ...patch, cover, coverStatus: 'done' } });
      } catch (e) {
        logger.error(`job cover failed (${job.id}): ${e.message}`);
        const fresh = (await jobService.getJob(job.id)) || job;
        jobService.updateJob(job.id, { result: { ...fresh.result, coverStatus: 'failed', coverError: e.message } });
      }
    })();
    return res.json({ success: true, started: true });
  } catch (error) {
    logger.error(`job cover failed (${req.params.jobId}): ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
