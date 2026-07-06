import Exa from "exa-js";
import type { ResearchResult, ResearchSource } from "./types";

let client: Exa | null = null;

function getClient(): Exa {
  if (!client) {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) throw new Error("EXA_API_KEY is not set in .env.local");
    client = new Exa(apiKey);
  }
  return client;
}

const SIX_MONTHS_AGO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split("T")[0];
};

export async function researchTopic(topic: string): Promise<ResearchResult> {
  const exa = getClient();

  const result = await exa.searchAndContents(topic, {
    type: "auto",
    numResults: 8,
    startPublishedDate: SIX_MONTHS_AGO(),
    text: { maxCharacters: 1000 },
    highlights: { numSentences: 2, highlightsPerUrl: 1 },
  });

  const sources: ResearchSource[] = result.results.map((r) => ({
    title: r.title ?? r.url,
    url: r.url,
    snippet: r.highlights?.[0] ?? (r.text ?? "").slice(0, 300),
    publishedDate: r.publishedDate,
  }));

  const summary = sources
    .map((s, i) => `${i + 1}. ${s.title}${s.publishedDate ? ` (${s.publishedDate})` : ""}\n   ${s.snippet}`)
    .join("\n\n");

  return { summary, sources };
}
