import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import OpenAI from "openai";
import { loadCarouselStyleReferences } from "./carouselStyle";
import { loadCarouselFeedback } from "./carouselFeedback";
import type { ResearchResult } from "./types";

const PROFILE_PATH = path.join(process.cwd(), "brand-assets", "profile.md");

let openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env");
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

async function loadProfile(): Promise<string> {
  if (!existsSync(PROFILE_PATH)) return "";
  return (await readFile(PROFILE_PATH, "utf-8")).trim();
}

// --- Structured panel plan the content agent must return ---

// Only infographic types that image models render reliably. No line charts,
// tables, or dense multi-series — those garble in pixels.
const INFOGRAPHIC_TYPES = ["big-stat", "bar", "donut", "icon-stats", "comparison"] as const;
type InfographicType = (typeof INFOGRAPHIC_TYPES)[number];

interface InfographicSpec {
  type: InfographicType;
  // Short label/value pairs, e.g. [{"label":"2021","value":"12%"},{"label":"2024","value":"73%"}]
  data: { label: string; value: string }[];
}

interface PanelPlan {
  role: "hook" | "content" | "cta";
  step?: string; // "01" | "02" | "03" on content panels
  headline: string;
  support?: string;
  icon?: string; // short flat-vector icon description, e.g. "upward bar chart icon"
  infographic?: InfographicSpec | null;
}

interface CarouselPlan {
  background: "dark" | "light";
  panels: PanelPlan[];
}

const MAX_DATA_POINTS = 4;

function validatePlan(raw: unknown, expectedPanels: number): CarouselPlan {
  const plan = raw as Partial<CarouselPlan>;
  if (plan.background !== "dark" && plan.background !== "light") {
    plan.background = "dark";
  }
  if (!Array.isArray(plan.panels) || plan.panels.length !== expectedPanels) {
    throw new Error(
      `plan agent returned ${Array.isArray(plan.panels) ? plan.panels.length : 0} panels, expected ${expectedPanels}`,
    );
  }
  for (const panel of plan.panels) {
    if (!panel.headline || typeof panel.headline !== "string") {
      throw new Error("carousel plan panel is missing a headline");
    }
    const info = panel.infographic;
    if (info) {
      // Clamp to renderable specs: known type, few data points, real values.
      if (!INFOGRAPHIC_TYPES.includes(info.type) || !Array.isArray(info.data) || info.data.length === 0) {
        panel.infographic = null;
        continue;
      }
      info.data = info.data
        .filter((d) => d && typeof d.label === "string" && typeof d.value === "string")
        .slice(0, MAX_DATA_POINTS);
      if (info.data.length === 0) panel.infographic = null;
    }
  }
  return plan as CarouselPlan;
}

// --- Step 1: content agent plans the 4 panels + per-panel infographics ---

