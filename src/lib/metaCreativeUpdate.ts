/**
 * Builds Meta `adcreatives` payloads for AI Bulk Edit's Push to Meta flow.
 *
 * Why this isn't an in-place ad update:
 * Meta does not allow editing most creative fields after creation. The
 * documented workaround is a 3-step flow:
 *
 *   1. GET the existing creative (caller does this — see AdsProcessing.tsx)
 *   2. POST a new creative to /act_{id}/adcreatives with updated text
 *   3. POST to /{ad_id} with creative={creative_id: <new>} to rebind
 *
 * This file owns step 2 — building the new-creative payload. The dispatcher
 * `buildCreativeUpdate` returns the body ready for /adcreatives; the caller
 * does steps 1 and 3.
 *
 * Coverage (verified live against two real ad accounts, 75 ads total):
 *
 *   ┌──────────────────────────────────────────────┬─────────────────────┐
 *   │ AD SHAPE                                     │ BUILDER             │
 *   ├──────────────────────────────────────────────┼─────────────────────┤
 *   │ asset_feed_spec with titles/bodies           │ buildAssetFeedUpdate│
 *   │   • images[] / videos[] / carousels[]        │   (covers all AFS   │
 *   │   • placement-optimized (adlabels + rules)   │    variants — text  │
 *   │   • DOF / Advantage+                         │    only swap, full  │
 *   │   • text-DOF on OSS media (image or video)   │    OSS preserved)   │
 *   │                                              │                     │
 *   │ object_story_spec.video_data only            │ buildSimpleVideo    │
 *   │ object_story_spec.link_data (no children)    │ buildSimpleImage    │
 *   │ object_story_spec.link_data.child_attachments│ buildSimpleCarousel │
 *   └──────────────────────────────────────────────┴─────────────────────┘
 *
 * Two cross-cutting Meta gotchas every builder must handle:
 *
 *   1. `image_url` + `image_hash` conflict — Meta's GET often returns BOTH
 *      on stored video/link data; re-posting both is rejected with "only
 *      one of image_url or image_hash may be specified". We always drop
 *      image_url and keep image_hash (hashes are stable, URLs may expire).
 *
 *   2. `standard_enhancements` deprecation (subcode 3858504) — Meta no
 *      longer accepts this in degrees_of_freedom_spec. We strip it before
 *      re-posting any DOF block. All other DOF features pass through.
 *
 * The previous version of this file built inline `creative` objects POSTed
 * to /{ad_id} directly. That worked for some ads but failed on the
 * text-DOF-on-OSS-media hybrids because it stripped object_story_spec down
 * to page_id only, losing the link that lived inside video_data/link_data.
 * Meta's response was the cryptic "Het veld link is vereist" (link required).
 */

// ── Types ──────────────────────────────────────────────────────────────

/** Minimal shape of an ad needed for building updates. Structural — any
    object with these fields satisfies it. */
export interface UpdateableAd {
  id: string;
  name: string;
  headlines: string[];
  bodies: string[];
  descriptions: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Creative = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdCreativePayload = Record<string, any>;

export type AdFamily = 'asset_feed' | 'simple' | 'unknown';
export type AdFormat = 'image' | 'video' | 'carousel' | 'unknown';

export interface CreativeUpdateResult {
  /** Body to POST to /act_{accountId}/adcreatives */
  payload: AdCreativePayload;
  family: AdFamily;
  format: AdFormat;
}

// ── Helpers ────────────────────────────────────────────────────────────

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Strips fields Meta rejects on re-post. Currently:
 *   - degrees_of_freedom_spec.creative_features_spec.standard_enhancements
 *     (deprecated, error_subcode 3858504)
 * Add new entries here as Meta deprecates more.
 */
function sanitizeDof(dof: Creative): Creative {
  if (!dof) return dof;
  const out = clone(dof);
  if (out.creative_features_spec?.standard_enhancements) {
    delete out.creative_features_spec.standard_enhancements;
  }
  return out;
}

/**
 * Replace text on an array of asset_feed_spec entries while preserving each
 * entry's adlabels and the original array length. Used for titles, bodies,
 * and descriptions uniformly.
 *
 * Length preservation is critical for placement-optimized and carousel-hybrid
 * ads. Carousel children and customization rules reference specific entry
 * indices via auto-generated labels (`title_0`, `body_1`, ...). Growing the
 * array would emit duplicate labels (rejected, subcode 2446410); shrinking
 * it would orphan references (rejected, subcode 2446407).
 *
 * Behavior:
 *   - For i < min(original.length, newTexts.length): replace text in place
 *     on the original entry (keeping its adlabels and any other metadata)
 *   - For i >= newTexts.length: keep original entry untouched (when AI
 *     returned fewer suggestions than the ad has variants)
 *   - For i >= original.length: ignore extras silently (when AI returned
 *     more — we can't safely add new entries to the customization graph)
 */
function replaceTextEntries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  original: any[] | undefined,
  newTexts: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] | undefined {
  if (!Array.isArray(original) || newTexts.length === 0) return original;
  return original.map((entry, i) =>
    i < newTexts.length ? { ...entry, text: newTexts[i] } : entry
  );
}

