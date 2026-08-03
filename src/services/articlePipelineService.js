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
  brief: 'gpt-5.4-mini',
  artDirect: 'gpt-5.5' // strong model for the cover composition (the creative bottleneck)
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

// Fetch the full article text from the source URL so the pipeline reasons over
// the complete, correctly dated story instead of a short feed excerpt. Best
// effort: returns '' on any failure, and the pipeline falls back to the excerpt.
async function fetchArticleText(url) {
  if (!url || !/^https?:\/\//.test(url)) return '';
  try {
    const resp = await axios.get(url, {
      timeout: 20000,
      maxContentLength: 6 * 1024 * 1024,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GenfinityBot/1.0; +https://genfinity.io)' },
      validateStatus: s => s >= 200 && s < 400
    });
    let html = typeof resp.data === 'string' ? resp.data : '';
    if (!html) return '';
    html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const bodyMatch = html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<main[\s\S]*?<\/main>/i);
    const chunk = bodyMatch ? bodyMatch[0] : html;
    const text = chunk.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, 9000);
  } catch (e) {
    logger.warn(`fetchArticleText failed for ${url}: ${e.message}`);
    return '';
  }
}

// Fetch existing Genfinity articles related to the finished piece, via the
// public WordPress REST API, so the pipeline can add real internal links (which
// render as embedded cards on the site). Best effort: returns [] on any failure.
async function fetchRelatedGenfinityPosts(terms, limit = 5) {
  const q = encodeURIComponent(String(terms || '').trim().slice(0, 90));
  if (!q) return [];
  try {
    const resp = await axios.get(
      `https://genfinity.io/wp-json/wp/v2/posts?search=${q}&per_page=${limit}&_fields=title,link,excerpt`,
      { timeout: 15000, headers: { 'User-Agent': 'GenfinityBot/1.0' }, validateStatus: s => s >= 200 && s < 400 }
    );
    const arr = Array.isArray(resp.data) ? resp.data : [];
    const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return arr
      .map(p => ({ title: strip(p.title && p.title.rendered), url: p.link, excerpt: strip(p.excerpt && p.excerpt.rendered).slice(0, 200) }))
      .filter(p => p.url && p.title);
  } catch (e) {
    logger.warn(`fetchRelatedGenfinityPosts failed: ${e.message}`);
    return [];
  }
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

TIMELINESS (critical): This is CURRENT news. Anchor strictly to the reporting period, quarter, and dates stated in the article body and the TODAY date provided. Verify the SPECIFIC current event. Do NOT substitute or conflate figures from an earlier quarter or year, even if older figures rank higher in search results. If the article is about a recent event, your verification and the eventual article must be about THAT recent event, not a historical one.

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
- CRITICAL: every factual sentence must be supported by the verification report. If a claim cannot be supported, REMOVE it entirely or rewrite it as clearly labeled analysis. Never leave an unverified factual claim in the article. A shorter, fully verified article is better than a longer one with unverifiable claims. Do not tell the reader to verify anything; resolve it yourself by cutting or attributing.
- Short paragraphs. Descriptive H2 headings. No manufactured quotes.
- Do not reproduce more than eight consecutive non-essential words from the original.
- Include an Official Sources section with the strongest primary sources.

SEO REQUIREMENTS
- SEO title 45-65 chars: a strong, present-tense, keyword-led CURRENT-news headline that leads with the primary entity and the news. No clickbait, and no backward-looking or corrective phrasings like "was reported" or a past year unless the story is genuinely a correction. Reflect the current event. Meta description 140-160 chars.
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

const LINK_INSTRUCTIONS = `You add internal links to a finished Genfinity news article. You are given the article Markdown and a list of EXISTING Genfinity articles (title, URL, excerpt).

Insert links that genuinely help the reader:
- Add up to 4 INLINE anchor-text links inside existing sentences: wrap a short, relevant phrase that is ALREADY in the sentence in a Markdown link to the most on-topic Genfinity URL (for example, link a product, company, or concept name to the Genfinity article about it).
- Additionally you MAY place at MOST ONE of the most relevant URLs on ITS OWN line as a bare URL (nothing else on that line, blank line above and below), between two paragraphs where it fits the flow, so the site renders it as an embedded card.

RULES:
- Use ONLY the provided URLs, exactly as given. Never invent, guess, or modify a URL. Link each URL at most once.
- Only link where the target is genuinely relevant to the surrounding sentence. If none of the provided articles are relevant, return the article completely unchanged.
- Do NOT change any wording, facts, figures, headings, order, or the disclaimer. ONLY add links. Keep the disclaimer verbatim at the very end.
- Return the FULL article Markdown with the links added.`;

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

const LINK_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    article_markdown: { type: 'string' },
    linked_urls: { type: 'array', items: { type: 'string' } }
  },
  required: ['article_markdown', 'linked_urls']
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
    effort: 'high',
    maxOutputTokens: 12000
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
  const unsupported = audit.unsupported_sentences || [];
  const fixes = {
    factual: audit.factual_accuracy.required_fixes,
    source: audit.source_quality.required_fixes,
    seo: audit.seo.required_fixes,
    readability: audit.readability.required_fixes
  };
  const input = `Revise this article. Keep ONLY facts in the verification report.

MANDATORY: the following sentences are unsupported. REMOVE each one, or rewrite it as clearly labeled analysis, so that NONE of them remain as factual claims. Resolve every one yourself by cutting or attributing. Do not ask the reader to verify anything.
${unsupported.length ? unsupported.map((u, i) => `${i + 1}. ${u}`).join('\n') : '(none listed)'}

Also apply these required fixes and fix these mechanical issues:
${JSON.stringify({ required_fixes: fixes, mechanical: mechanicalFailures }, null, 2)}

ARTICLE:
${JSON.stringify(article, null, 2)}

VERIFICATION REPORT:
${JSON.stringify(verification, null, 2)}

REQUIRED DISCLAIMER:
${GENFINITY_DISCLAIMER}`;
  const r = await callResponses({
    model: MODELS.rewrite,
    instructions: REWRITE_PROMPT,
    input,
    schema: ARTICLE_SCHEMA,
    schemaName: 'article_package',
    effort: 'high',
    maxOutputTokens: 12000
  });
  return r.parsed;
}

