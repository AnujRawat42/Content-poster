export const POST_CATEGORIES = [
  "Personal stories",
  "Listicles",
  "Contrarian takes",
  "How-to guides",
  "Industry commentary",
  "Behind-the-scenes",
  "Thought experiments",
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface ResearchResult {
  summary: string;
  sources: ResearchSource[];
}

export interface GenerateRequest {
  topic: string;
  category: PostCategory;
  research: ResearchResult;
}

export interface CreatePostRequest {
  topic: string;
  category: PostCategory;
}

export interface CreatePostResponse {
  draft: string;
  research: ResearchResult;
  referencesUsed: string[];
}
