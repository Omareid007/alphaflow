import { Router, Request, Response } from "express";
import { jina } from "../connectors/jina";
import { log } from "../utils/logger";

const router = Router();

router.post("/embeddings", async (req: Request, res: Response) => {
  try {
    const { input, model, task, dimensions } = req.body;
    if (!input) {
      return res.status(400).json({ error: "input is required" });
    }
    const result = await jina.generateEmbeddings(input, {
      model,
      task,
      dimensions,
    });
    res.json(result);
  } catch (error) {
    log.error("JinaRoutes", `Embeddings error: ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

router.get("/read", async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url query parameter is required" });
    }
    const normalizedUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;
    const result = await jina.readUrl(normalizedUrl);
    res.json(result);
  } catch (error) {
    log.error("JinaRoutes", `Reader error: ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

router.get("/search", async (req: Request, res: Response) => {
  try {
    const { query, limit } = req.query;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query parameter is required" });
    }
    const result = await jina.search(query, {
      limit: limit ? parseInt(limit as string, 10) : 5,
    });
    res.json(result);
  } catch (error) {
    log.error("JinaRoutes", `Search error: ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

router.post("/rerank", async (req: Request, res: Response) => {
  try {
    const { query, documents, model, top_n } = req.body;
    if (!query || !documents || !Array.isArray(documents)) {
      return res
        .status(400)
        .json({ error: "query and documents array are required" });
    }
    const result = await jina.rerank(query, documents, { model, top_n });
    res.json(result);
  } catch (error) {
    log.error("JinaRoutes", `Rerank error: ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

router.post("/semantic-search", async (req: Request, res: Response) => {
  try {
    const { query, corpus, topK } = req.body;
    if (!query || !corpus || !Array.isArray(corpus)) {
      return res
        .status(400)
        .json({ error: "query and corpus array are required" });
    }
    if (corpus.length > 100) {
      return res
        .status(413)
        .json({ error: "corpus exceeds maximum size of 100 documents" });
    }
    if (query.length > 10000) {
      return res
        .status(413)
        .json({ error: "query exceeds maximum length of 10000 characters" });
    }
    const result = await jina.semanticSearch(query, corpus, { topK });
    res.json(result);
  } catch (error) {
    log.error("JinaRoutes", `Semantic search error: ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

router.get("/health", async (_req: Request, res: Response) => {
  const hasKey = !!process.env.JINA_API_KEY;
  res.json({
    status: hasKey ? "configured" : "missing_api_key",
    provider: "jina",
    capabilities: [
      "embeddings",
      "reader",
      "search",
      "rerank",
      "semantic-search",
    ],
  });
});

export default router;