async function planCarousel(
  topic: string,
  research: ResearchResult,
  carouselInstructions?: string,
): Promise<CarouselPlan> {
  const [profile, feedback] = await Promise.all([loadProfile(), loadCarouselFeedback()]);

  const feedbackBlock = feedback ? feedback : "(no feedback notes yet)";
  const instructionsBlock =
    carouselInstructions && carouselInstructions.trim()
      ? carouselInstructions.trim()
      : "(no custom instructions provided)";

  const systemPrompt = `You are an expert LinkedIn carousel content designer. Plan a 4-panel carousel as structured JSON. Another system turns your plan into an image, so your job is ONLY the content and the data, not visual styling.

BRAND / AUTHOR PROFILE:
${profile || "(no profile provided)"}

ACCUMULATED FEEDBACK FROM THE AUTHOR ON PAST CAROUSELS — apply these notes:
${feedbackBlock}

CUSTOM CAROUSEL INSTRUCTIONS FROM THE AUTHOR (take priority when they conflict with defaults):
${instructionsBlock}

PANEL STRUCTURE (exactly 4 panels, in order):
1. role "hook" — bold attention-grabbing headline about the topic. Max 8 words. Optional 1-line support.
2-3. role "content" — one clear idea each (a stat, a step, a myth-vs-fact, an insight), grounded in the research. Give each: step ("01"/"02"), headline (max 6-8 words), support (max 2 short lines), icon (short flat-vector icon description), and an infographic when the research gives you real numbers for it.
4. role "cta" — headline "Follow for more" or a close natural variant. No infographic.

Because there are only 2 content panels, make them count: pick the two strongest, most distinct ideas, and give each a real data infographic whenever the research supports it.

INFOGRAPHICS — the whole point. For each content panel, look at what the research actually contains and pick the infographic type that best expresses it:
- "big-stat": one dominant number ("73%", "3x", "$2.4B"). Use for a single striking figure.
- "bar": 2-4 bars comparing values. Use for growth over time or A-vs-B sizes.
- "donut": one percentage as a progress ring. Use for share/adoption/completion figures.
- "icon-stats": 2-3 icon + number pairs. Use for a cluster of small related figures.
- "comparison": two-column before/after or myth/fact. Use for contrasts.
Rules for infographics:
- Use ONLY real figures from the research below. Never invent numbers. If a panel's idea has no real figure, set "infographic": null and rely on headline + icon instead.
- Keep labels under 3 words and values short ("73%", "12", "$2.4B") so they render legibly.
- Give the two content panels DIFFERENT infographic types when the data allows.

CONTENT RULES:
- Never use an em dash or en dash anywhere.
- Simple plain language. No corporate jargon or buzzwords.
- All text will be rendered inside an image, so keep every string short and unambiguous.

Return strictly valid JSON, no markdown fences, in this exact shape:
{"background": "dark" or "light", "panels": [{"role": "hook", "headline": "...", "support": "..."}, {"role": "content", "step": "01", "headline": "...", "support": "...", "icon": "...", "infographic": {"type": "big-stat", "data": [{"label": "...", "value": "..."}]}}, {"role": "content", "step": "02", "headline": "...", "support": "...", "icon": "...", "infographic": {"type": "bar", "data": [{"label": "...", "value": "..."}]}}, {"role": "cta", "headline": "..."}]}`;

  const userPrompt = `TOPIC / ROUGH IDEA:
${topic}

CURRENT RESEARCH / TREND CONTEXT (the ONLY source of figures for infographics):
${research.summary || "(no research available — use null infographics)"}`;

  const client = getClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  return validatePlan(JSON.parse(content), 4);
}

// --- Step 2: deterministic prompt assembly from the validated plan ---

function describeInfographic(info: InfographicSpec): string {
  const dataList = info.data.map((d) => `"${d.label}": "${d.value}"`).join(", ");
  switch (info.type) {
    case "big-stat":
      return `a huge dominant statistic in purple gradient, the number "${info.data[0].value}" rendered very large with the small caption "${info.data[0].label}" beneath it`;
    case "bar":
      return `a simple flat vertical bar chart with ${info.data.length} purple gradient bars, each bar labeled with exactly these values: ${dataList}. Value printed above each bar, label below. No axes, no gridlines`;
    case "donut":
      return `a flat donut/progress ring in purple gradient showing "${info.data[0].value}" as the filled portion, with "${info.data[0].value}" printed large in the center and the caption "${info.data[0].label}" beneath`;
    case "icon-stats":
      return `a vertical stack of ${info.data.length} rows, each row a small flat purple icon followed by a bold number and short label, exactly: ${dataList}`;
    case "comparison":
      return `a two-column comparison block divided by a thin purple line, showing exactly: ${dataList}. Left column vs right column, each with its label on top and value below`;
  }
}

