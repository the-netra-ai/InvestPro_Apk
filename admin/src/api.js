export const API = import.meta.env.DEV ? "" : "https://invpro.onrender.com";

function looksLikeHtml(value) {
  return typeof value === "string" && /<!doctype html>|<html[\s>]|<body[\s>]/i.test(value);
}

function sanitizeMessage(message, fallback) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return fallback;
  if (looksLikeHtml(text)) return fallback;
  if (/[<>]/.test(text)) return fallback;
  return text;
}

export async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  const rawText = await res.text();
  let data = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }
  }

  if (!res.ok || data?.success === false) {
    const fallback = res.status >= 500
      ? "Server error. Please try again in a few minutes."
      : `Request failed (${res.status})`;
    throw new Error(sanitizeMessage(data?.message, fallback));
  }

  return data;
}
