/** MIME для списка id закладок при drag нескольких иконок. */
export const BOOKMARK_DRAG_IDS_MIME = 'application/x-windesk-bookmark-ids';

export function setBookmarkDragData(
  e: React.DragEvent,
  item: { id: string },
  selectedIds: string[],
): void {
  const ids =
    selectedIds.length > 0 && selectedIds.includes(item.id) ? [...selectedIds] : [item.id];
  e.dataTransfer.setData(BOOKMARK_DRAG_IDS_MIME, JSON.stringify(ids));
  e.dataTransfer.setData('text/plain', item.id);
  e.dataTransfer.effectAllowed = 'move';
}

export function getBookmarkDragIds(e: React.DragEvent): string[] {
  try {
    const raw = e.dataTransfer.getData(BOOKMARK_DRAG_IDS_MIME);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  const one = e.dataTransfer.getData('text/plain');
  return one ? [one] : [];
}