function describePanel(panel: PanelPlan, index: number): string {
  const pos = index + 1;
  const lines: string[] = [];

  if (panel.role === "hook") {
    lines.push(
      `PANEL ${pos} (HOOK): The headline "${panel.headline}" rendered as the biggest text in the whole image, bold and attention-grabbing.`,
    );
    if (panel.support) lines.push(`Below it, one smaller supporting line: "${panel.support}".`);
  } else if (panel.role === "cta") {
    lines.push(
      `PANEL ${pos} (CTA): Large bold text "${panel.headline}" centered, with a simple purple arrow or pointer icon.`,
    );
  } else {
    lines.push(
      `PANEL ${pos} (CONTENT): Top-to-bottom sections in this exact order: large step number "${panel.step ?? String(pos - 1).padStart(2, "0")}" in purple, then the headline "${panel.headline}", then a thin purple divider line.`,
    );
    if (panel.infographic) {
      lines.push(`Below the divider, the panel's centerpiece infographic: ${describeInfographic(panel.infographic)}.`);
      if (panel.support) lines.push(`Beneath the infographic, one short supporting line: "${panel.support}".`);
    } else {
      if (panel.support) lines.push(`Below the divider, supporting text: "${panel.support}".`);
      if (panel.icon) lines.push(`At the bottom, a ${panel.icon}, flat vector style.`);
    }
  }

  return lines.join(" ");
}

function buildImagePrompt(plan: CarouselPlan, panelDescriptions: string): string {
  const count = plan.panels.length;
  const cutPoints = Array.from({ length: count - 1 }, (_, i) => `${Math.round(((i + 1) / count) * 100)}%`).join(", ");
  const palette =
    plan.background === "dark"
      ? "near-black background (#111827), pure white text, purple gradient accents (#7C3AED to #c084fc)"
      : "pure white background, near-black text (#0f172a), purple gradient accents (#7C3AED to #c084fc)";

  return `Ultra-wide 21:9 image containing exactly ${count} equal-width vertical portrait panels side by side, designed as a premium professional LinkedIn carousel. The image will be sliced into ${count} slides at exactly ${cutPoints} of the width, so every panel must be fully self-contained.

GLOBAL STYLE, identical across all ${count} panels: ${palette}. Thick, bold, heavy-weight modern geometric sans-serif typography (Inter-like / Montserrat-like), never thin, cursive, script, handwritten, serif, or decorative fonts. Premium, tech-forward, minimal, lots of breathing room. Flat vector icons and infographics only, all in one consistent line weight and style. Subtle continuous background gradient may flow across panels, but no text, icon, chart, or key element may cross or sit within 6% of a panel boundary — keep each boundary zone clean background only.

TYPOGRAPHY — every panel must mix font sizes boldly for strong visual contrast: one very large, thick, punchy headline or number, paired with clearly smaller labels and supporting text. Never make all text the same size. Headlines and key numbers should be heavy and dominant; labels and captions clearly lighter and smaller, but still readable on a phone.

ICONS — every panel must include at least one relevant flat vector icon or simple pictogram that visually represents THAT panel's specific topic (for example a rocket for growth, a shield for security, a bar chart for data, a lightbulb for an idea, a clock for speed). Icons must be simple, single-color or purple-gradient, in one consistent line weight across all panels, and clearly tied to that panel's text. These are concept icons only, never company logos, brand marks, or social-media icons.

LAYOUT CONSISTENCY — every panel shares the SAME invisible grid: identical outer margins on all sides, the same left text alignment, the same vertical rhythm, and headlines that start at the same height across panels. Text must never touch or crowd panel edges. Keep at most 3 text blocks per panel so nothing feels cramped.

TEXT ACCURACY — critical: render ONLY the exact texts quoted in the panel descriptions below, spelled exactly as written, and NOTHING else. No extra words, labels, captions, fine print, placeholder text, lorem ipsum, or gibberish characters anywhere. Every number must match its quoted value exactly.

FORBIDDEN — never include any of these anywhere in the image: logos, brand marks, watermarks, signatures, URLs, @ handles, QR codes, social media icons, profile pictures, avatars, user badges, or any real person's face or photo. Do not draw placeholders for them either (no empty circles, no "logo here" boxes, no "Logo" text). The real logo and profile badge are added by separate software afterward, so drawing your own would collide with them.

RESERVED ZONES — leave these completely empty background on EVERY panel so the composited branding never overlaps content: (1) the TOP-LEFT corner, roughly the top 18% of the panel height by the left 55% of the panel width, kept clear for a profile badge; (2) the BOTTOM-RIGHT corner, roughly the bottom 16% of the panel height by the right 40% of the panel width, kept clear for the brand logo. No text, numbers, icons, dividers, charts, or graphics may enter or touch either of these regions.

${panelDescriptions}`;
}

