/** Chrome: панель закладок (Bookmarks bar). */
export const DESKTOP_PARENT_ID = '1';

/** Chrome: «Другие закладки» (Other bookmarks). */
export const OTHER_BOOKMARKS_FOLDER_ID = '2';

/** Верхний уровень рабочего стола: прямые потомки панели и «Других закладок». */
export function isDesktopSurfaceParent(parentId: string | null | undefined): boolean {
  const p = parentId ?? DESKTOP_PARENT_ID;
  return p === DESKTOP_PARENT_ID || p === OTHER_BOOKMARKS_FOLDER_ID;
}
