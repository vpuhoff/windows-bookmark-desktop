import { create } from 'zustand';
import { toast } from 'sonner';
import {
  BookmarkItem,
  FolderWindow,
  DesktopSettings,
  IconSize,
  SortMode,
  IconPositionsMap,
} from '@/types/bookmark';
import { bookmarksApi } from '@/extension/bookmarksApi';
import { storageLocal } from '@/extension/storageApi';
import {
  DESKTOP_PARENT_ID,
  OTHER_BOOKMARKS_FOLDER_ID,
  isDesktopSurfaceParent,
} from '@/extension/constants';
import { flattenBookmarkTree } from '@/lib/bookmarkTree';
import { findFreeGridSlot, getMaxGridColumns } from '@/lib/desktopGrid';

const generateWindowId = () => crypto.randomUUID();

const DEFAULT_SETTINGS: DesktopSettings = {
  wallpaper: '/placeholder.svg',
  iconSize: 'medium',
  sortMode: 'name',
};

function mergeSettings(raw: Partial<DesktopSettings> | undefined): DesktopSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    wallpaper: typeof raw.wallpaper === 'string' ? raw.wallpaper : DEFAULT_SETTINGS.wallpaper,
    iconSize: (raw.iconSize as IconSize) ?? DEFAULT_SETTINGS.iconSize,
    sortMode: (raw.sortMode as SortMode) ?? DEFAULT_SETTINGS.sortMode,
  };
}

function resolveParentId(parentId: string | null | undefined): string {
  return parentId ?? DESKTOP_PARENT_ID;
}

function ensureOcc(map: Map<string, Set<string>>, pid: string): Set<string> {
  if (!map.has(pid)) map.set(pid, new Set());
  return map.get(pid)!;
}

interface DesktopStore {
  items: BookmarkItem[];
  windows: FolderWindow[];
  settings: DesktopSettings;
  selectedIds: string[];
  nextZIndex: number;
  ready: boolean;

  hydrate: () => Promise<void>;
  refreshFromChrome: () => Promise<void>;

