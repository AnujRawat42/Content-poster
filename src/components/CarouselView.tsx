"use client";

import { useState } from "react";
import JSZip from "jszip";

export default function CarouselView({ slides }: { slides: string[] }) {
  const [index, setIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved">("idle");

  function goPrev() {
    setIndex((i) => (i === 0 ? slides.length - 1 : i - 1));
  }

  function goNext() {
    setIndex((i) => (i === slides.length - 1 ? 0 : i + 1));
  }

  async function handleDownloadAll() {
    setDownloading(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        slides.map(async (url, i) => {
          const res = await fetch(url);
          const blob = await res.blob();
          zip.file(`slide-${i + 1}.png`, blob);
        }),
      );
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = "carousel.zip";
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setDownloading(false);
    }
  }

  async function handleSubmitFeedback() {
    if (!feedback.trim()) return;
    setFeedbackStatus("saving");
    try {
      const res = await fetch("/api/carousel-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) throw new Error("failed to save feedback");
      setFeedback("");
      setFeedbackStatus("saved");
      setTimeout(() => setFeedbackStatus("idle"), 1500);
    } catch {
      setFeedbackStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex items-center justify-center">
        <button
          onClick={goPrev}
          aria-label="Previous slide"
          className="absolute left-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-lg"
        >
          {"<"}
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slides[index]}
          alt={`Carousel slide ${index + 1}`}
          className="max-w-full rounded-lg border border-zinc-300 dark:border-zinc-700"
        />

        <button
          onClick={goNext}
          aria-label="Next slide"
          className="absolute right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-lg"
        >
          {">"}
        </button>
      </div>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        {index + 1} / {slides.length}
      </p>

      <button
        onClick={handleDownloadAll}
        disabled={downloading}
        className="self-center rounded-full bg-black dark:bg-zinc-50 text-white dark:text-black px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {downloading ? "Zipping..." : "Download all"}
      </button>

      <div className="mt-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Feedback for the carousel agent
        </label>
        <textarea
          className="w-full min-h-20 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm text-black dark:text-zinc-50"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="e.g. Use bigger headline text, less busy backgrounds, more contrast on slide 5..."
        />
        <button
          onClick={handleSubmitFeedback}
          disabled={feedbackStatus === "saving" || !feedback.trim()}
          className="mt-2 rounded-full border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {feedbackStatus === "saving" ? "Saving..." : feedbackStatus === "saved" ? "Saved!" : "Submit feedback"}
        </button>
      </div>
    </div>
  );
}
