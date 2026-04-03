export function createGetRelevantScripts(searchService) {
  return async function getRelevantScripts(query, options = {}) {
    if (!String(query || "").trim()) {
      throw new Error("query is required");
    }

    return searchService.vectorSearch(query, {
      page: options.page || 1,
      pageSize: options.pageSize || 10,
    });
  };
}