  addBookmark: (
    name: string,
    url: string,
    parentId: string | null,
    gridX?: number,
    gridY?: number,
  ) => Promise<void>;
  addFolder: (name: string, parentId: string | null, gridX?: number, gridY?: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  renameItem: (id: string, name: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<BookmarkItem>) => Promise<void>;
  moveItem: (id: string, parentId: string | null, gridX: number, gridY: number) => Promise<void>;
  getChildren: (parentId: string | null) => BookmarkItem[];

  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;

  openFolder: (folderId: string, folderName: string) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;

  setWallpaper: (wallpaper: string) => Promise<void>;
  setIconSize: (size: IconSize) => Promise<void>;
  setSortMode: (mode: SortMode) => Promise<void>;

  findFreePosition: (parentId: string | null) => { gridX: number; gridY: number };

  /** Переставить все иконки по текущей сортировке и ширине экрана (строки слева направо). */
  relayoutIconsBySort: () => Promise<void>;
}

async function persistSettings(settings: DesktopSettings) {
  await storageLocal.set({ settings });
}

export const useDesktopStore = create<DesktopStore>((set, get) => ({
  items: [],
  windows: [],
  settings: DEFAULT_SETTINGS,
  selectedIds: [],
  nextZIndex: 100,
  ready: false,

  refreshFromChrome: async () => {
    try {
      const [tree, raw] = await Promise.all([
        bookmarksApi.getTree(),
        storageLocal.get(['iconPositions', 'settings']),
      ]);
      const flat = flattenBookmarkTree(tree);
      let positions: IconPositionsMap = {
        ...((raw.iconPositions as IconPositionsMap) ?? {}),
      };
      const settings = mergeSettings(raw.settings as Partial<DesktopSettings> | undefined);
      const maxCols = getMaxGridColumns(settings);

      const occDesktop = new Set<string>();
      const occ = new Map<string, Set<string>>();
      let dirty = false;

      for (const it of flat) {
        const pid = resolveParentId(it.parentId);
        const entry = positions[it.id];
        const onDesktop = isDesktopSurfaceParent(pid);
        const setOcc = onDesktop ? occDesktop : ensureOcc(occ, pid);
        if (entry && entry.parentId === pid) {
          const key = `${entry.gridX},${entry.gridY}`;
          if (!setOcc.has(key)) {
            it.gridX = entry.gridX;
            it.gridY = entry.gridY;
            setOcc.add(key);
            continue;
          }
        }
        const pos = findFreeGridSlot(setOcc, maxCols);
        it.gridX = pos.gridX;
        it.gridY = pos.gridY;
        setOcc.add(`${pos.gridX},${pos.gridY}`);
        positions[it.id] = { parentId: pid, gridX: pos.gridX, gridY: pos.gridY };
        dirty = true;
      }

      const validIds = new Set(flat.map((i) => i.id));
      const pruned: IconPositionsMap = {};
      for (const [id, v] of Object.entries(positions)) {
        if (validIds.has(id)) pruned[id] = v;
      }
      if (Object.keys(pruned).length !== Object.keys(positions).length) dirty = true;
      positions = pruned;

      if (dirty) await storageLocal.set({ iconPositions: positions });

      set({ items: flat, settings, ready: true });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить закладки');
      set({ ready: true });
    }
  },

  hydrate: async () => {
    await get().refreshFromChrome();
  },

  addBookmark: async (name, url, parentId, gridX, gridY) => {
    try {
      const pid = resolveParentId(parentId);
      const finalUrl = url.startsWith('http') ? url : `https://${url}`;
      const created = await bookmarksApi.create({ parentId: pid, title: name, url: finalUrl });
      await get().refreshFromChrome();
      if (gridX !== undefined && gridY !== undefined && created?.id) {
        await get().moveItem(created.id, parentId, gridX, gridY);
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Не удалось создать закладку');
    }
  },

  addFolder: async (name, parentId, gridX, gridY) => {
    try {
      const pid = resolveParentId(parentId);
      const created = await bookmarksApi.create({ parentId: pid, title: name });
      await get().refreshFromChrome();
      if (gridX !== undefined && gridY !== undefined && created?.id) {
        await get().moveItem(created.id, parentId, gridX, gridY);
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Не удалось создать папку');
    }
  },

  removeItem: async (id) => {
    try {
      const item = get().items.find((i) => i.id === id);
      if (!item) return;
      if (item.type === 'folder') await bookmarksApi.removeTree(id);
      else await bookmarksApi.remove(id);
      set((s) => ({ windows: s.windows.filter((w) => w.folderId !== id) }));
      await get().refreshFromChrome();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Не удалось удалить');
    }
  },

  renameItem: async (id, name) => {
    try {
      await bookmarksApi.update(id, { title: name });
      await get().refreshFromChrome();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Не удалось переименовать');
    }
  },

  updateItem: async (id, updates) => {
    try {
      const ch: { title?: string; url?: string } = {};
      if (updates.name !== undefined) ch.title = updates.name;
      if (updates.url !== undefined) ch.url = updates.url;
      await bookmarksApi.update(id, ch);
      await get().refreshFromChrome();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить');
    }
  },

  moveItem: async (id, parentId, gridX, gridY) => {
    try {
      const resolvedParent = resolveParentId(parentId);
      const item = get().items.find((i) => i.id === id);
      if (!item) return;
      const currentPid = resolveParentId(item.parentId);

      const persistPositions = (next: BookmarkItem[]) => {
        const positions: IconPositionsMap = {};
        for (const it of next) {
          positions[it.id] = {
            parentId: resolveParentId(it.parentId),
            gridX: it.gridX,
            gridY: it.gridY,
          };
        }
        return storageLocal.set({ iconPositions: positions });
      };

      const placeGrid = (resolved: string) => {
        const occ = new Set<string>();
        const surface = isDesktopSurfaceParent(resolved);
        for (const it of get().items) {
          if (it.id === id) continue;
          const p = resolveParentId(it.parentId);
          if (surface) {
            if (isDesktopSurfaceParent(p)) occ.add(`${it.gridX},${it.gridY}`);
          } else if (p === resolved) {
            occ.add(`${it.gridX},${it.gridY}`);
          }
        }
        let gx = gridX;
        let gy = gridY;
        if (occ.has(`${gx},${gy}`)) {
          const f = findFreeGridSlot(occ, getMaxGridColumns(get().settings));
          gx = f.gridX;
          gy = f.gridY;
        }
        return { gx, gy };
      };

      if (currentPid === resolvedParent) {
        const { gx, gy } = placeGrid(resolvedParent);
        const next = get().items.map((it) =>
          it.id === id ? { ...it, gridX: gx, gridY: gy } : it,
        );
        set({ items: next });
        await persistPositions(next);
        return;
      }

      await bookmarksApi.move(id, { parentId: resolvedParent });
      await get().refreshFromChrome();
      if (!get().items.find((i) => i.id === id)) return;
      const { gx, gy } = placeGrid(resolvedParent);
      const next = get().items.map((it) =>
        it.id === id ? { ...it, gridX: gx, gridY: gy } : it,
      );
      set({ items: next });
      await persistPositions(next);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Не удалось переместить');
    }
  },

  getChildren: (parentId) => {
    const s = get();
    let list: BookmarkItem[];
    if (parentId === null) {
      list = s.items.filter(
        (i) =>
          i.parentId === DESKTOP_PARENT_ID || i.parentId === OTHER_BOOKMARKS_FOLDER_ID,
      );
    } else {
      const pid = resolveParentId(parentId);
      list = s.items.filter((i) => resolveParentId(i.parentId) === pid);
    }
    if (s.settings.sortMode === 'name') {
      list = [...list].sort((a, b) =>
        a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }),
      );
    } else {
      list = [...list].sort((a, b) => a.createdAt - b.createdAt);
    }
    return list;
  },

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),

  openFolder: (folderId, folderName) => {
    const existing = get().windows.find((w) => w.folderId === folderId);
    if (existing) {
      get().focusWindow(existing.id);
      if (existing.isMinimized) {
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: false } : w,
          ),
        }));
      }
      return;
    }
    const nz = get().nextZIndex;
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id: generateWindowId(),
          folderId,
          folderName,
          x: 200 + s.windows.length * 30,
          y: 100 + s.windows.length * 30,
          width: 700,
          height: 500,
          isMaximized: false,
          isMinimized: false,
          zIndex: nz,
        },
      ],
      nextZIndex: nz + 1,
    }));
  },

  closeWindow: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),

  minimizeWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)),
    })),

  maximizeWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w)),
    })),

  focusWindow: (id) => {
    const nz = get().nextZIndex;
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, zIndex: nz, isMinimized: false } : w,
      ),
      nextZIndex: nz + 1,
    }));
  },

  moveWindow: (id, x, y) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
    })),

  resizeWindow: (id, width, height) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, width, height } : w)),
    })),

  setWallpaper: async (wallpaper) => {
    const next = { ...get().settings, wallpaper };
    set({ settings: next });
    await persistSettings(next);
  },

  setIconSize: async (iconSize) => {
    const next = { ...get().settings, iconSize };
    set({ settings: next });
    await persistSettings(next);
    await get().relayoutIconsBySort();
  },

  setSortMode: async (sortMode) => {
    const next = { ...get().settings, sortMode };
    set({ settings: next });
    await persistSettings(next);
    await get().relayoutIconsBySort();
  },

  findFreePosition: (parentId) => {
    const maxCols = getMaxGridColumns(get().settings);
    let items: BookmarkItem[];
    if (parentId === null) {
      items = get().items.filter(
        (i) =>
          i.parentId === DESKTOP_PARENT_ID || i.parentId === OTHER_BOOKMARKS_FOLDER_ID,
      );
    } else {
      const pid = resolveParentId(parentId);
      items = get().items.filter((i) => resolveParentId(i.parentId) === pid);
    }
    const occupied = new Set(items.map((i) => `${i.gridX},${i.gridY}`));
    return findFreeGridSlot(occupied, maxCols);
  },

  relayoutIconsBySort: async () => {
    const state = get();
    if (!state.ready) return;
    const maxCols = getMaxGridColumns(state.settings);
    const sortFn = (a: BookmarkItem, b: BookmarkItem) =>
      state.settings.sortMode === 'name'
        ? a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
        : a.createdAt - b.createdAt;

    const byParent = new Map<string, BookmarkItem[]>();
    for (const it of state.items) {
      const pid = resolveParentId(it.parentId);
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(it);
    }

    const next = new Map(state.items.map((i) => [i.id, { ...i }]));

    const desktopCombined = [
      ...(byParent.get(DESKTOP_PARENT_ID) ?? []),
      ...(byParent.get(OTHER_BOOKMARKS_FOLDER_ID) ?? []),
    ].sort(sortFn);
    desktopCombined.forEach((it, idx) => {
      const u = next.get(it.id);
      if (!u) return;
      u.gridX = idx % maxCols;
      u.gridY = Math.floor(idx / maxCols);
    });

    for (const [pid, list] of byParent) {
      if (pid === DESKTOP_PARENT_ID || pid === OTHER_BOOKMARKS_FOLDER_ID) continue;
      const sorted = [...list].sort(sortFn);
      sorted.forEach((it, idx) => {
        const u = next.get(it.id);
        if (!u) return;
        u.gridX = idx % maxCols;
        u.gridY = Math.floor(idx / maxCols);
      });
    }

    const newItems = Array.from(next.values());
    set({ items: newItems });
    const positions: IconPositionsMap = {};
    for (const it of newItems) {
      positions[it.id] = {
        parentId: resolveParentId(it.parentId),
        gridX: it.gridX,
        gridY: it.gridY,
      };
    }
    await storageLocal.set({ iconPositions: positions });
  },
}));
