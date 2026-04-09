/**
 * OpenAI client — bulk ad copy editing.
 *
 * All business logic for AI Bulk Edit lives here. The openai-proxy edge function
 * is a thin pass-through that just attaches the API key — everything else (prompt,
 * tool spec, batching, validation, parsing) happens in the browser so it can be
 * hot-reloaded via Vite and stepped through in DevTools.
 *
 * Architecture:
 *   AdsProcessing.tsx
 *     → bulkEditAds(prompt, ads)
 *         → split into batches of BATCH_SIZE
 *         → Promise.all([ for each batch: callOpenAI() → openai-proxy → api.openai.com ])
 *         → flatten structured tool output → flat suggestions map
 *         → defensive auto-fill for any dropped ads
 *         → return suggestions
 *
 * The model uses a two-phase reasoning structure (ANALYZE → REWRITE → RETURN) so
 * it doesn't silently drop ads it judges "irrelevant to the instruction".
 */
import { invokeEdgeFunction } from './edgeFunctions';

// ── Tunables ──
const MODEL = 'gpt-4.1';
// gpt-4.1 supports up to 32,768 output tokens. We don't actually need this much
// for our batch sizes — real consumption is ~3-6K — but headroom prevents
// truncation on ads with unusually long bodies and never costs anything
// (you only pay for tokens used).
//
// Why gpt-4.1 instead of gpt-4.1-mini: the smaller model would over-anchor on
// the dominant theme of long Dutch festival ads and miss embedded CTA mentions
// (e.g. "Early Bird ticket" buried at the end of a 5000-char body about the
// festival lineup). gpt-4.1 is significantly better at scanning long content
// for embedded topic mentions, which is the bottleneck for our accuracy.
// Trade-off: ~2x slower and ~5x more expensive (still pennies per run for
// our volume). Bin-packing handles the latency increase fine.
const MAX_TOKENS = 32768;
const TEMPERATURE = 0.2;

/**
 * BATCH_WEIGHT_THRESHOLD — maximum total character count per batch.
 *
 * Each OpenAI call's wall time correlates with the total content it has to
 * rewrite. We pack ads into batches greedily, capping the cumulative character
 * count at this threshold so no single call risks the Supabase ~150s gateway
 * timeout. 5000 chars maps to roughly 15-20s of OpenAI processing time on
 * gpt-4.1-mini, leaving generous headroom under 150s.
 *
 * If a single ad's character count exceeds this threshold by itself, the
 * algorithm puts it in its own batch (we can't split a single ad). The retry+
 * split fallback in callOpenAIBatchResilient handles the rare case where even
 * a single oversized ad times out.
 */
const BATCH_WEIGHT_THRESHOLD = 5000;

/**
 * BATCH_MAX_COUNT — maximum number of ads per batch, regardless of weight.
 *
 * Even if 30 tiny ads' total character count is well under the weight threshold,
 * we still cap the batch at this size. Reason: the model has to generate 30
 * separate output structures (one per ad) which has a per-ad latency overhead
 * the character-count heuristic doesn't fully capture.
 */
const BATCH_MAX_COUNT = 10;

/**
 * Maximum concurrent OpenAI calls in flight at any one time.
 *
 * 4 is safe with our batch sizing because each call now finishes in ~10-20s.
 * Multiple in flight don't accumulate at the gateway long enough to hit
 * concurrency limits.
 */
const MAX_CONCURRENCY = 4;

// ── Types ──

export interface InputAd {
  id: string;
  headlines: string[];
  bodies: string[];
  descriptions: string[];
}

/** A flat suggestion the way AdsProcessing.tsx wants to consume it. */
export interface AdSuggestion {
  headlines: string[];
  bodies: string[];
  descriptions: string[];
}

/** What bulkEditAds returns to the caller. */
export interface BulkEditResult {
  /** Map of adId → suggestion. Includes ALL input ads, even ones with zero changes. */
  suggestions: Record<string, AdSuggestion>;
  /** IDs where the AI determined the instruction applies to at least one field. */
  modifiedAdIds: Set<string>;
  /** IDs where the AI determined no fields apply. */
  unchangedAdIds: Set<string>;
  /** IDs the model dropped despite the prompt — auto-filled with originals. */
  droppedAdIds: string[];
}

// ── Prompt + tool spec ──

/**
 * Two-phase prompt: ANALYZE → REWRITE → RETURN.
 *
 * The "return EVERY ad" rule is intentionally restated multiple times — earlier
 * versions of this prompt produced models that silently dropped ads they judged
 * "irrelevant to the instruction".
 */
