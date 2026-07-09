import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import OpenAI from "openai";
import { CATEGORY_GUIDANCE } from "./categoryGuidance";
import { retrieveReferences } from "./retrieveReferences";
import type { GenerateRequest } from "./types";

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

export async function generatePost(
  req: GenerateRequest,
): Promise<{ draft: string; referencesUsed: string[] }> {
  const [profile, references] = await Promise.all([
    loadProfile(),
    retrieveReferences(req.topic),
  ]);

  const referencesBlock = references.length
    ? references.map((r, i) => `--- Reference post ${i + 1} ---\n${r}`).join("\n\n")
    : "(no reference posts available yet)";

  const systemPrompt = `You are a ghostwriter producing a single LinkedIn post in this person's authentic voice.

BRAND / AUTHOR PROFILE:
${profile || "(no profile provided)"}

STYLE REFERENCE — these posts are from OTHER authors, written about unrelated topics and contexts. Use them ONLY to learn writing mechanics: hook style, line-break rhythm, sentence length, use of short punchy lines vs paragraphs, how lists/numbers are formatted, tone of voice. Do NOT reuse their facts, claims, stories, examples, or specific content in the new post — those belong to different people and different situations:
${referencesBlock}

${req.category ? `POST TYPE: ${req.category}\nSTRUCTURE GUIDANCE FOR THIS TYPE: ${CATEGORY_GUIDANCE[req.category]}` : "POST TYPE: a caption to accompany a set of images (a carousel or infographics) being posted alongside this text. Write a strong standalone LinkedIn post that hooks the reader and makes them want to look at the images. Do not say things like \"see slide 1\"; the post should read well on its own."}

HARD RULES:
- Never use an em dash (—) or en dash (–), anywhere, for any reason. Use a period, comma, or start a new line instead.
- Use simple, plain language. Short words over long ones, short sentences over long ones. Write for an easy, fast read, not to sound impressive.
- No corporate jargon or buzzwords (e.g. "leverage", "synergy", "unlock", "game-changer").

Write only the final LinkedIn post text. No preamble, no explanation, no markdown headers. Keep it native to LinkedIn (short paragraphs, line breaks between ideas).`;

  const userPrompt = `TOPIC / ROUGH IDEA FROM AUTHOR:
${req.topic}

CURRENT RESEARCH / TREND CONTEXT (use for factual grounding and relevance, cite naturally if useful, don't just list it):
${req.research.summary || "(no research available)"}`;

  const client = getClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
  });

  const rawDraft = completion.choices[0]?.message?.content?.trim() ?? "";
  const draft = stripDashes(rawDraft);
  return { draft, referencesUsed: references };
}

function stripDashes(text: string): string {
  // Model sometimes ignores the "no em/en dash" instruction — enforce it here too.
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".");
}
