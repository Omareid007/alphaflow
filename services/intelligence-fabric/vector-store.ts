/**
 * AI Active Trader - Vector Store
 * In-memory vector store with semantic search for AI analysis retrieval.
 * Designed for minimal storage - stores embeddings of summaries only.
 */

export interface VectorStoreConfig {
  dimensions: number;
  similarityThreshold: number;
}

interface VectorEntry {
  id: string;
  embedding: number[];
  text: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export class VectorStore {
  private config: VectorStoreConfig;
  private entries: Map<string, VectorEntry> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(config: Partial<VectorStoreConfig> = {}) {
    this.config = {
      dimensions: config.dimensions || 1536,
      similarityThreshold: config.similarityThreshold || 0.7,
    };
  }

  async upsert(
    id: string,
    text: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const embedding = await this.getEmbedding(text);

    this.entries.set(id, {
      id,
      embedding,
      text,
      metadata,
      createdAt: new Date(),
    });
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const queryEmbedding = await this.getEmbedding(query);

    const results: Array<{ entry: VectorEntry; score: number }> = [];

    for (const entry of this.entries.values()) {
      const score = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (score >= this.config.similarityThreshold) {
        results.push({ entry, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => ({
        id: r.entry.id,
        text: r.entry.text,
        score: r.score,
        metadata: r.entry.metadata,
      }));
  }

  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  get(id: string): VectorEntry | undefined {
    return this.entries.get(id);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.embeddingCache.clear();
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const cacheKey = this.hashText(text);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000),
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;

      if (this.embeddingCache.size < 1000) {
        this.embeddingCache.set(cacheKey, embedding);
      }

      return embedding;
    } catch (error) {
      return this.generateFallbackEmbedding(text);
    }
  }

  private generateFallbackEmbedding(text: string): number[] {
    const embedding = new Array(this.config.dimensions).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % this.config.dimensions;
        embedding[idx] += 1 / words.length;
      }
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  getStats(): {
    entryCount: number;
    cacheSize: number;
    avgTextLength: number;
  } {
    let totalLength = 0;
    for (const entry of this.entries.values()) {
      totalLength += entry.text.length;
    }

    return {
      entryCount: this.entries.size,
      cacheSize: this.embeddingCache.size,
      avgTextLength: this.entries.size > 0 ? totalLength / this.entries.size : 0,
    };
  }
}

export function createVectorStore(config?: Partial<VectorStoreConfig>): VectorStore {
  return new VectorStore(config);
}