const SYSTEM_PROMPT = `You are an expert Meta (Facebook/Instagram) ad copy editor.

You receive a list of ads (each with headlines, bodies, descriptions) and a single user instruction. Your job is to apply the instruction to EVERY ad — but only to the specific text fields where it actually applies.

PROCESS — think through these steps internally for every ad before producing output:

  Step 1 — ANALYZE: For each text field (every headline, every body, every description), decide whether the user instruction applies to it.
    - "applies"  → the instruction's intent affects this specific text and it needs rewriting.
    - "does not apply" → this text is unrelated to the instruction and should be returned unchanged.
    - When in doubt, prefer "applies". A small unnecessary edit is far less harmful than a missed edit.
    - Evaluate each field independently. Two headlines in the same ad can have different verdicts.

  Step 2 — REWRITE: For every field that applies, produce the new text following the instruction.
    - Keep the same tone, language, and approximate length as the original unless the instruction explicitly says otherwise.
    - Match the original's writing style (emoji usage, capitalization, punctuation rhythm).
    - Preserve any original placeholder syntax, hashtags, or brand-specific terms unless the instruction targets them.

  Step 3 — RETURN: For every ad in the input, output the resulting text variants.
    - For fields that needed rewriting, output the new text.
    - For fields that did NOT need rewriting, output the ORIGINAL text verbatim — character for character, no edits.
    - Never omit, skip, or filter out any ad — even ads where every field is unchanged.
    - Never reorder ads. Output order MUST match input order.
    - Output ad ids MUST exactly match the input ids — never invent or modify ids.
    - Output array lengths MUST equal input array lengths within each ad (3 input headlines → 3 output headlines).

CRITICAL CONSTRAINTS (violating any of these is a failure):
1. Output ad count MUST equal input ad count. Never drop ads.
2. Each output ad's "id" MUST match the input id exactly.
3. Output text-array lengths MUST equal input text-array lengths.
4. For unchanged fields, output the original text verbatim. Never empty, never null.
5. The user's downstream system requires a 1:1 mapping between input and output. Missing ads cause real data loss.`;

const TOOL_SPEC = {
  type: 'function' as const,
  function: {
    name: 'edit_ads',
    description:
      'Returns the rewritten ad text variants for every input ad. Every input ad must appear in the output. Unchanged fields must be returned with their original text verbatim.',
    parameters: {
      type: 'object',
      properties: {
        ads: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Must exactly match the input ad id.' },
              headlines: {
                type: 'array',
                items: { type: 'string' },
                description: 'All headlines for this ad. Same length as input. Unchanged headlines = original text verbatim.',
              },
              bodies: {
                type: 'array',
                items: { type: 'string' },
                description: 'All bodies for this ad. Same length as input. Unchanged bodies = original text verbatim.',
              },
              descriptions: {
                type: 'array',
                items: { type: 'string' },
                description: 'All descriptions for this ad. Same length as input. Unchanged descriptions = original text verbatim.',
              },
            },
            required: ['id', 'headlines', 'bodies', 'descriptions'],
          },
        },
      },
      required: ['ads'],
    },
  },
};

// ── Internal types for the tool response ──

/**
 * What the model returns per ad. Plain string arrays — same shape as InputAd.
 * Change detection is done by string comparison against the original input.
 */
interface ModelAd {
  id: string;
  headlines: string[];
  bodies: string[];
  descriptions: string[];
}

interface OpenAIChatResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      tool_calls?: Array<{
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  error?: { message?: string };
}

// ── Single-batch OpenAI call ──