/**
 * Add internal Genfinity links to the finished article. Returns { markdown,
 * links }. Best effort: on any failure it returns the original markdown so the
 * pipeline is never blocked by the linking step.
 */
async function runInternalLinking(article) {
  const original = article.article_markdown || '';
  try {
    const terms = [article.focus_keyphrase, ...(article.secondary_keyphrases || []).slice(0, 2)]
      .filter(Boolean).join(' ');
    let related = await fetchRelatedGenfinityPosts(terms, 6);
    // Drop any post that is essentially this same story (avoid a self-link) and
    // cap how many we hand the model.
    const headline = (article.headline || '').toLowerCase();
    related = related
      .filter(p => {
        const t = p.title.toLowerCase();
        return t && t !== headline && !(headline && (t.includes(headline) || headline.includes(t)));
      })
      .slice(0, 5);
    if (!related.length) return { markdown: original, links: [] };

    const input = `ARTICLE MARKDOWN:\n${original}\n\nEXISTING GENFINITY ARTICLES (use only these URLs):\n${related.map((p, i) => `${i + 1}. ${p.title}\n   URL: ${p.url}\n   ${p.excerpt}`).join('\n')}`;
    const r = await callResponses({
      model: MODELS.rewrite, // strong model: precise, no wording changes
      instructions: LINK_INSTRUCTIONS,
      input,
      schema: LINK_SCHEMA,
      schemaName: 'linked_article',
      effort: 'low',
      maxOutputTokens: 9000
    });
    const md = r.parsed && r.parsed.article_markdown;
    // Only accept the result if it kept the article intact (no big length swing)
    // and actually used real provided URLs.
    const provided = new Set(related.map(p => p.url));
    const used = (r.parsed && r.parsed.linked_urls || []).filter(u => provided.has(u));
    const lenOk = md && Math.abs(md.length - original.length) < original.length * 0.5;
    const disclaimerOk = md && md.includes('Disclaimer:');
    if (md && lenOk && disclaimerOk && used.length) {
      return { markdown: md, links: used };
    }
    return { markdown: original, links: [] };
  } catch (e) {
    logger.warn(`runInternalLinking failed: ${e.message}`);
    return { markdown: original, links: [] };
  }
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
  onProgress('fetch', 'Fetching the full source article', 5);
  const fullText = await fetchArticleText(source.url);
  const body = (fullText && fullText.length > (source.content || '').length) ? fullText : (source.content || '');
  const today = new Date().toISOString().slice(0, 10);
  const originalArticle = `TODAY IS ${today}. This is a CURRENT news item; treat it as current, not historical.
TITLE: ${source.title || ''}
SOURCE URL: ${source.url || ''}

ARTICLE BODY:
${body}`;

  onProgress('fact_check', 'Fact-checking with web research', 12);
  const research = await runFactCheck(originalArticle);

  onProgress('normalize', 'Structuring verified facts', 30);
  const verification = await normalizeResearch(research);

  onProgress('rewrite', 'Writing the article from approved facts', 45);
  let article = await runRewrite(originalArticle, verification);

  let audit = null;
  let overall = 0;
  let mechanicalFailures = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    onProgress('audit', `Auditing (pass ${attempt + 1})`, 60 + attempt * 8);
    audit = await runAudit(article, verification);
    overall = calculateScore(audit);
    mechanicalFailures = articleChecks(article);
    if (hasSharedNgram(article.article_markdown, source.content || '')) {
      mechanicalFailures.push('Shares a 12-word sequence with the original draft.');
    }
    if (passesGate(audit, overall, mechanicalFailures)) break;
    if (attempt >= 2) break; // stop revising; reasons computed below
    onProgress('revise', `Cleaning up unverified claims (pass ${attempt + 1})`, 65 + attempt * 8);
    article = await runRevision(article, verification, audit, mechanicalFailures);
  }

  // Reason-driven human-review flag. The pipeline already removes what it can
  // (unsupported claims), so this flags only genuine, unresolved factual or
  // legal issues and states exactly why. Style-only shortfalls (SEO/readability)
  // do NOT flag, since they need editing, not fact-research.
  const reviewReasons = [];
  if (audit.unsupported_sentences && audit.unsupported_sentences.length > 0) {
    reviewReasons.push(`${audit.unsupported_sentences.length} claim(s) could not be verified`);
  }
  if (audit.factual_accuracy.score < QUALITY_GATE.factual) {
    reviewReasons.push(`factual accuracy ${audit.factual_accuracy.score} below ${QUALITY_GATE.factual}`);
  }
  const risks = (verification.publication_risks || []).join(' ').toLowerCase();
  if (/litigat|lawsuit|criminal|indict|fraud|sanction/.test(risks)) {
    reviewReasons.push('involves litigation, criminal, or sanctions matters');
  }
  const requiresHumanReview = reviewReasons.length > 0;

  onProgress('linking', 'Adding internal Genfinity links', 84);
  let internalLinks = [];
  try {
    const linked = await runInternalLinking(article);
    article.article_markdown = linked.markdown;
    internalLinks = linked.links;
  } catch (e) { /* keep the unlinked article */ }

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
    reviewReasons,
    visualBrief,
    internalLinks,
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

