/**
 * ARTICLE PIPELINE SERVICE (Phase 2)
 *
 * Multi-stage, fact-checked editorial rewrite based on the Genfinity pipeline
 * method. Text stages only; the cover is produced separately by the existing
 * cover generator (wired in Phase 3).
 *
 * Stages:
 *   1. Fact-check with web search (gpt-5.5), treating the source as untrusted
 *   2. Normalize research into a structured VerificationReport
 *   3. Rewrite from approved facts into an ArticlePackage (gpt-5.5)
 *   4. Independent audit into an AuditReport, scored in code
 *   5. Mechanical checks (word count, keyphrase placement, ngram overlap)
 *   6. Quality gate + up to 2 revisions, human-review flags
 *   7. Visual brief for the cover
 *
 * Models are mixed for cost: gpt-5.5 for fact-check + rewrite, gpt-5.4-mini for
 * the mechanical stages. All calls go to the OpenAI Responses API over HTTP so
 * we do not depend on a specific SDK version.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const OPENAI_URL = 'https://api.openai.com/v1/responses';

const MODELS = {
  factCheck: 'gpt-5.5',
  rewrite: 'gpt-5.5',
  normalize: 'gpt-5.4-mini',
  audit: 'gpt-5.4-mini',
  brief: 'gpt-5.4-mini'
};

const ARTICLE_TARGETS = {
  minWords: 650,
  maxWords: 1000,
  seoTitleMin: 45,
  seoTitleMax: 65,
  metaMin: 140,
  metaMax: 160
};

const QUALITY_GATE = {
  overall: 8.6,
  factual: 8.6,
  source: 8.5,
  seo: 8.5,
  readability: 8.5,
  google: 8.5
};

// Genfinity's exact disclaimer, appended verbatim at the end of every rewrite.
const GENFINITY_DISCLAIMER =
  'Disclaimer: News content provided by Genfinity is intended solely for informational purposes. While we strive to deliver accurate and up-to-date information, we do not offer financial or legal advice of any kind. Readers are encouraged to conduct their own research and consult with qualified professionals before making any financial or legal decisions. Genfinity disclaims any responsibility for actions taken based on the information presented in our articles. Our commitment is to share knowledge, foster discussion, and contribute to a better understanding of the topics covered in our articles. We advise our readers to exercise caution and diligence when seeking information or making decisions based on the content we provide.';

// ---------------------------------------------------------------------------
// OpenAI Responses helper
// ---------------------------------------------------------------------------

function extractText(respData) {
  const out = respData && respData.output;
  if (!Array.isArray(out)) return '';
  const msg = out.find(o => o.type === 'message');
  if (!msg || !Array.isArray(msg.content)) return '';
  const textItem = msg.content.find(c => c.type === 'output_text');
  return textItem ? textItem.text : '';
}

/**
 * Call the Responses API.
 * @param {object} opts
 * @param {string} opts.model
 * @param {string} opts.instructions
 * @param {string} opts.input
 * @param {object} [opts.schema] JSON schema object -> forces structured output and returns parsed JSON
 * @param {string} [opts.schemaName]
 * @param {Array}  [opts.tools] e.g. [{ type: 'web_search' }]
 * @param {string} [opts.effort] reasoning effort: 'low' | 'medium' | 'high'
 * @param {number} [opts.maxOutputTokens]
 * @returns {Promise<{ text: string, parsed: any, usage: object }>}
 */