async function callOpenAIBatch(
  prompt: string,
  batch: InputAd[],
  batchIndex: number,
  totalBatches: number,
): Promise<ModelAd[]> {
  const userMessage = `User instruction: "${prompt}"

Current ads:
${JSON.stringify(batch, null, 2)}

Apply the instruction to these ads following the ANALYZE → REWRITE → RETURN process. Return every ad using the edit_ads tool.`;

  const payload = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    tools: [TOOL_SPEC],
    tool_choice: { type: 'function', function: { name: 'edit_ads' } },
  };

  console.log(`[bulkEditAds] Batch ${batchIndex + 1}/${totalBatches} dispatching ${batch.length} ads`);

  let response: OpenAIChatResponse;
  try {
    response = await invokeEdgeFunction<OpenAIChatResponse>('openai-proxy', {
      endpoint: 'chat/completions',
      payload,
    });
  } catch (err) {
    // Surface clearer context — raw "Failed to fetch" / CORS errors hide the
    // batch number and look like proxy bugs when they're usually gateway
    // concurrency or timeout issues.
    const msg = (err as Error).message || String(err);
    throw new Error(
      `Batch ${batchIndex + 1}/${totalBatches} (${batch.length} ads) failed at openai-proxy gateway: ${msg}. ` +
      `This is usually a gateway concurrency or timeout issue, not an OpenAI error.`
    );
  }

  const finishReason = response.choices?.[0]?.finish_reason;
  console.log(`[bulkEditAds] Batch ${batchIndex + 1}/${totalBatches} response — finish_reason: ${finishReason}`);

  if (finishReason === 'length') {
    throw new Error(
      `OpenAI response truncated (hit max_tokens) for batch ${batchIndex + 1} of ${totalBatches} ` +
      `(${batch.length} ads). Try reducing the number of selected ads.`
    );
  }

  const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error(`Batch ${batchIndex + 1}: OpenAI returned no tool call`);
  }

  let parsed: { ads?: ModelAd[] };
  try {
    parsed = JSON.parse(toolCall.function.arguments);
  } catch (err) {
    throw new Error(
      `Batch ${batchIndex + 1}: failed to parse OpenAI tool call as JSON: ${(err as Error).message}`
    );
  }

  if (!parsed?.ads || !Array.isArray(parsed.ads)) {
    throw new Error(`Batch ${batchIndex + 1}: OpenAI response missing ads array`);
  }

  return parsed.ads;
}

// ── Resilient batch wrapper: retry on failure, split on final retry ──

/**
 * Calls callOpenAIBatch with layered fallbacks:
 *   Attempt 1: try the full batch as-is.
 *   Attempt 2: same batch, after a 2s backoff (handles transient slow responses).
 *   Attempt 3: split the batch into individual ads (one OpenAI call per ad).
 *              This is the slow but reliable fallback for "this batch is just
 *              too big to fit in the gateway timeout window" cases.
 *
 * If all attempts fail, throws with a descriptive error that names the batch
 * and the underlying cause.
 */
async function callOpenAIBatchResilient(
  prompt: string,
  batch: InputAd[],
  batchIndex: number,
  totalBatches: number,
): Promise<ModelAd[]> {
  // Attempt 1: full batch
  try {
    return await callOpenAIBatch(prompt, batch, batchIndex, totalBatches);
  } catch (err1) {
    console.warn(
      `[bulkEditAds] Batch ${batchIndex + 1}/${totalBatches} attempt 1 failed: ${(err1 as Error).message}. ` +
      `Retrying after 2s...`
    );
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Attempt 2: same batch, retry after backoff
    try {
      return await callOpenAIBatch(prompt, batch, batchIndex, totalBatches);
    } catch (err2) {
      // If batch is already 1 ad, retry can't split further — give up.
      if (batch.length <= 1) {
        throw new Error(
          `Batch ${batchIndex + 1}/${totalBatches} failed after 2 attempts (single ad): ${(err2 as Error).message}`
        );
      }

      console.warn(
        `[bulkEditAds] Batch ${batchIndex + 1}/${totalBatches} attempt 2 failed: ${(err2 as Error).message}. ` +
        `Splitting into ${batch.length} single-ad calls (slow fallback)...`
      );

      // Attempt 3: split the batch into single-ad calls and run them sequentially.
      // Sequential (not parallel) keeps us inside the worker's concurrency slot —
      // we don't want to spawn extra parallel calls that would bypass the limit.
      const results: ModelAd[] = [];
      for (let i = 0; i < batch.length; i++) {
        try {
          const singleResult = await callOpenAIBatch(
            prompt,
            [batch[i]],
            batchIndex,
            totalBatches,
          );
          results.push(...singleResult);
        } catch (err3) {
          // Even the single-ad call failed. This ad is genuinely broken or
          // OpenAI is down. Don't fail the whole batch — return the originals
          // for this ad, log loudly, and continue.
          console.error(
            `[bulkEditAds] Batch ${batchIndex + 1}/${totalBatches} ` +
            `single-ad fallback failed for ad ${batch[i].id}: ${(err3 as Error).message}`
          );
          // Construct a synthetic ModelAd that returns the originals verbatim,
          // so the downstream change-detection logic correctly marks it unchanged.
          results.push({
            id: batch[i].id,
            headlines: [...batch[i].headlines],
            bodies: [...batch[i].bodies],
            descriptions: [...batch[i].descriptions],
          });
        }
      }
      console.log(
        `[bulkEditAds] Batch ${batchIndex + 1}/${totalBatches} split-fallback complete: ${results.length} ads recovered`
      );
      return results;
    }
  }
}

