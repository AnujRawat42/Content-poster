import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import OpenAI from "openai";

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

export async function repurposeTwitter(draft: string): Promise<{ thread: string }> {
  const profile = await loadProfile();

  const systemPrompt = `You repurpose a finished LinkedIn post into content for Twitter/X in the same author's voice.

BRAND / AUTHOR PROFILE:
${profile || "(no profile provided)"}

RULES:
- Rewrite the post as a Twitter/X thread. Keep the author's voice and the core ideas, but make it native to Twitter: punchier, tighter, no LinkedIn-style filler.
- Each tweet must be 280 characters or fewer.
- Number each tweet like "1/", "2/" at the start of its line. Separate tweets with one blank line.
- Open with a strong hook tweet. Do not open with "Thread:" or "A thread".
- If the post is short enough to work as one tweet, return a single tweet (still under 280 chars) with no numbering.
- Never use an em dash (—) or en dash (–). Use a period, comma, or new line instead.
- Use simple, plain language. No corporate jargon or buzzwords.
- Hashtags: at most one or two, only if they fit naturally. No @ mentions.

Output only the tweet text (numbered thread or single tweet). No preamble, no explanation, no markdown.`;

  const userPrompt = `LINKEDIN POST TO REPURPOSE:
${draft}`;

  const client = getClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  return { thread: stripDashes(raw) };
}

function stripDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".");
}