async function callResponses(opts) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');

  const body = {
    model: opts.model,
    input: opts.input,
    max_output_tokens: opts.maxOutputTokens || 4000
  };
  if (opts.instructions) body.instructions = opts.instructions;
  if (opts.tools) body.tools = opts.tools;
  if (opts.effort) body.reasoning = { effort: opts.effort };
  if (opts.schema) {
    body.text = {
      format: {
        type: 'json_schema',
        name: opts.schemaName || 'result',
        strict: true,
        schema: opts.schema
      }
    };
  }

  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await axios.post(OPENAI_URL, body, {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        timeout: 240000,
        validateStatus: s => s < 500
      });
      if (resp.status !== 200 || (resp.data && resp.data.error)) {
        const e = resp.data && resp.data.error;
        throw new Error(e ? `${e.code || e.type}: ${e.message}` : `OpenAI HTTP ${resp.status}`);
      }
      const text = extractText(resp.data);
      let parsed = null;
      if (opts.schema) {
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          throw new Error(`Structured output was not valid JSON: ${e.message}`);
        }
      }
      return { text, parsed, usage: resp.data.usage || {} };
    } catch (e) {
      lastErr = e;
      logger.warn(`OpenAI call failed (attempt ${attempt + 1}) [${opts.model}]: ${e.message}`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const FACT_CHECK_PROMPT = `You are a senior crypto-news fact-checking editor.
Treat the submitted article as untrusted. It is not evidence.
Research and verify every substantive factual claim using current web sources.

SOURCE PRIORITY
1. Official company announcements, documentation, support pages and blogs
2. Regulatory filings, government records and court documents
3. Original technical documentation, repositories and protocol records
4. Reputable independent reporting
5. Official social posts only when stronger documentation is unavailable

RULES
- Search for the exact company, protocol, product, date and relationship.
- Do not call a relationship a partnership unless an authoritative source uses that language.
- Separate facts from predictions, promotional claims and inferences.
- Verify exact dates, technical terminology, product names and jurisdictions.
- Do not invent quotes, statistics or context.
- Prefer primary sources for the central claim; flag conflicts and stale or circular sources.

For each claim return: the claim, a verdict (confirmed, partially_confirmed, unverified, contradicted, opinion),
a confidence 0-100, an explanation, the best supporting sources with URLs and whether each is primary,
safe wording that could be published, and wording that must be removed or qualified.
Finally return the overall verdict, confirmed facts, excluded claims, important context and publication risks.

IMPORTANT: Do AT MOST 3 web searches, then STOP searching and write your findings. Do not loop on searches.`;

const NORMALIZE_INSTRUCTIONS =
  'Convert the supplied research into the required schema. Do not add facts, sources or URLs that are not in the research.';

const REWRITE_PROMPT = `You are the senior news editor for Genfinity.
Rewrite the submitted article using ONLY facts approved in the verification report.

EDITORIAL REQUIREMENTS
- Produce a fully original news article. Target 650-1000 words unless the evidence does not justify it.
- Answer the central news question in the first 80 words.
- Measured, factual, authoritative tone. Do not overstate significance.
- Do not call something a partnership unless verified. Do not claim an outcome (efficiency, liquidity, volume, adoption, speed, engagement) unless evidence demonstrates it.
- Label analysis as analysis. Attribute important facts. Use exact dates and technical names.
- Short paragraphs. Descriptive H2 headings. No manufactured quotes.
- Do not reproduce more than eight consecutive non-essential words from the original.
- Include an Official Sources section with the strongest primary sources.

SEO REQUIREMENTS
- SEO title 45-65 chars, accurate, no clickbait. Meta description 140-160 chars.
- One natural focus keyphrase, five secondary keyphrases, 5-10 single-word tags, 3-5 categories.
- Use the focus topic naturally in the headline, introduction and meta description. Do not keyword-stuff.
- Provide accurate image alt text and an image caption.

Return every field required by the schema, with the article in Markdown, and include the provided disclaimer verbatim at the end of the article body.`;

const AUDIT_PROMPT = `You are an independent crypto-news standards editor.
Audit the article against the supplied verification report. Do not assume a statement is true because it sounds confident.
Score each category 0.0-10.0.
- Factual accuracy: every material claim supported by the report; exact dates/relationships/terms. One unsupported central claim caps at 8.0; one contradicted claim caps at 6.0.
- Source quality: main claim has a primary source; sources support the wording; circular/copied reporting does not count.
- SEO: title matches search intent; intro answers the question; natural entity coverage; descriptive metadata; helpful headings.
- Readability: easy sentences and paragraphs; no filler; technical concepts explained; logical hierarchy.
- Originality: not a sentence-by-sentence rewrite; adds context/analysis; no distinctive source wording.
- Google-quality proxy: helpful, people-first, clearly sourced, trustworthy, non-exaggerated headline, satisfies the reader.
- Technical readiness: metadata, source section, alt text, structured-data fields.
Return category scores with strengths, problems and required fixes, plus unsupported sentences, repetitive sections, and a pass/fail recommendation.`;

const BRIEF_INSTRUCTIONS =
  'From the final article, produce a visual brief for a 2:1 crypto-news cover. Only include entities actually confirmed in the article. Do not invent logos.';

// ---------------------------------------------------------------------------
// Schemas (strict json_schema: every property required, additionalProperties false)
// ---------------------------------------------------------------------------

const VERIFICATION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    overall_verdict: { type: 'string' },
    confirmed_facts: { type: 'array', items: { type: 'string' } },
    excluded_claims: { type: 'array', items: { type: 'string' } },
    important_context: { type: 'array', items: { type: 'string' } },
    publication_risks: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          name: { type: 'string' }, url: { type: 'string' }, is_primary: { type: 'boolean' }
        },
        required: ['name', 'url', 'is_primary']
      }
    }
  },
  required: ['overall_verdict', 'confirmed_facts', 'excluded_claims', 'important_context', 'publication_risks', 'sources']
};

