export interface BookmarkItem {
  id: string;
  type: 'bookmark' | 'folder';
  name: string;
  url?: string;
  favicon?: string;
  parentId: string | null; // null = desktop
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
