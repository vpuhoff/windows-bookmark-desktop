import { hasExtensionBookmarks } from '@/extension/env';

/** Favicon URL for extension (chrome.favicon) or fallback for dev. */
export function getFaviconUrlForPage(pageUrl: string, size = 32): string | undefined {
  if (!pageUrl) return undefined;
  try {
    const u = new URL(pageUrl);
    if (hasExtensionBookmarks() && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(
        `_favicon/?pageUrl=${encodeURIComponent(u.href)}&size=${size}`,
      );
    }
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return undefined;
  }
}