const ARTICLE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    seo_title: { type: 'string' },
    headline: { type: 'string' },
    subheadline: { type: 'string' },
    slug: { type: 'string' },
    meta_description: { type: 'string' },
    focus_keyphrase: { type: 'string' },
    secondary_keyphrases: { type: 'array', items: { type: 'string' } },
    categories: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    article_markdown: { type: 'string' },
    official_sources: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { name: { type: 'string' }, url: { type: 'string' } },
        required: ['name', 'url']
      }
    },
    image_alt_text: { type: 'string' },
    image_caption: { type: 'string' }
  },
  required: ['seo_title', 'headline', 'subheadline', 'slug', 'meta_description', 'focus_keyphrase',
    'secondary_keyphrases', 'categories', 'tags', 'article_markdown', 'official_sources', 'image_alt_text', 'image_caption']
};

function auditDimension() {
  return {
    type: 'object', additionalProperties: false,
    properties: {
      score: { type: 'number' },
      strengths: { type: 'array', items: { type: 'string' } },
      problems: { type: 'array', items: { type: 'string' } },
      required_fixes: { type: 'array', items: { type: 'string' } }
    },
    required: ['score', 'strengths', 'problems', 'required_fixes']
  };
}

const AUDIT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    factual_accuracy: auditDimension(),
    source_quality: auditDimension(),
    seo: auditDimension(),
    readability: auditDimension(),
    originality: auditDimension(),
    google_quality: auditDimension(),
    technical_readiness: auditDimension(),
    unsupported_sentences: { type: 'array', items: { type: 'string' } },
    repetitive_sections: { type: 'array', items: { type: 'string' } },
    final_recommendation: { type: 'string' }
  },
  required: ['factual_accuracy', 'source_quality', 'seo', 'readability', 'originality', 'google_quality',
    'technical_readiness', 'unsupported_sentences', 'repetitive_sections', 'final_recommendation']
};

const BRIEF_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    primary_entities: { type: 'array', items: { type: 'string' } },
    confirmed_visual_concepts: { type: 'array', items: { type: 'string' } },
    background_description: { type: 'string' },
    brand_palette: { type: 'array', items: { type: 'string' } }
  },
  required: ['primary_entities', 'confirmed_visual_concepts', 'background_description', 'brand_palette']
};

// ---------------------------------------------------------------------------
// Deterministic checks (ported from the pipeline method)
// ---------------------------------------------------------------------------