/**
 * Drop image_url whenever image_hash is present. Meta's GET returns both on
 * stored creatives but rejects re-posts that send both. Hashes are stable;
 * URLs are short-lived CDN links that may expire. Mutates in place.
 */
function stripImageUrlConflict(obj: Record<string, unknown> | undefined): void {
  if (!obj) return;
  if (obj.image_hash && obj.image_url) {
    delete obj.image_url;
  }
}

/**
 * Pre-flight check: walks asset_feed_spec carousels and customization rules
 * looking for label references that don't resolve to any actual entry. We
 * surface these as a clear error instead of letting Meta reject the re-POST
 * with a cryptic localized message (subcodes 2446407 / 2446410).
 *
 * How dangling references happen: a creative's bodies/titles/etc. can be
 * pruned over time (via Ads Manager edits, partial deletes, or earlier API
 * mistakes), but the carousel children and customization rules still hold
 * the old label names. The current ad keeps serving because Meta doesn't
 * re-validate stored creatives — but any re-POST via /adcreatives will fail.
 *
 * The fix is upstream (the user must repair the ad in Meta Ads Manager); we
 * just want to tell them clearly which references are dangling.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectLabelNames(entries: any[] | undefined): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    for (const label of entry.adlabels || []) {
      if (label?.name) out.add(label.name);
    }
  }
  return out;
}

function validateAssetFeedReferences(afs: Creative, adName: string): void {
  if (!afs) return;
  const known = {
    title: collectLabelNames(afs.titles),
    body: collectLabelNames(afs.bodies),
    description: collectLabelNames(afs.descriptions),
    image: collectLabelNames(afs.images),
    video: collectLabelNames(afs.videos),
    link_url: collectLabelNames(afs.link_urls),
  };

  const dangling: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const check = (ref: any, kind: keyof typeof known, where: string) => {
    const name = ref?.name;
    if (name && !known[kind].has(name)) {
      dangling.push(`${kind}=${name} (in ${where})`);
    }
  };

  // Carousel children
  for (let ci = 0; ci < (afs.carousels?.length || 0); ci++) {
    const car = afs.carousels[ci];
    for (let ki = 0; ki < (car.child_attachments?.length || 0); ki++) {
      const child = car.child_attachments[ki];
      const where = `carousels[${ci}].child_attachments[${ki}]`;
      check(child.title_label, 'title', where);
      check(child.body_label, 'body', where);
      check(child.description_label, 'description', where);
      check(child.image_label, 'image', where);
      check(child.video_label, 'video', where);
      check(child.link_url_label, 'link_url', where);
    }
  }

  // Customization rules
  for (let ri = 0; ri < (afs.asset_customization_rules?.length || 0); ri++) {
    const rule = afs.asset_customization_rules[ri];
    const where = `asset_customization_rules[${ri}]`;
    check(rule.title_label, 'title', where);
    check(rule.body_label, 'body', where);
    check(rule.description_label, 'description', where);
    check(rule.image_label, 'image', where);
    check(rule.video_label, 'video', where);
    check(rule.link_url_label, 'link_url', where);
  }

  if (dangling.length > 0) {
    // Cap the listed refs to keep the toast readable; the full list goes to console.
    const shown = dangling.slice(0, 4).join('; ');
    const more = dangling.length > 4 ? ` (+${dangling.length - 4} more)` : '';
    throw new Error(
      `Cannot update "${adName}" — creative has ${dangling.length} dangling label reference(s) ` +
      `that no longer resolve: ${shown}${more}. ` +
      `This usually means the creative was partially edited or pruned outside this app. ` +
      `Fix the ad in Meta Ads Manager (re-add the missing variants or recreate the carousel) and retry.`
    );
  }
}

// ── Type detection ─────────────────────────────────────────────────────

/**
 * Decides which builder to dispatch to. Order matters:
 *   1. AFS with titles/bodies → asset_feed builder (handles all AFS shapes
 *      including the text-DOF-on-OSS-media hybrid)
 *   2. OSS video_data → simple video
 *   3. OSS link_data with child_attachments → simple carousel
 *   4. OSS link_data → simple image
 *   5. otherwise → unknown (caller surfaces an error)
 */
