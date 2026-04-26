export const API = import.meta.env.DEV ? "" : "https://invpro.onrender.com";

export async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) throw new Error(data.message || "API error");
  return data;
}
