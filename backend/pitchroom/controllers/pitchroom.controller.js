import { parsePagination } from "../utils/pagination.js";

function parsePageQuery(query) {
  return parsePagination(query, { page: 1, pageSize: 10, maxPageSize: 50 });
}

export function createPitchRoomController({ scriptService, searchService, recommendationService, getRelevantScripts }) {
  return {
    createScript: async (req, res) => {
      try {
        const authorId = req.user?.id || req.body.authorId;
        if (!authorId) {
          return res.status(401).json({ error: "Unauthorized or missing authorId" });
        }

        const script = await scriptService.createScript({
          ...req.body,
          authorId,
        });

        return res.status(201).json({ data: script, error: null });
      } catch (error) {
        return res.status(400).json({ data: null, error: error.message || "Failed to create script" });
      }
    },

    searchHybrid: async (req, res) => {
      try {
        const query = String(req.query.query || "").trim();
        if (!query) {
          return res.status(400).json({ data: null, error: "query is required" });
        }

        const { page, pageSize } = parsePageQuery(req.query);
        const result = await searchService.hybridSearch(query, { page, pageSize });
        return res.json({ data: result.items, meta: { total: result.total, page, pageSize }, error: null });
      } catch (error) {
        return res.status(500).json({ data: null, error: error.message || "Search failed" });
      }
    },

    searchVector: async (req, res) => {
      try {
        const query = String(req.query.query || "").trim();
        if (!query) {
          return res.status(400).json({ data: null, error: "query is required" });
        }

        const { page, pageSize } = parsePageQuery(req.query);
        const result = await searchService.vectorSearch(query, { page, pageSize });
        return res.json({ data: result.items, meta: { total: result.total, page, pageSize }, error: null });
      } catch (error) {
        return res.status(500).json({ data: null, error: error.message || "Vector search failed" });
      }
    },

    getRecommendations: async (req, res) => {
      try {
        const userId = String(req.params.userId || "").trim();
        if (!userId) {
          return res.status(400).json({ data: null, error: "userId is required" });
        }

        const { page, pageSize } = parsePageQuery(req.query);
        const result = await recommendationService.getRecommendations(userId, { page, pageSize });

        return res.json({ data: result.items, meta: { total: result.total, page, pageSize }, error: null });
      } catch (error) {
        return res.status(500).json({ data: null, error: error.message || "Failed to load recommendations" });
      }
    },

    relevantScripts: async (req, res) => {
      try {
        const query = String(req.query.query || "").trim();
        if (!query) {
          return res.status(400).json({ data: null, error: "query is required" });
        }

        const { page, pageSize } = parsePageQuery(req.query);
        const result = await getRelevantScripts(query, { page, pageSize });

        return res.json({ data: result.items, meta: { total: result.total, page, pageSize }, error: null });
      } catch (error) {
        return res.status(500).json({ data: null, error: error.message || "Failed to get relevant scripts" });
      }
    },

    trackInteraction: async (req, res) => {
      try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) {
          return res.status(401).json({ data: null, error: "Unauthorized or missing userId" });
        }

        const result = await scriptService.trackInteraction({
          userId,
          scriptId: req.params.scriptId,
          type: req.body.type,
        });

        return res.json({ data: result, error: null });
      } catch (error) {
        return res.status(400).json({ data: null, error: error.message || "Failed to track interaction" });
      }
    },

    trendingScripts: async (req, res) => {
      try {
        const { page, pageSize } = parsePageQuery(req.query);
        const result = await searchService.getTrendingScripts({ page, pageSize });
        return res.json({ data: result.items, meta: { total: result.total, page, pageSize }, error: null });
      } catch (error) {
        return res.status(500).json({ data: null, error: error.message || "Failed to get trending scripts" });
      }
    },
  };
}