export function detectAdType(creative: Creative): { family: AdFamily; format: AdFormat } {
  if (!creative) return { family: 'unknown', format: 'unknown' };

  const afs = creative.asset_feed_spec;
  const oss = creative.object_story_spec;

  // Asset feed first — covers any creative with multi-text variations
  if (afs && (Array.isArray(afs.titles) || Array.isArray(afs.bodies))) {
    if (Array.isArray(afs.videos) && afs.videos.length > 0) {
      return { family: 'asset_feed', format: 'video' };
    }
    if (Array.isArray(afs.carousels) && afs.carousels.length > 0) {
      return { family: 'asset_feed', format: 'carousel' };
    }
    if (afs.asset_customization_rules && JSON.stringify(afs).includes('CAROUSEL')) {
      return { family: 'asset_feed', format: 'carousel' };
    }
    if (Array.isArray(afs.images) && afs.images.length > 0) {
      return { family: 'asset_feed', format: 'image' };
    }
    // AFS has text but no media of its own — media lives in OSS (text-DOF
    // hybrid). Use OSS to determine format for logging only; the builder
    // handles them all the same way.
    if (oss?.video_data) return { family: 'asset_feed', format: 'video' };
    if (oss?.link_data?.child_attachments) return { family: 'asset_feed', format: 'carousel' };
    if (oss?.link_data) return { family: 'asset_feed', format: 'image' };
    return { family: 'asset_feed', format: 'unknown' };
  }

  if (oss?.video_data) return { family: 'simple', format: 'video' };
  if (oss?.link_data?.child_attachments) return { family: 'simple', format: 'carousel' };
  if (oss?.link_data) return { family: 'simple', format: 'image' };

  return { family: 'unknown', format: 'unknown' };
}

// ── Asset feed builder ─────────────────────────────────────────────────

/**
 * Handles every ad with `asset_feed_spec.titles` or `.bodies`. Covers:
 *   - Standard AFS image/video/carousel
 *   - Placement-optimized (asset_customization_rules + adlabels)
 *   - DOF / Advantage+
 *   - Text-DOF on OSS media (image or video) — the hybrid where AFS only
 *     carries text and the actual image/video lives in object_story_spec
 *
 * Strategy: deep-clone the entire AFS and only replace text on titles[],
 * bodies[], descriptions[] while preserving each entry's adlabels. Pass
 * object_story_spec through verbatim — that's where the hybrid pattern
 * keeps its media + link, and stripping it (as the previous code did) was
 * the cause of the "link required" rejection.
 */
function buildAssetFeedPayload(
  ad: UpdateableAd,
  creative: Creative
): AdCreativePayload {
  // Validate label graph BEFORE cloning so we fail fast with a clear error
  // on creatives that have been corrupted upstream (dangling carousel/rule
  // references). Meta would otherwise reject the re-POST with a localized
  // message that's hard to act on.
  validateAssetFeedReferences(creative.asset_feed_spec, ad.name);

  const afs = clone(creative.asset_feed_spec);

  if (ad.headlines.length > 0) {
    const replaced = replaceTextEntries(afs.titles, ad.headlines);
    if (replaced) afs.titles = replaced;
  }
  if (ad.bodies.length > 0) {
    const replaced = replaceTextEntries(afs.bodies, ad.bodies);
    if (replaced) afs.bodies = replaced;
  }
  if (ad.descriptions.length > 0) {
    const replaced = replaceTextEntries(afs.descriptions, ad.descriptions);
    if (replaced) afs.descriptions = replaced;
  }

  const payload: AdCreativePayload = {
    name: creative.name || ad.name,
    asset_feed_spec: afs,
  };

  // Preserve OSS verbatim — for text-DOF hybrids the link lives inside
  // video_data.call_to_action.value.link or link_data.link, NOT in
  // afs.link_urls. Stripping OSS to page_id was the bug that caused
  // "link required" on these ads.
  if (creative.object_story_spec) {
    const oss = clone(creative.object_story_spec);
    // Defensive image_url cleanup in case OSS carries video_data/link_data
    // with both fields populated.
    stripImageUrlConflict(oss.video_data);
    stripImageUrlConflict(oss.link_data);
    payload.object_story_spec = oss;
  }

  if (creative.degrees_of_freedom_spec) {
    payload.degrees_of_freedom_spec = sanitizeDof(creative.degrees_of_freedom_spec);
  }

  if (creative.url_tags) payload.url_tags = creative.url_tags;

  return payload;
}

// ── Simple image (object_story_spec.link_data without child_attachments) ──