// ---------------------------------------------------------------------------
// Cover concept: a bespoke, per-article art-direction pass for the Article
// Studio covers. Unlike deriveVisualSubject (one glass object), this produces a
// full investigative-collage concept AND short factual text clippings pulled
// truthfully from the article, to be rendered onto the cover as torn-paper
// snippets (like the CleanCore / DOGE example). This is Article-Studio-only; the
// Cover Generator tab never runs it and stays textless.
// ---------------------------------------------------------------------------

const CONCEPT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    concept: { type: 'string' },
    focal_subject: { type: 'string' },
    supporting_subjects: { type: 'array', items: { type: 'string' } },
    logo_treatment: { type: 'string' },
    text_elements: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { text: { type: 'string' }, emphasis: { type: 'boolean' } },
        required: ['text', 'emphasis']
      }
    },
    accent1: { type: 'string' },
    accent2: { type: 'string' }
  },
  required: ['concept', 'focal_subject', 'supporting_subjects', 'logo_treatment', 'text_elements', 'accent1', 'accent2']
};

const CONCEPT_INSTRUCTIONS = `You are the art director for a crypto and finance news publication. Design ONE bold editorial collage cover for the specific article provided. The strongest covers use a SINGLE striking, often surreal, visual metaphor that captures the whole story in one clean image, with one clear hero and generous negative space. Think: a whale sealed inside a glass jar, a money-printing press spewing certificates, a Shiba Inu behind bars made of stock certificates, a coin leaning against a crumbling wall, a token as the hub of a ship's wheel. ONE strong idea, NOT a cluttered board of many objects.

Return, as JSON:
- concept: one vivid sentence describing the SINGLE dominant visual metaphor for THIS story. It must read as one clean, high-impact scene with a clear hero and lots of breathing room, never a busy pile of items.
- focal_subject: the ONE hero of that metaphor, as a bold photographic cutout (an animal, person, object, or building). 2 to 5 words.
- supporting_subjects: only 1 to 2 small supporting cutouts that reinforce the SAME single scene (return an empty list if the hero alone tells it). Concrete physical objects, each 1 to 4 words. Fewer is better; never list props just to fill space.
- logo_treatment: one short phrase describing a CREATIVE way the crypto logo itself is used to tell THIS story, not just a flat stamp, and always as a PROMINENT, clearly visible part of the hero at substantial size (never a small background detail). Examples: "minted large on a weathered coin leaning against a crumbling wall", "gripped and squeezed in a fist", "cracked like the surface it sits on", "the hub of a ship's wheel", "spray-stencilled on a vault door", "sealed inside a glass jar". Pick one that fits the story. 3 to 12 words.
- text_elements: only 3 to 5 SHORT factual snippets pulled DIRECTLY and TRUTHFULLY from the article, each 1 to 6 words, the most striking facts only. Use real figures, names, dates, percentages, dollar amounts, share counts, and short key phrases that ACTUALLY APPEAR in the article text. Set emphasis:true for the 1 to 2 most important. Spell each exactly. Fewer, stronger clippings beat many small ones.
- accent1, accent2: two BOLD, saturated, high-impact hex colors (for example lime "#c6ff00", hot magenta "#ff2d9b", electric cyan "#00e5ff", electric blue "#2979ff", safety orange "#ff7a00"). Do NOT choose muted, muddy, pastel, beige, tan, brown, grey, or earth-tone colors. Everything else in the art stays black and white.

AESTHETIC CONSTRAINT (critical): the scene must work as a FLAT, gritty, black-and-white PHOTOGRAPHIC torn-paper collage with halftone texture. Use ONLY physical, tangible, real-world subjects (animals, people, buildings, machines, printing presses, printed documents, coins, hands, vaults, objects). Do NOT propose glowing, neon, holographic, wireframe, circuit-board, "data stream", flowing-code, sci-fi, or 3D-digital imagery, and the logo must NEVER glow — it is a flat printed mark or a matte minted coin. Translate abstract or digital ideas into a concrete physical metaphor (for example, "onchain data feeds" becomes a printing press stamping paper ledgers, not glowing data).

TRUTH RULES (critical): every text_element must be verifiable from the article text provided. If you are not certain a figure or name appears in the article, do NOT include it. Never invent, round, or estimate a number. No hashtags, no editorial labels that are not in the story, no author or publication names. Keep each snippet short enough to read on a small torn scrap.`;

