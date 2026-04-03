import express from "express";

export function createPitchRoomRouter(controller) {
  const router = express.Router();

  router.post("/scripts", controller.createScript);
  router.get("/search", controller.searchHybrid);
  router.get("/search/vector", controller.searchVector);
  router.get("/recommendations/:userId", controller.getRecommendations);
  router.get("/scripts/relevant", controller.relevantScripts);
  router.post("/scripts/:scriptId/interactions", controller.trackInteraction);
  router.get("/scripts/trending", controller.trendingScripts);

  return router;
}
