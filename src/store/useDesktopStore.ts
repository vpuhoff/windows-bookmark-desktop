import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BookmarkItem, FolderWindow, DesktopSettings, IconSize, SortMode } from '@/types/bookmark';

const generateId = () => crypto.randomUUID();

interface DesktopStore {
  items: BookmarkItem[];
  windows: FolderWindow[];
  settings: DesktopSettings;
  selectedIds: string[];
  nextZIndex: number;

  // Items
  addBookmark: (name: string, url: string, parentId: string | null, gridX?: number, gridY?: number) => void;
  addFolder: (name: string, parentId: string | null, gridX?: number, gridY?: number) => void;
  removeItem: (id: string) => void;
  renameItem: (id: string, name: string) => void;
  updateItem: (id: string, updates: Partial<BookmarkItem>) => void;
  moveItem: (id: string, parentId: string | null, gridX: number, gridY: number) => void;
  getChildren: (parentId: string | null) => BookmarkItem[];

  // Selection
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;

  // Windows
  openFolder: (folderId: string, folderName: string) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;

  // Settings
  setWallpaper: (wallpaper: string) => void;
  setIconSize: (size: IconSize) => void;
  setSortMode: (mode: SortMode) => void;

  // find next free grid position
  findFreePosition: (parentId: string | null) => { gridX: number; gridY: number };
}

export const useDesktopStore = create<DesktopStore>()(
  persist(
    (set, get) => ({
      items: [
        { id: generateId(), type: 'folder', name: 'Избранное', parentId: null, gridX: 0, gridY: 0, createdAt: Date.now() },
        { id: generateId(), type: 'folder', name: 'Работа', parentId: null, gridX: 0, gridY: 1, createdAt: Date.now() },
        { id: generateId(), type: 'bookmark', name: 'Google', url: 'https://google.com', favicon: 'https://www.google.com/favicon.ico', parentId: null, gridX: 0, gridY: 2, createdAt: Date.now() },
        { id: generateId(), type: 'bookmark', name: 'GitHub', url: 'https://github.com', favicon: 'https://github.com/favicon.ico', parentId: null, gridX: 0, gridY: 3, createdAt: Date.now() },
      ],
      windows: [],
      settings: {
        wallpaper: '/images/wallpaper-default.jpg',
        iconSize: 'medium',
        sortMode: 'name',
      },
      selectedIds: [],
      nextZIndex: 100,

      addBookmark: (name, url, parentId, gridX, gridY) => {
        const pos = gridX !== undefined && gridY !== undefined
          ? { gridX, gridY }
          : get().findFreePosition(parentId);
        const favicon = (() => {
          try {
            const u = new URL(url);
            return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
          } catch { return undefined; }
        })();
        set(s => ({
          items: [...s.items, { id: generateId(), type: 'bookmark', name, url, favicon, parentId, ...pos, createdAt: Date.now() }]
        }));
      },

      addFolder: (name, parentId, gridX, gridY) => {
        const pos = gridX !== undefined && gridY !== undefined
          ? { gridX, gridY }
          : get().findFreePosition(parentId);
        set(s => ({
          items: [...s.items, { id: generateId(), type: 'folder', name, parentId, ...pos, createdAt: Date.now() }]
        }));
      },

      removeItem: (id) => {
        const removeRecursive = (items: BookmarkItem[], targetId: string): BookmarkItem[] => {
          const children = items.filter(i => i.parentId === targetId);
          let result = items.filter(i => i.id !== targetId);
          for (const child of children) {
            result = removeRecursive(result, child.id);
          }
          return result;
        };
        set(s => ({ items: removeRecursive(s.items, id), windows: s.windows.filter(w => w.folderId !== id) }));
      },

      renameItem: (id, name) => set(s => ({
        items: s.items.map(i => i.id === id ? { ...i, name } : i)
      })),

      updateItem: (id, updates) => set(s => ({
        items: s.items.map(i => i.id === id ? { ...i, ...updates } : i)
      })),

      moveItem: (id, parentId, gridX, gridY) => set(s => ({
        items: s.items.map(i => i.id === id ? { ...i, parentId, gridX, gridY } : i)
      })),

      getChildren: (parentId) => {
        const s = get();
        let items = s.items.filter(i => i.parentId === parentId);
        if (s.settings.sortMode === 'name') {
          items.sort((a, b) => a.name.localeCompare(b.name));
        } else {
          items.sort((a, b) => a.createdAt - b.createdAt);
        }
        return items;
      },

      setSelectedIds: (ids) => set({ selectedIds: ids }),
      clearSelection: () => set({ selectedIds: [] }),

      openFolder: (folderId, folderName) => {
        const existing = get().windows.find(w => w.folderId === folderId);
        if (existing) {
          get().focusWindow(existing.id);
          if (existing.isMinimized) {
            set(s => ({ windows: s.windows.map(w => w.id === existing.id ? { ...w, isMinimized: false } : w) }));
          }
          return;
        }
        const nz = get().nextZIndex;
        set(s => ({
          windows: [...s.windows, {
            id: generateId(),
            folderId,
            folderName,
            x: 200 + s.windows.length * 30,
            y: 100 + s.windows.length * 30,
            width: 700,
            height: 500,
            isMaximized: false,
            isMinimized: false,
            zIndex: nz,
          }],
          nextZIndex: nz + 1,
        }));
      },

      closeWindow: (id) => set(s => ({ windows: s.windows.filter(w => w.id !== id) })),

      minimizeWindow: (id) => set(s => ({
        windows: s.windows.map(w => w.id === id ? { ...w, isMinimized: true } : w)
      })),

      maximizeWindow: (id) => set(s => ({
        windows: s.windows.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w)
      })),

      focusWindow: (id) => {
        const nz = get().nextZIndex;
        set(s => ({
          windows: s.windows.map(w => w.id === id ? { ...w, zIndex: nz, isMinimized: false } : w),
          nextZIndex: nz + 1,
        }));
      },

      moveWindow: (id, x, y) => set(s => ({
        windows: s.windows.map(w => w.id === id ? { ...w, x, y } : w)
      })),

      resizeWindow: (id, width, height) => set(s => ({
        windows: s.windows.map(w => w.id === id ? { ...w, width, height } : w)
      })),

      setWallpaper: (wallpaper) => set(s => ({ settings: { ...s.settings, wallpaper } })),
      setIconSize: (iconSize) => set(s => ({ settings: { ...s.settings, iconSize } })),
      setSortMode: (sortMode) => set(s => ({ settings: { ...s.settings, sortMode } })),

      findFreePosition: (parentId) => {
        const items = get().items.filter(i => i.parentId === parentId);
        const occupied = new Set(items.map(i => `${i.gridX},${i.gridY}`));
        for (let x = 0; x < 20; x++) {
          for (let y = 0; y < 20; y++) {
            if (!occupied.has(`${x},${y}`)) return { gridX: x, gridY: y };
          }
        }
        return { gridX: 0, gridY: 0 };
      },
    }),
    { name: 'windesk-bookmarks' }
  )
);
