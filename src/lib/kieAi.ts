import sharp from "sharp";

const BASE_URL = "https://api.kie.ai";
const MODEL = "nano-banana-2-lite";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180000;

function getApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error("KIE_API_KEY is not set in .env");
  return apiKey;
}

interface CreateTaskResponse {
  code: number;
  msg: string;
  data: { taskId: string };
}

interface RecordInfoResponse {
  code: number;
  data: {
    taskId: string;
    state: "waiting" | "queuing" | "generating" | "success" | "fail";
    resultJson?: string;
    failMsg?: string;
  };
}

async function createNanoBananaTask(prompt: string, aspectRatio: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        resolution: "2K",
        output_format: "png",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`kie.ai createTask failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as CreateTaskResponse;
  if (body.code !== 200) throw new Error(`kie.ai createTask error: ${body.msg}`);
  return body.data.taskId;
}

async function pollTaskUntilDone(taskId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    });

    if (!res.ok) {
      throw new Error(`kie.ai recordInfo failed: ${res.status} ${await res.text()}`);
    }

    const body = (await res.json()) as RecordInfoResponse;
    const { state } = body.data;

    if (state === "success") {
      const result = JSON.parse(body.data.resultJson ?? "{}") as { resultUrls?: string[] };
      const url = result.resultUrls?.[0];
      if (!url) throw new Error(`kie.ai task ${taskId} succeeded but returned no image URL`);
      return url;
    }

    if (state === "fail") {
      throw new Error(`kie.ai task ${taskId} failed: ${body.data.failMsg ?? "unknown error"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`kie.ai task ${taskId} timed out after ${POLL_TIMEOUT_MS}ms`);
}

export async function generateImage(prompt: string, aspectRatio = "21:9"): Promise<Buffer> {
  const taskId = await createNanoBananaTask(prompt, aspectRatio);
  const imageUrl = await pollTaskUntilDone(taskId);

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`failed to download generated image: ${imageRes.status}`);

  return Buffer.from(await imageRes.arrayBuffer());
}

async function sliceIntoSlides(wideImage: Buffer, slideCount: number): Promise<Buffer[]> {
  const { width, height } = await sharp(wideImage).metadata();
  if (!width || !height) throw new Error("could not read generated image dimensions");

  // Compute integer boundaries across the full width so the slices tile the
  // image exactly, with no lost or overlapping pixels even when the width is
  // not evenly divisible by slideCount (each boundary is rounded, and the last
  // slice runs to the true right edge).
  const bounds = Array.from({ length: slideCount + 1 }, (_, i) => Math.round((i * width) / slideCount));

  return Promise.all(
    Array.from({ length: slideCount }, (_, i) =>
      sharp(wideImage)
        .extract({ left: bounds[i], top: 0, width: bounds[i + 1] - bounds[i], height })
        .png()
        .toBuffer(),
    ),
  );
}

export interface CarouselImages {
  wideImage: Buffer;
  slides: Buffer[];
}

export async function generateCarouselSlides(prompt: string, slideCount = 4): Promise<CarouselImages> {
  const wideImage = await generateImage(prompt);
  const slides = await sliceIntoSlides(wideImage, slideCount);
  return { wideImage, slides };
}
