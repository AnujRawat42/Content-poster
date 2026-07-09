import { NextRequest, NextResponse } from "next/server";
import { appendCarouselFeedback } from "@/lib/carouselFeedback";

export async function POST(req: NextRequest) {
  const { feedback } = await req.json();

  if (!feedback || typeof feedback !== "string" || !feedback.trim()) {
    return NextResponse.json({ error: "feedback (non-empty string) is required" }, { status: 400 });
  }

  try {
    await appendCarouselFeedback(feedback);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("carousel-feedback route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to save feedback" },
      { status: 500 },
    );
  }
}