async function appendStyleReferences(prompt: string): Promise<string> {
  const styleDescriptions = await loadCarouselStyleReferences();
  if (!styleDescriptions.length) return prompt;
  return `${prompt}\n\nADDITIONAL STYLE REFERENCE NOTES from past carousels (follow where they don't conflict with the rules above):\n${styleDescriptions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
}

// --- Public API: carousel ---

export async function generateCarouselPrompt(
  topic: string,
  research: ResearchResult,
  carouselInstructions?: string,
): Promise<string> {
  const plan = await planCarousel(topic, research, carouselInstructions);
  const prompt = buildImagePrompt(plan, plan.panels.map(describePanel).join("\n\n"));
  return appendStyleReferences(prompt);
}

// --- Infographics mode: one content plan, rendered as 5 separate standalone
// images in 5 different visual styles so the author can pick a favorite.
// Each image is fully self-contained (not a panel of a larger strip), carries
// no profile badge, and gets only the brand logo composited on afterward. ---

interface InfographicContentPlan {
  headline: string;
  subheadline?: string;
  elements: InfographicSpec[];
  takeaway?: string;
}

const MAX_ELEMENTS = 3;

function validateContentPlan(raw: unknown): InfographicContentPlan {
  const plan = raw as Partial<InfographicContentPlan>;
  if (!plan.headline || typeof plan.headline !== "string") {
    throw new Error("infographic content plan is missing a headline");
  }
  if (!Array.isArray(plan.elements)) {
    throw new Error("infographic content plan returned no data elements");
  }

  const elements = plan.elements
    .filter(
      (e): e is InfographicSpec =>
        !!e && INFOGRAPHIC_TYPES.includes((e as InfographicSpec).type) && Array.isArray((e as InfographicSpec).data),
    )
    .map((e) => ({
      type: e.type,
      data: e.data.filter((d) => d && typeof d.label === "string" && typeof d.value === "string").slice(0, MAX_DATA_POINTS),
    }))
    .filter((e) => e.data.length > 0)
    .slice(0, MAX_ELEMENTS);

  if (elements.length === 0) {
    throw new Error("infographic content plan returned no valid data elements");
  }

  return {
    headline: plan.headline,
    subheadline: typeof plan.subheadline === "string" ? plan.subheadline : undefined,
    elements,
    takeaway: typeof plan.takeaway === "string" ? plan.takeaway : undefined,
  };
}

async function planInfographicContent(
  topic: string,
  research: ResearchResult,
  instructions?: string,
): Promise<InfographicContentPlan> {
  const [profile, feedback] = await Promise.all([loadProfile(), loadCarouselFeedback()]);

  const feedbackBlock = feedback ? feedback : "(no feedback notes yet)";
  const instructionsBlock =
    instructions && instructions.trim() ? instructions.trim() : "(no custom instructions provided)";

  const systemPrompt = `You are an expert data-visualization content planner. Plan the CONTENT for ONE LinkedIn infographic about a topic, as structured JSON. This same content will later be rendered as a single standalone image in several different visual styles, so your job is ONLY the content and the data, not visual styling.

BRAND / AUTHOR PROFILE:
${profile || "(no profile provided)"}

ACCUMULATED FEEDBACK FROM THE AUTHOR ON PAST VISUALS — apply these notes:
${feedbackBlock}

CUSTOM INSTRUCTIONS FROM THE AUTHOR for this infographic (take priority when they conflict with defaults):
${instructionsBlock}

WHAT TO RETURN:
- headline: the single sharpest headline for the topic, max 8 words.
- subheadline: optional one-line supporting context, max 12 words. Omit if not needed.
- elements: 1 to ${MAX_ELEMENTS} data elements, each grounded in a REAL figure from the research. Pick the type that best fits each figure:
  - "big-stat": one dominant number ("73%", "3x", "$2.4B").
  - "bar": 2-4 bars comparing values (growth over time, A-vs-B sizes).
  - "donut": one percentage as a progress ring (share/adoption/completion).
  - "icon-stats": 2-3 icon + number pairs (a cluster of small related figures).
  - "comparison": two-column before/after or myth/fact contrast.
- takeaway: optional single short closing line (a conclusion or call to think/act), max 10 words. Omit if not needed.

RULES:
- Use ONLY real figures from the research below. Never invent numbers.
- Keep every data label under 3 words and every value short ("73%", "12", "$2.4B") so it renders legibly.
- Never use an em dash or en dash anywhere.
- Simple plain language. No corporate jargon or buzzwords.
- Every string will be rendered inside an image, so keep it short and unambiguous.

Return strictly valid JSON, no markdown fences, in this exact shape:
{"headline": "...", "subheadline": "...", "elements": [{"type": "big-stat", "data": [{"label": "...", "value": "..."}]}], "takeaway": "..."}`;

  const userPrompt = `TOPIC / ROUGH IDEA:
${topic}

CURRENT RESEARCH / TREND CONTEXT (the ONLY source of figures):
${research.summary || "(no research available — keep elements minimal and figure-free)"}`;

  const client = getClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  return validateContentPlan(JSON.parse(content));
}

interface InfographicStyle {
  name: string;
  background: "dark" | "light";
  layout: string;
}

// 4 fixed, deterministic style directions. Same content, different
// composition, so the author can pick a favorite. Each style explicitly
// keeps every data element visible somewhere in the frame, just with a
// different visual hierarchy, so every option stays fully self-contained.
const INFOGRAPHIC_STYLES: InfographicStyle[] = [
  {
    name: "Bold Stat Poster",
    background: "dark",
    layout:
      "A poster-style hierarchy. The headline sits near the top in bold, then the single most important data element is enlarged as the dominant centerpiece filling the middle of the frame. Any remaining data elements sit below as a neat, evenly aligned row of smaller supporting stat blocks, so every element is visible but clearly secondary. Maximum impact, generous negative space, everything centered on a shared vertical axis.",
  },
  {
    name: "Clean Card Grid",
    background: "light",
    layout:
      "An editorial dashboard look. The headline across the top, subheadline just beneath it if present, then every data element shown as its own clean rounded rectangle card. Cards share identical size, corner radius, padding, and alignment, arranged in an evenly spaced grid with consistent gaps. Soft shadows, crisp, orderly.",
  },
  {
    name: "Vertical Flow",
    background: "dark",
    layout:
      "A clean readable list. The headline at the top left, then every data element stacked vertically in a single left-aligned column, each row separated by a thin full-width purple divider line, consistent row height and spacing top to bottom. Airy, calm, magazine-like.",
  },
  {
    name: "Circular Focus",
    background: "light",
    layout:
      "A balanced, symmetrical composition. The headline centered near the top, then a large circular or radial visual centered in the frame showing the most important data element. Any remaining data elements sit as small, equally-sized satellite blocks symmetrically arranged around the circle, so nothing is omitted. Everything centered on the middle axis.",
  },
];

function describeStylePanel(plan: InfographicContentPlan, style: InfographicStyle, index: number): string {
  const palette =
    style.background === "dark"
      ? "near-black background (#111827), pure white text, purple gradient accents (#7C3AED to #c084fc)"
      : "pure white background, near-black text (#0f172a), purple gradient accents (#7C3AED to #c084fc)";
  const elementDescriptions = plan.elements.map((e) => describeInfographic(e)).join("; ");

  return [
    `PANEL ${index + 1} — STYLE "${style.name}". Background for this panel only: ${palette}. ${style.layout}`,
    `Headline, exactly: "${plan.headline}".`,
    plan.subheadline ? `Subheadline, exactly: "${plan.subheadline}".` : null,
    `Data to visualize: ${elementDescriptions}.`,
    plan.takeaway ? `Closing takeaway line, exactly: "${plan.takeaway}".` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export const INFOGRAPHIC_SLIDE_COUNT = INFOGRAPHIC_STYLES.length;

function buildInfographicStripPrompt(plan: InfographicContentPlan): string {
  const count = INFOGRAPHIC_STYLES.length;
  const cutPoints = Array.from({ length: count - 1 }, (_, i) => `${Math.round(((i + 1) / count) * 100)}%`).join(", ");
  const panelDescriptions = INFOGRAPHIC_STYLES.map((style, i) => describeStylePanel(plan, style, i)).join("\n\n");

  return `Ultra-wide 21:9 image containing exactly ${count} equal-width vertical portrait panels side by side. Each panel is a COMPLETE, SELF-CONTAINED standalone LinkedIn infographic showing the SAME content in a DIFFERENT visual style, so the author can pick a favorite afterward. This is a style comparison sheet, not a sequence or story: panels do not build on each other. The image will be sliced into ${count} separate images at exactly ${cutPoints} of the width, so every panel must be fully self-contained with its own background and layout, never bleeding into neighboring panels.

GLOBAL RULES for every panel: thick, bold, heavy-weight modern geometric sans-serif typography (Inter-like / Montserrat-like), never thin, cursive, script, handwritten, serif, or decorative fonts. Premium, tech-forward, minimal mood. Flat vector icons and infographic elements only, one consistent line weight and style. High contrast between text and background. Each panel uses the SAME generous outer margin on all four sides and a tidy vertical rhythm with even spacing between elements. Nothing cramped, nothing touching the edges. No text, icon, chart, or key element may cross or sit within 6% of a panel boundary — keep each boundary zone clean background only, matching that panel's own background color right up to the edge.

TYPOGRAPHY — every panel must mix font sizes boldly for strong visual contrast: one very large, thick, punchy headline or number, paired with clearly smaller labels and supporting text. Never make all text the same size. Key numbers should be heavy and dominant; labels and captions clearly smaller, but still readable on a phone.

ICONS — every panel must include at least one relevant flat vector icon or simple pictogram that visually represents THAT panel's specific topic (for example a rocket for growth, a shield for security, a bar chart for data, a lightbulb for an idea, a clock for speed). Icons must be simple, single-color or purple-gradient, in one consistent line weight across all panels, and clearly tied to that panel's text. These are concept icons only, never company logos, brand marks, or social-media icons.

TEXT ACCURACY — critical: render ONLY the exact text and numbers quoted below, spelled exactly as written, and NOTHING else. No extra words, captions, fine print, placeholder text, lorem ipsum, or gibberish characters anywhere. Every number must match its quoted value exactly.

FORBIDDEN — never include any of these anywhere in the image: logos, brand marks, watermarks, signatures, URLs, @ handles, QR codes, social media icons, profile pictures, avatars, user badges, or any real person's face or photo. Do not draw placeholders for them either. The real brand logo is added by separate software afterward, so drawing your own would collide with it.

RESERVED ZONE on every panel: leave the BOTTOM-RIGHT corner completely empty background, roughly the bottom 16% of the panel height by the right 40% of the panel width, so the composited brand logo never overlaps content. No text, numbers, icons, dividers, charts, or graphics may enter or touch this region.

${panelDescriptions}`;
}

export async function generateInfographicPrompt(
  topic: string,
  research: ResearchResult,
  infographicInstructions?: string,
): Promise<string> {
  const plan = await planInfographicContent(topic, research, infographicInstructions);
  return buildInfographicStripPrompt(plan);
}
