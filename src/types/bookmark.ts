export interface BookmarkItem {
  id: string;
  type: 'bookmark' | 'folder';
  name: string;
  url?: string;
  favicon?: string;
  /** Родитель в дереве Chrome; для верхнего уровня панели закладок — тот же id, что у папки панели (`1`). */
  parentId: string | null;
  gridX: number;
  gridY: number;
  createdAt: number;
}

export interface FolderWindow {
  id: string;
  folderId: string;
  folderName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isMinimized: boolean;
  zIndex: number;
}

export type IconSize = 'small' | 'medium' | 'large';
export type SortMode = 'name' | 'date';

export interface DesktopSettings {
  wallpaper: string;
  iconSize: IconSize;
  sortMode: SortMode;
}

/** Позиция иконки на сетке; parentId должен совпадать с актуальным parentId закладки в Chrome. */
export interface IconPositionEntry {
  parentId: string;
  gridX: number;
  gridY: number;
}

export type IconPositionsMap = Record<string, IconPositionEntry>;
