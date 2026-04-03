import { ObjectId } from "mongodb";

export function normalizeDoc(doc) {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(normalizeDoc);

  const normalized = { ...doc };

  if (normalized._id) {
    const id = normalized._id.toString();
    normalized._id = id;
    if (normalized.id === undefined) {
      normalized.id = id;
    }
  }

  for (const [key, value] of Object.entries(normalized)) {
    if (value instanceof ObjectId) normalized[key] = value.toString();
    if (Array.isArray(value)) {
      normalized[key] = value.map((entry) => (entry instanceof ObjectId ? entry.toString() : entry));
    }
  }

  return normalized;
}