function buildSimpleImagePayload(
  ad: UpdateableAd,
  creative: Creative
): AdCreativePayload {
  const oss = clone(creative.object_story_spec);
  const ld = oss.link_data;

  if (ad.headlines[0] !== undefined) ld.name = ad.headlines[0];
  if (ad.bodies[0] !== undefined) ld.message = ad.bodies[0];
  if (ad.descriptions[0] !== undefined) ld.description = ad.descriptions[0];

  stripImageUrlConflict(ld);

  const payload: AdCreativePayload = {
    name: creative.name || ad.name,
    object_story_spec: oss,
  };

  if (creative.degrees_of_freedom_spec) {
    payload.degrees_of_freedom_spec = sanitizeDof(creative.degrees_of_freedom_spec);
  }
  if (creative.url_tags) payload.url_tags = creative.url_tags;

  return payload;
}

// ── Simple video (object_story_spec.video_data) ────────────────────────

function buildSimpleVideoPayload(
  ad: UpdateableAd,
  creative: Creative
): AdCreativePayload {
  const oss = clone(creative.object_story_spec);
  const vd = oss.video_data;

  if (ad.headlines[0] !== undefined) vd.title = ad.headlines[0];
  if (ad.bodies[0] !== undefined) vd.message = ad.bodies[0];
  if (ad.descriptions[0] !== undefined) vd.link_description = ad.descriptions[0];

  stripImageUrlConflict(vd);

  const payload: AdCreativePayload = {
    name: creative.name || ad.name,
    object_story_spec: oss,
  };

  if (creative.degrees_of_freedom_spec) {
    payload.degrees_of_freedom_spec = sanitizeDof(creative.degrees_of_freedom_spec);
  }
  if (creative.url_tags) payload.url_tags = creative.url_tags;

  return payload;
}

// ── Simple carousel (object_story_spec.link_data.child_attachments) ────

function buildSimpleCarouselPayload(
  ad: UpdateableAd,
  creative: Creative
): AdCreativePayload {
  const oss = clone(creative.object_story_spec);
  const ld = oss.link_data;

  // Mirrors meta-fetch-ads/index.ts flattening:
  //   headlines[i]    ← child_attachments[i].name
  //   bodies[0]       ← link_data.message  (single shared body if present)
  //   descriptions[i] ← child_attachments[i].description
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ld.child_attachments = ld.child_attachments.map((card: any, i: number) => {
    const next = { ...card };
    if (ad.headlines[i] !== undefined) next.name = ad.headlines[i];
    if (ad.descriptions[i] !== undefined) next.description = ad.descriptions[i];
    stripImageUrlConflict(next);
    return next;
  });

  if (ad.bodies[0] !== undefined) ld.message = ad.bodies[0];

  const payload: AdCreativePayload = {
    name: creative.name || ad.name,
    object_story_spec: oss,
  };

  if (creative.degrees_of_freedom_spec) {
    payload.degrees_of_freedom_spec = sanitizeDof(creative.degrees_of_freedom_spec);
  }
  if (creative.url_tags) payload.url_tags = creative.url_tags;

  return payload;
}

// ── Public dispatcher ──────────────────────────────────────────────────

/**
 * Build the new-creative payload for an ad update. Detects which structural
 * shape the creative uses, dispatches to the matching builder, and returns
 * the payload ready to POST to /act_{accountId}/adcreatives.
 *
 * Throws on:
 *   - empty/missing creatives (no AFS, no OSS — corrupt or deleted)
 *   - shapes we don't know how to handle (so the user gets a clear error
 *     instead of a silently malformed POST)
 */
export function buildCreativeUpdate(
  ad: UpdateableAd,
  creative: Creative
): CreativeUpdateResult {
  if (!creative || (!creative.asset_feed_spec && !creative.object_story_spec)) {
    throw new Error(
      `Cannot update ad "${ad.name}" — creative is empty (id only). ` +
      `It may have been deleted or is in an error state.`
    );
  }

  const { family, format } = detectAdType(creative);

  if (family === 'asset_feed') {
    return { payload: buildAssetFeedPayload(ad, creative), family, format };
  }

  if (family === 'simple') {
    if (format === 'image') return { payload: buildSimpleImagePayload(ad, creative), family, format };
    if (format === 'video') return { payload: buildSimpleVideoPayload(ad, creative), family, format };
    if (format === 'carousel') return { payload: buildSimpleCarouselPayload(ad, creative), family, format };
  }

  throw new Error(
    `Cannot update ad "${ad.name}" — unknown creative shape. ` +
    `Got family=${family}, format=${format}.`
  );
}
