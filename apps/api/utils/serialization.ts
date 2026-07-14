export function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function keysToSnakeCase<T>(value: T): T {
  if (!value || typeof value !== "object" || typeof value === "function" || value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(keysToSnakeCase) as T;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [camelToSnakeCase(key), keysToSnakeCase(val)]),
  ) as T;
}
