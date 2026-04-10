import type { BookmarkItem } from '@/types/bookmark';
import type { BookmarkTreeNode } from '@/extension/bookmarksApi';
import { getFaviconUrlForPage } from '@/lib/favicon';

function isSeparator(node: BookmarkTreeNode): boolean {
  return (
    node.url === undefined &&
    (!node.title || node.title === '') &&
    (!node.children || node.children.length === 0)
  );
}

/** Обходит дерево Chrome и возвращает плоский список элементов (без корня 0). */
export function flattenBookmarkTree(roots: BookmarkTreeNode[]): BookmarkItem[] {
  const out: BookmarkItem[] = [];

  const visit = (node: BookmarkTreeNode, parentId: string) => {
    if (node.id === '0') {
      node.children?.forEach((ch) => visit(ch, '0'));
      return;
    }
    if (isSeparator(node)) return;

    const hasUrl = typeof node.url === 'string' && node.url.length > 0;
    const type = hasUrl ? 'bookmark' : 'folder';
    const createdAt = node.dateAdded ?? node.dateGroupModified ?? 0;
    const url = hasUrl ? node.url : undefined;
    const item: BookmarkItem = {
      id: node.id,
      type,
      name: node.title || (hasUrl ? url! : 'Без названия'),
      url,
      favicon: hasUrl && url ? getFaviconUrlForPage(url) : undefined,
      parentId,
      gridX: 0,
      gridY: 0,
      createdAt,
    };
    out.push(item);
    node.children?.forEach((ch) => visit(ch, node.id));
  };

  for (const root of roots) {
    if (root.id === '0') {
      root.children?.forEach((ch) => visit(ch, '0'));
    } else {
      visit(root, '0');
    }
  }
  return out;
}
