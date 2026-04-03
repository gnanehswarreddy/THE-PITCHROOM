function asPositiveInteger(value, fallback) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(numeric) || numeric < 1) return fallback;
  return numeric;
}

export function parsePagination(query = {}, defaults = { page: 1, pageSize: 10, maxPageSize: 50 }) {
  const page = asPositiveInteger(query.page, defaults.page);
  const pageSize = Math.min(asPositiveInteger(query.pageSize, defaults.pageSize), defaults.maxPageSize);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}
