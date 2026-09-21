let csrf = "";
export const BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ||
  "https://plan2field-backend.onrender.com/api"
).replace(/\/+$/, "");
export function apiUrl(path) {
  return BASE_URL + "/" + path.replace(/^\/+/, "");
}
export function setCsrf(value) {
  csrf = value || "";
}
export async function api(path, options = {}) {
  const form = options.body instanceof FormData;
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      ...(!form && options.body ? { "Content-Type": "application/json" } : {}),
      ...(csrf && options.method && options.method !== "GET"
        ? { "X-CSRF-Token": csrf }
        : {}),
      ...options.headers,
    },
    body: options.body
      ? form
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  });
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (
    !contentType.includes("application/json") &&
    !contentType.includes("+json")
  )
    throw Object.assign(
      new Error(
        `The API returned a non-JSON response (HTTP ${response.status}). Check VITE_API_BASE_URL and backend availability.`,
      ),
      { status: response.status, code: "INVALID_API_RESPONSE" },
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw Object.assign(
      new Error(
        "The API returned invalid JSON. Please retry when the backend is available.",
      ),
      { status: response.status, code: "INVALID_API_RESPONSE" },
    );
  }
  if (!response.ok)
    throw Object.assign(
      new Error(
        data?.message || `API request failed (HTTP ${response.status}).`,
      ),
      data,
      {
        status: response.status,
      },
    );
  return data;
}
