export function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function normalizeResponse<T>(value: T): T {
  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (!value || typeof value !== "object" || typeof value === "function") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeResponse) as T;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [camelToSnakeCase(key), normalizeResponse(val)]),
  ) as T;
}
