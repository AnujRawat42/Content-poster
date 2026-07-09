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

export const CAROUSEL_OPTION = "4-Slide Carousel" as const;

export const INFOGRAPHIC_OPTION = "Infographics" as const;

export const DROPDOWN_OPTIONS = [...POST_CATEGORIES, CAROUSEL_OPTION, INFOGRAPHIC_OPTION] as const;

export type DropdownOption = (typeof DROPDOWN_OPTIONS)[number];

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
  category?: PostCategory;
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

export interface RepurposeTwitterRequest {
  draft: string;
}

export interface RepurposeTwitterResponse {
  thread: string;
}

export interface CreateCarouselRequest {
  topic: string;
  carouselInstructions?: string;
}

export interface CreateInfographicRequest {
  topic: string;
  infographicInstructions?: string;
}

export interface CarouselResponse {
  sessionId: string;
  slides: string[];
  research: ResearchResult;
  caption: string;
}
