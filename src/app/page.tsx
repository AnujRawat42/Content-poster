"use client";

import { useState } from "react";
import { CAROUSEL_OPTION, DROPDOWN_OPTIONS, INFOGRAPHIC_OPTION } from "@/lib/types";
import type { CarouselResponse, CreatePostResponse, DropdownOption } from "@/lib/types";
import CarouselView from "@/components/CarouselView";

export default function Home() {
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState<DropdownOption>(DROPDOWN_OPTIONS[0]);
  const [carouselInstructions, setCarouselInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatePostResponse | null>(null);
  const [carousel, setCarousel] = useState<CarouselResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [tweet, setTweet] = useState("");
  const [tweetLoading, setTweetLoading] = useState(false);
  const [tweetCopied, setTweetCopied] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionCopied, setCaptionCopied] = useState(false);

  const isCarousel = category === CAROUSEL_OPTION;
  const isInfographic = category === INFOGRAPHIC_OPTION;
  const isImageMode = isCarousel || isInfographic;

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCarousel(null);
    setTweet("");
    setCaption("");
    try {
      const endpoint = isCarousel
        ? "/api/create-carousel"
        : isInfographic
          ? "/api/create-infographics"
          : "/api/create-post";
      const payload = isCarousel
        ? { topic, carouselInstructions: carouselInstructions.trim() || undefined }
        : isInfographic
          ? { topic, infographicInstructions: carouselInstructions.trim() || undefined }
          : { topic, category };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "generation failed");
      if (isImageMode) {
        setCarousel(data);
        setCaption(data.caption ?? "");
      } else {
        setResult(data);
        setDraft(data.draft);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleCopyCaption() {
    await navigator.clipboard.writeText(caption);
    setCaptionCopied(true);
    setTimeout(() => setCaptionCopied(false), 1500);
  }

  async function handleRepurposeTwitter() {
    if (!draft.trim()) return;
    setTweetLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repurpose-twitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "twitter repurpose failed");
      setTweet(data.thread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setTweetLoading(false);
    }
  }

  async function handleCopyTweet() {
    await navigator.clipboard.writeText(tweet);
    setTweetCopied(true);
    setTimeout(() => setTweetCopied(false), 1500);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans">
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-8">
          LinkedIn Post Generator
        </h1>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Idea / topic / article / full context
            </label>
            <textarea
              className="w-full min-h-32 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm text-black dark:text-zinc-50"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Paste a rough idea, a topic, notes, or a full article..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Post type
            </label>
            <select
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-sm text-black dark:text-zinc-50"
              value={category}
              onChange={(e) => setCategory(e.target.value as DropdownOption)}
            >
              {DROPDOWN_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {isImageMode && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {isCarousel ? "Carousel instructions (optional)" : "Infographic instructions (optional)"}
              </label>
              <textarea
                className="w-full min-h-20 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm text-black dark:text-zinc-50"
                value={carouselInstructions}
                onChange={(e) => setCarouselInstructions(e.target.value)}
                placeholder={
                  isCarousel
                    ? "e.g. Minimalist design, bold colors, one stat per slide, focus on data-driven insights..."
                    : "e.g. Focus on adoption stats, one big number per slide, compare 2023 vs 2026..."
                }
              />
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="self-start rounded-full bg-black dark:bg-zinc-50 text-white dark:text-black px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading
              ? isImageMode
                ? "Researching + generating slides... (30-60s)"
                : "Researching + writing... (10-20s)"
              : "Generate"}
          </button>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {carousel && (
          <div className="mt-10 flex flex-col gap-4">
            <CarouselView slides={carousel.slides} />

            {carousel.caption && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Post caption
                  </label>
                  <button
                    onClick={handleCopyCaption}
                    className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50"
                  >
                    {captionCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <textarea
                  className="w-full min-h-48 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm text-black dark:text-zinc-50 whitespace-pre-wrap"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
            )}

            {carousel.research.sources.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400 font-medium">
                  Sources used ({carousel.research.sources.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {carousel.research.sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {s.title}
                      </a>
                      {s.publishedDate && (
                        <span className="text-zinc-500 dark:text-zinc-500"> — {s.publishedDate}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {result && (
          <div className="mt-10 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Draft
                </label>
                <button
                  onClick={handleCopy}
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <textarea
                className="w-full min-h-64 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm text-black dark:text-zinc-50 whitespace-pre-wrap"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>

            <div>
              <button
                onClick={handleRepurposeTwitter}
                disabled={tweetLoading || !draft.trim()}
                className="self-start rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {tweetLoading ? "Repurposing... (5-10s)" : "Repurpose for Twitter"}
              </button>
            </div>

            {tweet && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Twitter / X
                  </label>
                  <button
                    onClick={handleCopyTweet}
                    className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50"
                  >
                    {tweetCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <textarea
                  className="w-full min-h-48 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm text-black dark:text-zinc-50 whitespace-pre-wrap"
                  value={tweet}
                  onChange={(e) => setTweet(e.target.value)}
                />
              </div>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400 font-medium">
                Sources used ({result.research.sources.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {result.research.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {s.title}
                    </a>
                    {s.publishedDate && (
                      <span className="text-zinc-500 dark:text-zinc-500"> — {s.publishedDate}</span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