function plainText(markdown) {
  let text = (markdown || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/[#*_>`-]/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function wordCount(markdown) {
  const text = plainText(markdown);
  const words = text.match(/\b[\w'-]+\b/g) || [];
  return words;
}

function articleChecks(article) {
  const failures = [];
  const words = wordCount(article.article_markdown);
  if (article.seo_title.length < ARTICLE_TARGETS.seoTitleMin || article.seo_title.length > ARTICLE_TARGETS.seoTitleMax) {
    failures.push('SEO title is outside the 45-65 character target.');
  }
  if (article.meta_description.length < ARTICLE_TARGETS.metaMin || article.meta_description.length > ARTICLE_TARGETS.metaMax) {
    failures.push('Meta description is outside the 140-160 character target.');
  }
  if (words.length < ARTICLE_TARGETS.minWords || words.length > ARTICLE_TARGETS.maxWords) {
    failures.push(`Article is outside the ${ARTICLE_TARGETS.minWords}-${ARTICLE_TARGETS.maxWords} word target (got ${words.length}).`);
  }
  const first100 = words.slice(0, 100).join(' ').toLowerCase();
  const key = (article.focus_keyphrase || '').toLowerCase();
  if (key && !article.seo_title.toLowerCase().includes(key)) failures.push('Focus keyphrase absent from the SEO title.');
  if (key && !article.meta_description.toLowerCase().includes(key)) failures.push('Focus keyphrase absent from the meta description.');
  if (key && !first100.includes(key)) failures.push('Focus keyphrase absent from the first 100 words.');
  if (!article.official_sources || article.official_sources.length < 2) failures.push('Fewer than two authoritative sources.');
  return failures;
}

function hasSharedNgram(textA, textB, length = 12) {
  const a = plainText(textA).toLowerCase().split(/\s+/);
  const b = plainText(textB).toLowerCase().split(/\s+/);
  if (a.length < length || b.length < length) return false;
  const bSet = new Set();
  for (let i = 0; i <= b.length - length; i++) bSet.add(b.slice(i, i + length).join(' '));
  for (let i = 0; i <= a.length - length; i++) {
    if (bSet.has(a.slice(i, i + length).join(' '))) return true;
  }
  return false;
}

function calculateScore(audit) {
  const s =
    audit.factual_accuracy.score * 0.25 +
    audit.source_quality.score * 0.15 +
    audit.seo.score * 0.15 +
    audit.readability.score * 0.15 +
    audit.originality.score * 0.10 +
    audit.google_quality.score * 0.15 +
    audit.technical_readiness.score * 0.05;
  return Math.round(s * 100) / 100;
}

function passesGate(audit, overall, mechanicalFailures) {
  return (
    overall >= QUALITY_GATE.overall &&
    audit.factual_accuracy.score >= QUALITY_GATE.factual &&
    audit.source_quality.score >= QUALITY_GATE.source &&
    audit.seo.score >= QUALITY_GATE.seo &&
    audit.readability.score >= QUALITY_GATE.readability &&
    audit.google_quality.score >= QUALITY_GATE.google &&
    audit.unsupported_sentences.length === 0 &&
    mechanicalFailures.length === 0
  );
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

async function runFactCheck(originalArticle) {
  const r = await callResponses({
    model: MODELS.factCheck,
    instructions: FACT_CHECK_PROMPT,
    input: originalArticle,
    tools: [{ type: 'web_search' }],
    effort: 'low',
    maxOutputTokens: 8000
  });
  return r.text;
}

async function normalizeResearch(researchText) {
  const r = await callResponses({
    model: MODELS.normalize,
    instructions: NORMALIZE_INSTRUCTIONS,
    input: researchText,
    schema: VERIFICATION_SCHEMA,
    schemaName: 'verification_report',
    maxOutputTokens: 4000
  });
  return r.parsed;
}

async function runRewrite(originalArticle, verification) {
  const input = `ORIGINAL ARTICLE:\n${originalArticle}\n\nVERIFICATION REPORT:\n${JSON.stringify(verification, null, 2)}\n\nREQUIRED DISCLAIMER:\n${GENFINITY_DISCLAIMER}`;
  const r = await callResponses({
    model: MODELS.rewrite,
    instructions: REWRITE_PROMPT,
    input,
    schema: ARTICLE_SCHEMA,
    schemaName: 'article_package',
    effort: 'medium',
    maxOutputTokens: 10000
  });
  return r.parsed;
}

async function runAudit(article, verification) {
  const input = `ARTICLE:\n${JSON.stringify(article, null, 2)}\n\nVERIFICATION REPORT:\n${JSON.stringify(verification, null, 2)}`;
  const r = await callResponses({
    model: MODELS.audit,
    instructions: AUDIT_PROMPT,
    input,
    schema: AUDIT_SCHEMA,
    schemaName: 'audit_report',
    maxOutputTokens: 5000
  });
  return r.parsed;
}

async function runRevision(article, verification, audit, mechanicalFailures) {
  const input = `Revise this article to fix the problems below, keeping ONLY facts in the verification report.\n\nARTICLE:\n${JSON.stringify(article, null, 2)}\n\nAUDIT PROBLEMS:\n${JSON.stringify({ required: audit, mechanical: mechanicalFailures }, null, 2)}\n\nVERIFICATION REPORT:\n${JSON.stringify(verification, null, 2)}\n\nREQUIRED DISCLAIMER:\n${GENFINITY_DISCLAIMER}`;
  const r = await callResponses({
    model: MODELS.rewrite,
    instructions: REWRITE_PROMPT,
    input,
    schema: ARTICLE_SCHEMA,
    schemaName: 'article_package',
    effort: 'medium',
    maxOutputTokens: 10000
  });
  return r.parsed;
}

async function runVisualBrief(article) {
  const r = await callResponses({
    model: MODELS.brief,
    instructions: BRIEF_INSTRUCTIONS,
    input: `FINAL ARTICLE:\n${article.article_markdown}\n\nHEADLINE: ${article.headline}`,
    schema: BRIEF_SCHEMA,
    schemaName: 'visual_brief',
    maxOutputTokens: 1500
  });
  return r.parsed;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Run the full pipeline.
 * @param {object} source { title, content, url }
 * @param {(step:string, label:string, pct:number)=>void} [onProgress]
 * @returns {Promise<object>} full result
 */
async function runPipeline(source, onProgress = () => {}) {
  const originalArticle = `TITLE: ${source.title || ''}\n\n${source.content || ''}\n\nSOURCE URL: ${source.url || ''}`;

  onProgress('fact_check', 'Fact-checking with web research', 10);
  const research = await runFactCheck(originalArticle);

  onProgress('normalize', 'Structuring verified facts', 30);
  const verification = await normalizeResearch(research);

  onProgress('rewrite', 'Writing the article from approved facts', 45);
  let article = await runRewrite(originalArticle, verification);

  let audit = null;
  let overall = 0;
  let mechanicalFailures = [];
  let requiresHumanReview = false;

  for (let attempt = 0; attempt < 3; attempt++) {
    onProgress('audit', `Auditing (pass ${attempt + 1})`, 60 + attempt * 8);
    audit = await runAudit(article, verification);
    overall = calculateScore(audit);
    mechanicalFailures = articleChecks(article);
    if (hasSharedNgram(article.article_markdown, source.content || '')) {
      mechanicalFailures.push('Shares a 12-word sequence with the original draft.');
    }
    if (passesGate(audit, overall, mechanicalFailures)) break;
    if (attempt >= 2) { requiresHumanReview = true; break; }
    onProgress('revise', `Revising to pass quality gate (attempt ${attempt + 1})`, 65 + attempt * 8);
    article = await runRevision(article, verification, audit, mechanicalFailures);
  }

  // Human-review flags from the pipeline method
  const risks = (verification.publication_risks || []).join(' ').toLowerCase();
  if (audit.factual_accuracy.score < QUALITY_GATE.factual) requiresHumanReview = true;
  if (/regulat|litigat|lawsuit|criminal|sec /.test(risks)) requiresHumanReview = true;

  onProgress('brief', 'Preparing the cover brief', 88);
  const visualBrief = await runVisualBrief(article);

  onProgress('done', 'Complete', 100);

  return {
    article,
    verification,
    audit,
    overallScore: overall,
    mechanicalFailures,
    requiresHumanReview,
    visualBrief,
    sources: verification.sources || [],
    disclaimer: GENFINITY_DISCLAIMER
  };
}

// ---------------------------------------------------------------------------
// Visual subject: one short concrete phrase to fill the style's 3D-element slot
// ---------------------------------------------------------------------------

const SUBJECT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { subject: { type: 'string' } },
  required: ['subject']
};

const SUBJECT_INSTRUCTIONS =
  'From the crypto news article, return ONE very short subject (2 to 4 words) naming a PHYSICAL OBJECT that can be sculpted in glass for the small floating 3D elements on a cover. It MUST be a tangible object (vault, chart, padlock, shield, gears, bridge, rings, nodes, cubes, key, scales, rocket), never an abstract concept or activity (do NOT return things like "institutional staking" or "custody agreement"). Depict what the NEWS is about, NOT the cryptocurrency itself, since its logo is already shown; do not name any coin or token. At most one adjective. Map the theme to an object: staking or custody -> "glass vault"; security -> "glass padlock"; ETF inflows or price -> "rising glass chart"; partnership -> "interlocking glass rings"; upgrade -> "glass gears"; scaling -> "glass bridge". Keep it simple; the cover cannot handle a busy subject.';

/**
 * Derive a single short 3D-element subject phrase from an article.
 * Best-effort: returns null on any failure so the caller falls back to the
 * style's own default subject.
 * @returns {Promise<string|null>}
 */
async function deriveVisualSubject(title, content = '') {
  try {
    // No reasoning effort here (trivial extraction) and enough token headroom;
    // a reasoning model with too small a budget spends it all on reasoning and
    // returns an empty message.
    const r = await callResponses({
      model: MODELS.brief,
      instructions: SUBJECT_INSTRUCTIONS,
      input: `TITLE: ${title || ''}\n\n${(content || '').slice(0, 600)}`,
      schema: SUBJECT_SCHEMA,
      schemaName: 'visual_subject',
      maxOutputTokens: 300
    });
    let s = ((r.parsed && r.parsed.subject) || '').trim().replace(/["'.]+$/, '').trim();
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length > 6) s = words.slice(0, 6).join(' '); // hard cap: keep it simple
    return s || null;
  } catch (e) {
    logger.warn(`deriveVisualSubject failed: ${e.message}`);
    return null;
  }
}

module.exports = {
  runPipeline,
  deriveVisualSubject,
  // exported for testing
  articleChecks,
  hasSharedNgram,
  calculateScore,
  passesGate,
  MODELS,
  QUALITY_GATE
};
