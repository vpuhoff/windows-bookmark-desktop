/** True when running inside an extension page with bookmarks API. */
export function hasExtensionBookmarks(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.bookmarks?.getTree;
}
