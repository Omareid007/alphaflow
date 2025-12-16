import { connectorFetch, buildCacheKey } from "../lib/connectorClient";
import { log } from "../utils/logger";

const JINA_EMBEDDINGS_URL = "https://api.jina.ai/v1/embeddings";
const JINA_READER_URL = "https://r.jina.ai";
const JINA_SEARCH_URL = "https://s.jina.ai";
const JINA_RERANK_URL = "https://api.jina.ai/v1/rerank";

export interface JinaEmbeddingRequest {
  input: string | string[];
  model?: "jina-embeddings-v3" | "jina-embeddings-v2-base-en";
  task?: "retrieval.query" | "retrieval.passage" | "separation" | "classification" | "text-matching";
  dimensions?: number;
  late_chunking?: boolean;
  normalized?: boolean;
}

export interface JinaEmbeddingResponse {
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  data: {
    object: string;
    index: number;
    embedding: number[];
  }[];
}

export interface JinaReaderResponse {
  title: string;
  url: string;
  content: string;
  description?: string;
  images?: {
    src: string;
    alt?: string;
  }[];
  links?: {
    href: string;
    text: string;
  }[];
}

export interface JinaSearchResult {
  title: string;
  url: string;
  content: string;
  description?: string;
}

export interface JinaSearchResponse {
  results: JinaSearchResult[];
  query: string;
}

export interface JinaRerankRequest {
  model?: "jina-reranker-v2-base-multilingual" | "jina-reranker-v1-base-en";
  query: string;
  documents: string[] | { text: string }[];
  top_n?: number;
  return_documents?: boolean;
}

export interface JinaRerankResponse {
  model: string;
  usage: {
    total_tokens: number;
  };
  results: {
    index: number;
    relevance_score: number;
    document?: { text: string };
  }[];
}

function getApiKey(): string {
  const key = process.env.JINA_API_KEY;
  if (!key) {
    throw new Error("JINA_API_KEY not configured");
  }
  return key;
}

function getAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

export async function generateEmbeddings(
  input: string | string[],
  options: {
    model?: JinaEmbeddingRequest["model"];
    task?: JinaEmbeddingRequest["task"];
    dimensions?: number;
  } = {}
): Promise<JinaEmbeddingResponse> {
  const { model = "jina-embeddings-v3", task = "retrieval.passage", dimensions } = options;

  const cacheKey = buildCacheKey(
    "jina",
    "embeddings",
    model,
    task,
    dimensions?.toString(),
    typeof input === "string" ? input.slice(0, 100) : `batch-${input.length}`
  );

  const body: JinaEmbeddingRequest = {
    input,
    model,
    task,
    normalized: true,
  };
  if (dimensions) body.dimensions = dimensions;

  try {
    const result = await connectorFetch<JinaEmbeddingResponse>(JINA_EMBEDDINGS_URL, {
      provider: "jina",
      endpoint: "embeddings",
      cacheKey,
      headers: getAuthHeaders(),
      method: "POST",
      body,
      customTTLMs: 86400000,
    });

    log.info("Jina", `Generated ${result.data.data.length} embeddings (${result.data.usage.total_tokens} tokens)`);
    return result.data;
  } catch (error) {
    log.error("Jina", `Embeddings error: ${error}`);
    throw error;
  }
}

export async function readUrl(url: string): Promise<JinaReaderResponse> {
  const cacheKey = buildCacheKey("jina", "reader", url);
  const readerUrl = `${JINA_READER_URL}/${url}`;

  try {
    const result = await connectorFetch<JinaReaderResponse>(readerUrl, {
      provider: "jina",
      endpoint: "reader",
      cacheKey,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        Accept: "application/json",
        "X-Return-Format": "json",
      },
      method: "GET",
      customTTLMs: 3600000,
    });

    log.info("Jina", `Read URL: ${url} (${result.data.content?.length || 0} chars)`);
    return result.data;
  } catch (error) {
    log.error("Jina", `Reader error for ${url}: ${error}`);
    throw error;
  }
}

export async function search(query: string, options: { limit?: number } = {}): Promise<JinaSearchResponse> {
  const { limit = 5 } = options;
  const cacheKey = buildCacheKey("jina", "search", query, limit.toString());
  const searchUrl = `${JINA_SEARCH_URL}/${encodeURIComponent(query)}`;

  try {
    const result = await connectorFetch<JinaSearchResponse>(searchUrl, {
      provider: "jina",
      endpoint: "search",
      cacheKey,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        Accept: "application/json",
        "X-Return-Format": "json",
      },
      method: "GET",
      customTTLMs: 1800000,
    });

    log.info("Jina", `Search: "${query}" returned ${result.data.results?.length || 0} results`);
    return result.data;
  } catch (error) {
    log.error("Jina", `Search error for "${query}": ${error}`);
    throw error;
  }
}

export async function rerank(
  query: string,
  documents: string[],
  options: { model?: JinaRerankRequest["model"]; top_n?: number } = {}
): Promise<JinaRerankResponse> {
  const { model = "jina-reranker-v2-base-multilingual", top_n = 10 } = options;

  const cacheKey = buildCacheKey("jina", "rerank", query.slice(0, 50), documents.length.toString());

  const body: JinaRerankRequest = {
    model,
    query,
    documents,
    top_n: Math.min(top_n, documents.length),
    return_documents: true,
  };

  try {
    const result = await connectorFetch<JinaRerankResponse>(JINA_RERANK_URL, {
      provider: "jina",
      endpoint: "rerank",
      cacheKey,
      headers: getAuthHeaders(),
      method: "POST",
      body,
      customTTLMs: 86400000,
    });

    log.info("Jina", `Reranked ${documents.length} docs, top score: ${result.data.results[0]?.relevance_score?.toFixed(3)}`);
    return result.data;
  } catch (error) {
    log.error("Jina", `Rerank error: ${error}`);
    throw error;
  }
}

export async function semanticSearch(
  query: string,
  corpus: { id: string; text: string }[],
  options: { topK?: number } = {}
): Promise<{ id: string; text: string; score: number }[]> {
  const { topK = 5 } = options;

  const queryEmbedding = await generateEmbeddings(query, { task: "retrieval.query" });
  const queryVector = queryEmbedding.data[0].embedding;

  const corpusTexts = corpus.map((c) => c.text);
  const corpusEmbeddings = await generateEmbeddings(corpusTexts, { task: "retrieval.passage" });

  const similarities: { id: string; text: string; score: number }[] = corpus.map((doc, i) => {
    const docVector = corpusEmbeddings.data[i].embedding;
    const score = cosineSimilarity(queryVector, docVector);
    return { id: doc.id, text: doc.text, score };
  });

  similarities.sort((a, b) => b.score - a.score);
  return similarities.slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const jina = {
  generateEmbeddings,
  readUrl,
  search,
  rerank,
  semanticSearch,
};

export default jina;