// ── Flatten one model ad → suggestion + change detection ──

/**
 * Compares the model's output to the original input ad. A field "changed" if
 * the model returned a different string than the input. An ad is "modified"
 * if any of its fields changed.
 *
 * The model is instructed to return original text verbatim for unchanged fields,
 * so equal strings = unchanged, different strings = changed. No explicit boolean
 * needed (this replaces the previous {original, applies, new_text} schema).
 */
function flattenModelAd(
  modelAd: ModelAd,
  inputAd: InputAd,
): { suggestion: AdSuggestion; hasAnyChange: boolean } {
  let hasAnyChange = false;

  const flattenField = (modelArr: string[] | undefined, inputArr: string[]): string[] => {
    if (!modelArr) return [...inputArr];
    // Defensive: if model returned wrong array length, fill missing slots from input
    return inputArr.map((inputText, i) => {
      const modelText = modelArr[i];
      if (typeof modelText !== 'string') return inputText;
      if (modelText !== inputText) hasAnyChange = true;
      return modelText;
    });
  };

  return {
    suggestion: {
      headlines: flattenField(modelAd.headlines, inputAd.headlines),
      bodies: flattenField(modelAd.bodies, inputAd.bodies),
      descriptions: flattenField(modelAd.descriptions, inputAd.descriptions),
    },
    hasAnyChange,
  };
}

// ── Bin-packing batcher ──

/**
 * Total character count across all text fields of an ad. Used as a cheap proxy
 * for OpenAI output token cost — heavier ads take longer to rewrite, so we
 * pack batches by total weight rather than fixed count to keep per-call wall
 * time predictable.
 */
function adWeight(ad: InputAd): number {
  const sumChars = (arr: string[]) => arr.reduce((sum, s) => sum + s.length, 0);
  return sumChars(ad.headlines) + sumChars(ad.bodies) + sumChars(ad.descriptions);
}

/**
 * Bin-pack ads into batches so each batch's total weight stays under the
 * threshold AND each batch holds at most maxCount ads.
 *
 * Algorithm: greedy bin-packing with two constraints (max weight, max count).
 *   1. Sort ads heaviest first.
 *   2. For each ad, find the lightest existing batch that can still accept it
 *      (under both constraints). If none fits, start a new batch.
 *   3. Heavy ads naturally get their own batches (one ad alone fills it);
 *      light ads cluster densely until either constraint is hit.
 *
 * Edge case: if a single ad's weight exceeds maxWeight on its own, it gets
 * its own batch anyway — we can't split a single ad. The retry+split fallback
 * in callOpenAIBatchResilient handles the rare case where even a lone oversized
 * ad times out.
 */
function buildBalancedBatches(
  ads: InputAd[],
  maxWeight: number,
  maxCount: number,
): InputAd[][] {
  // Step 1 — annotate every ad with its weight, sort heaviest first.
  const weighted = ads.map(ad => ({ ad, weight: adWeight(ad) }));
  weighted.sort((a, b) => b.weight - a.weight);

  // Step 2 — greedy placement. Each entry in `bins` tracks both the ads and
  // the running weight, so we can quickly check if a new ad fits.
  const bins: { ads: InputAd[]; weight: number }[] = [];

  for (const { ad, weight } of weighted) {
    // Find the lightest bin that can still accept this ad under both constraints.
    // Iterating over all bins is O(N²) total, fine for the realistic ad counts
    // we deal with (<200) and avoids needing a heap data structure.
    let target: typeof bins[number] | undefined;
    let lightestWeight = Infinity;
    for (const bin of bins) {
      if (bin.ads.length >= maxCount) continue;
      if (bin.weight + weight > maxWeight) continue;
      if (bin.weight < lightestWeight) {
        lightestWeight = bin.weight;
        target = bin;
      }
    }

    if (!target) {
      // No existing bin can hold this ad — either all are full, or this ad
      // alone exceeds maxWeight. Start a new bin regardless.
      target = { ads: [], weight: 0 };
      bins.push(target);
    }

    target.ads.push(ad);
    target.weight += weight;
  }

  return bins.map(b => b.ads);
}

// ── Public API: bulk edit ads ──

/**
 * Bulk-edit ad copy via OpenAI. Splits ads into batches, runs them in parallel,
 * validates the response, and returns suggestions for every input ad.
 *
 * @param prompt User instruction (e.g. "rewrite headlines to mention summer sale")
 * @param ads List of ads to process
 * @returns BulkEditResult with suggestions map + changed/unchanged/dropped categorization
 */