/**
 * Derive a bespoke cover concept + truthful text clippings from an article.
 * @param {object} a { title, body, facts? } facts is an optional array of
 *        already-verified confirmed facts (from the rewrite verification report)
 *        to anchor truthfulness; for manual entries only title+body are used.
 * @returns {Promise<object|null>} concept object or null on failure
 */
async function deriveCoverConcept(a = {}) {
  try {
    const factLines = Array.isArray(a.facts) && a.facts.length
      ? `\n\nCONFIRMED FACTS (safe to quote figures/names from):\n- ${a.facts.slice(0, 25).join('\n- ')}`
      : '';
    const input = `TITLE: ${a.title || ''}\n\nARTICLE:\n${(a.body || '').slice(0, 7000)}${factLines}`;
    const r = await callResponses({
      model: MODELS.brief,
      instructions: CONCEPT_INSTRUCTIONS,
      input,
      schema: CONCEPT_SCHEMA,
      schemaName: 'cover_concept',
      maxOutputTokens: 1800
    });
    const c = r.parsed;
    if (!c) return null;
    // Sanitize: trim, cap counts, drop empties, keep text snippets short.
    const clip = (s, n) => String(s || '').trim().split(/\s+/).slice(0, n).join(' ');
    c.focal_subject = clip(c.focal_subject, 6);
    c.logo_treatment = clip(c.logo_treatment, 14);
    // Keep the element count low so covers stay clean, not cluttered.
    c.supporting_subjects = (c.supporting_subjects || [])
      .map(s => clip(s, 4)).filter(Boolean).slice(0, 2);
    c.text_elements = (c.text_elements || [])
      .map(t => ({ text: clip(t && t.text, 6), emphasis: !!(t && t.emphasis) }))
      .filter(t => t.text).slice(0, 5);
    const hex = v => (typeof v === 'string' && /^#?[0-9a-f]{3,8}$/i.test(v.trim()))
      ? (v.trim().startsWith('#') ? v.trim() : `#${v.trim()}`) : null;
    c.accent1 = hex(c.accent1) || '#c6ff00';
    c.accent2 = hex(c.accent2) || '#ff3b30';
    return c;
  } catch (e) {
    logger.warn(`deriveCoverConcept failed: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Visual concept from a HEADLINE only (Cover Generator collage). No article
// body, no text clippings; just a single interacting-metaphor scene so the
// Cover Generator collage tells a story instead of placing cutouts side by side.
// ---------------------------------------------------------------------------

const VISUAL_CONCEPT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { concept: { type: 'string' }, logo_treatment: { type: 'string' } },
  required: ['concept', 'logo_treatment']
};

const VISUAL_CONCEPT_INSTRUCTIONS = `You are the art director for a crypto and finance publication, designing ONE bold torn-paper collage cover from a news HEADLINE (you do not have the article body). The best covers tell the story through a SINGLE striking, often surreal, visual metaphor where the elements INTERACT, not a set of cutouts placed side by side. Examples of interaction: a whale sealed inside a glass jar, a bull smashing through a bank-vault door, a gear-shaped logo powering a money-printing press, a coin leaning against a crumbling wall, a hand squeezing coins until they crack.

Return JSON:
- concept: one vivid sentence describing the single dominant scene for THIS headline and HOW the elements physically interact and relate to tell the story, with one clear hero and generous negative space. If the user named specific subjects, weave them into the SAME interacting scene rather than listing them separately.
- logo_treatment: one short phrase for how the crypto logo participates in the scene as a PROMINENT, clearly visible part of the hero at substantial size, never a small background detail (for example "the gear the bull turns", "minted large on the coin against the wall", "the vault's lock").

Keep it to ONE strong idea. Never describe a busy board of many separate items. No text or lettering in the scene.

AESTHETIC CONSTRAINT (critical): the scene must work as a FLAT, gritty, black-and-white PHOTOGRAPHIC torn-paper collage with halftone texture. Use ONLY physical, tangible, real-world subjects (animals, people, buildings, machines, presses, coins, hands, vaults, objects). Do NOT propose glowing, neon, holographic, wireframe, circuit-board, "data stream", flowing-code, sci-fi, or 3D-digital imagery, and the logo must NEVER glow — it is a flat printed mark or a matte minted coin. Translate any abstract or digital idea into a concrete physical metaphor.`;

/**
 * Derive a single interacting-metaphor concept from a headline (+ optional
 * user-picked subjects and logo). Returns { concept, logo_treatment } or null.
 */
async function deriveVisualConcept(a = {}) {
  try {
    const subj = (a.subjects && String(a.subjects).trim()) ? `\nUser-picked subjects to weave into the same scene: ${a.subjects}` : '';
    const logo = a.logoSymbol ? `\nLogo/brand present in the scene: ${a.logoSymbol}` : '';
    const r = await callResponses({
      model: MODELS.brief,
      instructions: VISUAL_CONCEPT_INSTRUCTIONS,
      input: `HEADLINE: ${a.title || ''}${subj}${logo}`,
      schema: VISUAL_CONCEPT_SCHEMA,
      schemaName: 'visual_concept',
      maxOutputTokens: 700
    });
    const c = r.parsed;
    if (!c) return null;
    const clip = (s, n) => String(s || '').trim().split(/\s+/).slice(0, n).join(' ');
    c.concept = String(c.concept || '').trim().slice(0, 400);
    c.logo_treatment = clip(c.logo_treatment, 16);
    return c.concept ? c : null;
  } catch (e) {
    logger.warn(`deriveVisualConcept failed: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// SEO metadata from a pasted article (manual Article Studio entry). Fills the
// SEO fields WITHOUT rewriting the body, so a manually entered article gets the
// same metadata treatment as a rewrite.
// ---------------------------------------------------------------------------

const SEO_META_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    seo_title: { type: 'string' },
    meta_description: { type: 'string' },
    focus_keyphrase: { type: 'string' },
    secondary_keyphrases: { type: 'array', items: { type: 'string' } },
    categories: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    slug: { type: 'string' },
    image_alt_text: { type: 'string' },
    image_caption: { type: 'string' }
  },
  required: ['seo_title', 'meta_description', 'focus_keyphrase', 'secondary_keyphrases',
    'categories', 'tags', 'slug', 'image_alt_text', 'image_caption']
};

const SEO_META_INSTRUCTIONS = `You are an SEO editor. From the given article title and body, produce accurate WordPress SEO metadata that reflects the article's actual content. Do NOT rewrite or summarize the body; only produce metadata.
- seo_title: 45 to 65 characters, present-tense, keyword-led, leading with the main entity and topic.
- meta_description: 140 to 160 characters summarizing the article accurately.
- focus_keyphrase: one natural focus keyphrase for the article.
- secondary_keyphrases: five related keyphrases.
- categories: 3 to 5 relevant categories.
- tags: 5 to 10 short or long-tail tags.
- slug: a lowercase hyphenated URL slug.
- image_alt_text and image_caption: accurate to the article's topic.
Base everything ONLY on the provided article; do not invent facts, numbers, or sources.`;

/**
 * Derive SEO metadata for a pasted article. Returns the metadata object, or null.
 */
async function deriveSeoMetadata(a = {}) {
  try {
    const r = await callResponses({
      model: MODELS.brief,
      instructions: SEO_META_INSTRUCTIONS,
      input: `TITLE: ${a.title || ''}\n\nARTICLE:\n${(a.body || '').slice(0, 7000)}`,
      schema: SEO_META_SCHEMA,
      schemaName: 'seo_metadata',
      maxOutputTokens: 1400
    });
    return r.parsed || null;
  } catch (e) {
    logger.warn(`deriveSeoMetadata failed: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// ART DIRECTOR (the "composition skill"). A strong model reads the story,
// chooses ONE interacting metaphor, DESIGNS an explicit composition, and writes
// a single coherent image_prompt in the house style. Used by BOTH the Article
// Studio news collage (withText) and the Cover Generator collage (title only).
// ---------------------------------------------------------------------------

const ART_DIRECT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    image_prompt: { type: 'string' },
    focal_subject: { type: 'string' },
    supporting_subjects: { type: 'array', items: { type: 'string' } },
    logo_treatment: { type: 'string' },
    text_elements: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { text: { type: 'string' }, emphasis: { type: 'boolean' } },
        required: ['text', 'emphasis']
      }
    }
  },
  required: ['image_prompt', 'focal_subject', 'supporting_subjects', 'logo_treatment', 'text_elements']
};

function buildArtDirectSystem(withText) {
  const textBlock = withText
    ? `- FACTUAL TEXT CLIPPINGS: only 2 to 4 total (FEWER is better — a clean cover with minimal text reads best; do not overload with many small subtexts). Make ONE the dominant HEADLINE, dramatically LARGER and bolder than the rest; the other 1 to 3 are small supporting clips. CAPITALIZE the first letter of each phrase (sentence case) — do NOT set phrases in all-lowercase. Use MOSTLY bold SANS-SERIF type (heavy, condensed, black/extra-bold weights, like a modern magazine or protest poster), with only an OCCASIONAL serif or typewriter accent — never serif-dominant, and never a uniform stack of same-size same-font clips. Vary the size and weight so there is a clear headline and clearly smaller labels; on a data clip pair a big bold figure with a smaller label (title-and-subtext), e.g. "Roughly $18B" large over "Robinhood volume" small. On the 1 to 2 most important figures add an accent-colour marker UNDERLINE, a solid HIGHLIGHT BLOCK, or a hand-drawn CIRCLE. Render the clips on clean WHITE or light-grey paper — NEVER beige, tan, cream, or manila — each showing ONLY its exact phrase on otherwise-BLANK paper (no body text, no gibberish, no extra words). Spell every phrase EXACTLY; no other text anywhere in the image.`
    : `- NO text at all anywhere in the image. Any seal or stamp shows emblem imagery only (eagle, crest, rings), never lettering.`;
  const textZone = withText ? 'where the grouped text-clipping zone sits,' : '';
  const textElementsNote = withText
    ? '2 to 4 short truthful snippets that ACTUALLY appear in the article (real figures, names, dates), FEWER is better; capitalize the first letter of each; mark the single most striking with emphasis:true; spell exactly'
    : 'return an EMPTY list';

  return `You are the art director for a crypto and finance publication. Design ONE striking cover as a CINEMATIC photo collage in a bold editorial house style, and write a complete image prompt a text-to-image model can render.

THE HOUSE STYLE (study it, every rule matters):
- ONE bold, often surreal, PHYSICAL metaphor built around a single dominant HERO SUBJECT that the whole cover is about: a character, animal, person, object, coin, or machine placed in one symbolic situation. This can be an ACTION (a hand squeezing coins until they crack; a printing press stamping paper ledgers) OR a striking STATIC scene (a coin as the hub of a ship's wheel; a whale sealed inside a glass jar; a coin leaning against a crumbling wall; a Shiba Inu behind bars; a lone weathered portrait). The point is ONE clear hero the whole cover is about, NEVER a board of separate cut-outs placed side by side.
- VARY THE HERO TYPE AND RENDERING STYLE across covers — do NOT always use the same photographic object. Choose whichever best fits THIS story: (1) a PHOTOGRAPHIC realistic subject (an animal, a person, a machine, a building) in a surreal situation; (2) a WEATHERED, textured symbolic OBJECT (a coin, a vault, a wheel, a book) with real depth; (3) a metallic or crystal RENDER of a coin or emblem; (4) a bold FLAT high-contrast GRAPHIC or heavy-HALFTONE icon (a cracked circle, a stark symbol) that is graphic, not photographic; (5) a black SILHOUETTE with graphic or halftone imagery inside it (a head in profile with a chart inside). Types 1 to 3 are DIMENSIONAL with dramatic directional lighting, strong shadows and rich texture (weathered metal, cracked stone, glass, fur, skin); types 4 to 5 are bold, stark, high-contrast flat graphics. Whatever the type, make it striking and dramatic — NEVER a weak, flat, evenly-lit generic illustration, and absolutely NO neon, glow, holographic, wireframe, circuit, flowing-code, data-stream, or digital sci-fi look.
- DYNAMIC composition: dramatic angles, strong diagonal energy, foreground-to-background depth layering, high contrast and drama. FILL the frame with rich, layered texture that all serves this ONE scene — full and dramatic, never sparse-and-empty, and never a jumble of unrelated cut-outs.
- VARY THE MATERIALS every time. Choose collage papers, textures, and surfaces that FIT THIS specific story, and do NOT default to plain torn white note-paper. Draw from a WIDE palette and use a DIFFERENT mix than a typical cover: aged newspaper, engraved stock certificates, ledger and graph paper, index cards, manila folders, currency and banknote textures, kraft paper, blueprints, old maps, film strips, cardboard, halftone magazine scraps, stamped legal filings, photocopied documents, painted cardboard. Pick materials the story evokes.
- VARY THE OVERALL TREATMENT too. Torn-paper cut-outs are OPTIONAL and used in VARYING amounts — do NOT make every cover a torn-white-paper collage. Some covers should be a FULL CINEMATIC SCENE (like a dramatic movie poster: the coin against a crumbling wall, the money printer, the whale in the jar) with only subtle torn edges; others a heavier torn-paper collage. Decide the treatment fresh for THIS story.
- KEEP THE BACKGROUND CLEAN. The area behind and around the hero is mostly solid BLACK (or a single bold colour field) with generous negative space. Do NOT wallpaper the background with scattered paper scraps, stock certificates, ledgers, forms, receipts, or document fragments. Use paper SPARINGLY and purposefully — the text clippings and at most one or two intentional accent pieces — never as background filler. The hero and the negative space must breathe.
- The crypto logo appears as the COMPLETE lockup — BOTH the icon AND the full wordmark together, exactly as in the provided logo image — PROMINENT and part of the hero at substantial size, rendered CLEAN, CRISP, and fully LEGIBLE. Place it flat and FACING the viewer on a surface WIDE enough to fit the whole logo including the wordmark (a banner, sign, nameplate, panel, or poster). Do NOT crop to just the icon, do NOT drop the wordmark, and do NOT warp, curve, or emboss it around a rounded or angled 3D surface where the wordmark would distort. Never tiny, never omitted, never glowing.
- Everything is grayscale EXCEPT exactly TWO bold accent colours used BOLDLY as large colour FIELDS and blocks (not timid little scraps). The two specific colours are chosen SEPARATELY by the palette system and applied to the image, so in your prompt refer to them GENERICALLY as "the two bold accent colours" — do NOT name specific colours or hex values, and do not tie the colours to the story's subject (no defaulting to red-white-blue for a US story). No third colour; no muddy, tan, beige, or earth tones.
- Every distinct element appears EXACTLY ONCE; no duplicates or mirrors.
- No fake or gibberish text anywhere. Prefer recognizable photographic BUILDINGS or entities over text-bearing seals. If a seal, stamp, or emblem shows a name, it MUST be the EXACT, correctly spelled real institution name (for example FEDERAL RESERVE, U.S. DEPARTMENT OF COMMERCE, SECURITIES AND EXCHANGE COMMISSION), never invented, garbled, or misspelled; otherwise show emblem imagery only.
${textBlock}

Translate any abstract or digital idea into a concrete PHYSICAL metaphor (for example, "onchain data feeds" becomes a printing press stamping ledgers, not glowing data).

First, READ and fully understand the ENTIRE article: identify the central subject, event, or tension, then build ONE metaphor with a single dominant hero subject around it. COMPOSE DELIBERATELY, like a real art director: choose the hero and its exact placement and size, 1 to 2 supporting cut-outs, how the logo integrates and stays prominent, ${textZone} which VARIED materials fit this story, the two bold accent colours, and the dramatic lighting and depth. THEN write image_prompt as ONE flowing, vivid paragraph that fully describes that exact composition, the dimensional cinematic hero, the specific materials, and the full house style, ready to render.

Return: image_prompt (the full paragraph), focal_subject (the hero, 2-5 words), supporting_subjects (0 to 2 concrete objects), logo_treatment (how the FULL logo lockup with its wordmark integrates, prominent, clean and flat on a wide viewer-facing surface, never cropped to the icon or warped), and text_elements (${textElementsNote}).`;
}

/**
 * The composition skill. Returns { image_prompt, focal_subject,
 * supporting_subjects, logo_treatment, text_elements, accent1, accent2 } or null.
 * @param {object} a { title, body?, subjects?, logoSymbol?, withText?, facts? }
 */
async function artDirect(a = {}) {
  const wantText = !!a.withText;
  try {
    const factLines = Array.isArray(a.facts) && a.facts.length
      ? `\n\nCONFIRMED FACTS (safe to quote figures/names from):\n- ${a.facts.slice(0, 25).join('\n- ')}` : '';
    const subj = (a.subjects && String(a.subjects).trim())
      ? `\n\nUser-requested subjects to weave into the SAME single scene: ${a.subjects}` : '';
    const logo = a.logoSymbol ? `\n\nCrypto logo/brand present in the scene: ${a.logoSymbol}` : '';
    const src = a.body ? `TITLE: ${a.title || ''}\n\nARTICLE:\n${String(a.body).slice(0, 7000)}` : `HEADLINE: ${a.title || ''}`;
    const r = await callResponses({
      model: MODELS.artDirect,
      instructions: buildArtDirectSystem(wantText),
      input: `${src}${subj}${logo}${factLines}`,
      schema: ART_DIRECT_SCHEMA,
      schemaName: 'art_direction',
      effort: 'medium',
      maxOutputTokens: 3500
    });
    const c = r.parsed;
    if (!c || !c.image_prompt) return null;
    const clip = (s, n) => String(s || '').trim().split(/\s+/).slice(0, n).join(' ');
    c.image_prompt = String(c.image_prompt).trim().slice(0, 2200);
    c.focal_subject = clip(c.focal_subject, 6);
    c.logo_treatment = clip(c.logo_treatment, 16);
    c.supporting_subjects = (c.supporting_subjects || []).map(s => clip(s, 4)).filter(Boolean).slice(0, 2);
    c.text_elements = wantText
      ? (c.text_elements || []).map(t => ({ text: clip(t && t.text, 6), emphasis: !!(t && t.emphasis) })).filter(t => t.text).slice(0, 4)
      : [];
    // Colours are NOT chosen by the art director — they come from the palette
    // system (random pairing for Article Studio, user selection on the Cover
    // Generator), so the same story does not always get the same colours.
    return c;
  } catch (e) {
    logger.warn(`artDirect failed: ${e.message}`);
    return null;
  }
}

module.exports = {
  runPipeline,
  deriveVisualSubject,
  deriveCoverConcept,
  deriveVisualConcept,
  deriveSeoMetadata,
  artDirect,
  // exported for testing
  articleChecks,
  hasSharedNgram,
  calculateScore,
  passesGate,
  MODELS,
  QUALITY_GATE
};