export async function bulkEditAds(prompt: string, ads: InputAd[]): Promise<BulkEditResult> {
  if (!prompt.trim()) throw new Error('Prompt is required');
  if (!ads || ads.length === 0) throw new Error('At least one ad is required');

  // Bin-pack ads by weight so no single batch exceeds the timeout-safe ceiling.
  // See buildBalancedBatches() for the algorithm.
  const batches = buildBalancedBatches(ads, BATCH_WEIGHT_THRESHOLD, BATCH_MAX_COUNT);

  // Log per-batch composition for debugging — shows how the bin-packing
  // distributed the weights so we can tune the threshold if needed.
  const batchSummary = batches
    .map((b, i) => {
      const weight = b.reduce((sum, ad) => sum + adWeight(ad), 0);
      return `  batch ${i}: ${b.length} ad(s), ${weight} chars`;
    })
    .join('\n');
  console.log(
    `[bulkEditAds] ${ads.length} ads → ${batches.length} batch(es) ` +
    `(threshold ${BATCH_WEIGHT_THRESHOLD} chars, max ${BATCH_MAX_COUNT} ads, ${MAX_CONCURRENCY} concurrent):\n${batchSummary}`
  );

  // Run batches with bounded concurrency. Sliding window: as soon as one
  // batch finishes, the next pending batch starts. Faster than sequential
  // (multiple in flight) but safer than Promise.all (avoids gateway limits).
  const startTime = Date.now();
  const batchResults: ModelAd[][] = new Array(batches.length);
  let nextBatchIndex = 0;

  const worker = async () => {
    while (true) {
      const i = nextBatchIndex++;
      if (i >= batches.length) return;
      // Use the resilient wrapper: retries on failure, splits on final retry,
      // and falls back to "no change" for individual ads that fail completely.
      // Successful batches are unaffected — they take the fast happy path.
      batchResults[i] = await callOpenAIBatchResilient(prompt, batches[i], i, batches.length);
    }
  };

  // Spawn MAX_CONCURRENCY workers; each pulls batches off the queue until empty.
  // If any worker throws, Promise.all rejects and the whole bulkEditAds call fails —
  // which is what we want, since partial results would silently lose data.
  const workerCount = Math.min(MAX_CONCURRENCY, batches.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const elapsedMs = Date.now() - startTime;
  console.log(`[bulkEditAds] All batches complete in ${elapsedMs}ms`);

  // Flatten + categorize. Need an id→inputAd map so flattenModelAd can do
  // string comparison against the original to detect changes.
  const inputAdById = new Map(ads.map(a => [a.id, a]));
  const suggestions: Record<string, AdSuggestion> = {};
  const modifiedAdIds = new Set<string>();
  const unchangedAdIds = new Set<string>();

  for (const batchAds of batchResults) {
    for (const modelAd of batchAds) {
      if (!modelAd?.id) continue;
      const inputAd = inputAdById.get(modelAd.id);
      if (!inputAd) {
        // Model invented an id that wasn't in our input — skip it. The defensive
        // auto-fill below will catch any missing input ads.
        console.warn(`[bulkEditAds] Model returned unknown ad id: ${modelAd.id}`);
        continue;
      }
      const { suggestion, hasAnyChange } = flattenModelAd(modelAd, inputAd);
      suggestions[modelAd.id] = suggestion;
      if (hasAnyChange) {
        modifiedAdIds.add(modelAd.id);
      } else {
        unchangedAdIds.add(modelAd.id);
      }
    }
  }

  // DEFENSIVE: auto-fill any input ad the model dropped. This should not happen
  // with the strengthened prompt, but if it does, we want zero data loss.
  const droppedAdIds: string[] = [];
  for (const inputAd of ads) {
    if (!suggestions[inputAd.id]) {
      droppedAdIds.push(inputAd.id);
      suggestions[inputAd.id] = {
        headlines: [...inputAd.headlines],
        bodies: [...inputAd.bodies],
        descriptions: [...inputAd.descriptions],
      };
      unchangedAdIds.add(inputAd.id);
    }
  }
  if (droppedAdIds.length > 0) {
    console.warn(
      `[bulkEditAds] Model dropped ${droppedAdIds.length} ads — auto-filled with originals. ` +
      `Dropped IDs: ${droppedAdIds.join(', ')}`
    );
  }

  console.log(
    `[bulkEditAds] Result: ${modifiedAdIds.size} modified, ${unchangedAdIds.size} unchanged, ` +
    `${droppedAdIds.length} auto-filled (of ${ads.length} input)`
  );

  return {
    suggestions,
    modifiedAdIds,
    unchangedAdIds,
    droppedAdIds,
  };
}
