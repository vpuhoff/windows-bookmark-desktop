import React, { useState, useRef, useCallback } from 'react';
import { useDesktopStore } from '@/store/useDesktopStore';
import { BookmarkItem, IconSize } from '@/types/bookmark';
import { DesktopIcon } from './DesktopIcon';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { CreateBookmarkDialog } from './CreateBookmarkDialog';
import { PropertiesDialog } from './PropertiesDialog';
import { FolderWindowComponent } from './FolderWindow';
import { Taskbar } from './Taskbar';
import { Monitor, FolderPlus, Link, SortAsc, LayoutGrid, RefreshCw, Image } from 'lucide-react';
import { getBookmarkDragIds, setBookmarkDragData } from '@/lib/dragBookmarks';

const cellSizeMap: Record<IconSize, number> = { small: 70, medium: 90, large: 110 };

export const Desktop: React.FC = () => {
  const {
    ready,
    settings, getChildren, windows, selectedIds, setSelectedIds, clearSelection,
    addFolder, removeItem, setIconSize, setSortMode, setWallpaper, refreshFromChrome,
    relayoutIconsBySort,
  } = useDesktopStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [propsItem, setPropsItem] = useState<BookmarkItem | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  /** После рамочного выделения приходит click по столу — не сбрасывать выделение. */
  const suppressDesktopClickClearRef = useRef(false);

  const desktopItems = getChildren(null);
  const cellSize = cellSizeMap[settings.iconSize];

  const handleDesktopContext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    clearSelection();

    const wallpapers = [
      { name: 'По умолчанию', path: '/placeholder.svg' },
      {
        name: 'Закат',
        path: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
      },
      {
        name: 'Природа',
        path: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
      },
    ];

    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        {
          label: 'Вид', icon: <LayoutGrid size={14} />,
          submenu: [
            { label: 'Мелкие значки', onClick: () => void setIconSize('small') },
            { label: 'Обычные значки', onClick: () => void setIconSize('medium') },
            { label: 'Крупные значки', onClick: () => void setIconSize('large') },
          ]
        },
        {
          label: 'Сортировка', icon: <SortAsc size={14} />,
          submenu: [
            { label: 'По имени', onClick: () => void setSortMode('name') },
            { label: 'По дате', onClick: () => void setSortMode('date') },
            { separator: true, label: '' },
            {
              label: 'Выровнять по сетке',
              onClick: () => void relayoutIconsBySort(),
            },
          ]
        },
        { label: 'Обновить', icon: <RefreshCw size={14} />, onClick: () => void refreshFromChrome() },
        { separator: true, label: '' },
        {
          label: 'Создать', icon: <FolderPlus size={14} />,
          submenu: [
            { label: 'Ярлык', icon: <Link size={14} />, onClick: () => setCreateDialog(true) },
            { label: 'Папку', icon: <FolderPlus size={14} />, onClick: () => void addFolder('Новая папка', null) },
          ]
        },
        { separator: true, label: '' },
        {
          label: 'Персонализация', icon: <Image size={14} />,
          submenu: wallpapers.map(wp => ({
            label: wp.name,
            onClick: () => void setWallpaper(wp.path),
          }))
        },
      ],
    });
  }, [clearSelection, setIconSize, setSortMode, addFolder, setWallpaper, refreshFromChrome, relayoutIconsBySort]);

  const handleIconContext = useCallback((e: React.MouseEvent, item: BookmarkItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds([item.id]);

    const menuItems: ContextMenuItem[] = item.type === 'bookmark'
      ? [
          { label: 'Открыть', onClick: () => item.url && window.open(item.url, '_blank') },
          { label: 'Копировать ссылку', onClick: () => item.url && navigator.clipboard.writeText(item.url) },
          { separator: true, label: '' },
          { label: 'Переименовать', onClick: () => { const n = prompt('Новое имя:', item.name); if (n) void useDesktopStore.getState().renameItem(item.id, n); } },
          { label: 'Удалить', onClick: () => { if (confirm(`Удалить "${item.name}"?`)) void removeItem(item.id); } },
          { separator: true, label: '' },
          { label: 'Свойства', onClick: () => setPropsItem(item) },
        ]
      : [
          { label: 'Открыть', onClick: () => useDesktopStore.getState().openFolder(item.id, item.name) },
          { separator: true, label: '' },
          { label: 'Переименовать', onClick: () => { const n = prompt('Новое имя:', item.name); if (n) void useDesktopStore.getState().renameItem(item.id, n); } },
          { label: 'Удалить', onClick: () => { if (confirm(`Удалить папку "${item.name}" и все её содержимое?`)) void removeItem(item.id); } },
        ];
    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems });
  }, [setSelectedIds, removeItem]);

  const handleDragStart = (e: React.DragEvent, item: BookmarkItem) => {
    setBookmarkDragData(e, item, selectedIds);
  };

  const handleDesktopDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const ids = getBookmarkDragIds(e).filter(Boolean);
    if (ids.length === 0 || !desktopRef.current) return;

    const rect = desktopRef.current.getBoundingClientRect();
    const gridX = Math.floor((e.clientX - rect.left) / cellSize);
    const gridY = Math.floor((e.clientY - rect.top) / cellSize);
    const store = useDesktopStore.getState();
    void (async () => {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (i === 0) {
          await store.moveItem(id, null, gridX, gridY);
        } else {
          const pos = store.findFreePosition(null);
          await store.moveItem(id, null, pos.gridX, pos.gridY);
        }
      }
    })();
  };

  // Selection rectangle
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || e.target !== desktopRef.current) return;
    clearSelection();
    selectionStartRef.current = { x: e.clientX, y: e.clientY };
    let didBoxDrag = false;

    const handleMove = (ev: MouseEvent) => {
      if (!selectionStartRef.current) return;
      const sx = selectionStartRef.current.x;
      const sy = selectionStartRef.current.y;
      if (Math.abs(ev.clientX - sx) > 2 || Math.abs(ev.clientY - sy) > 2) {
        didBoxDrag = true;
      }
      const x = Math.min(sx, ev.clientX);
      const y = Math.min(sy, ev.clientY);
      const w = Math.abs(ev.clientX - sx);
      const h = Math.abs(ev.clientY - sy);
      setSelectionRect({ x, y, w, h });

      // Find items in selection
      if (desktopRef.current) {
        const rect = desktopRef.current.getBoundingClientRect();
        const selected = desktopItems.filter(item => {
          const ix = rect.left + item.gridX * cellSize + cellSize / 2;
          const iy = rect.top + item.gridY * cellSize + cellSize / 2;
          return ix >= x && ix <= x + w && iy >= y && iy <= y + h;
        });
        setSelectedIds(selected.map(i => i.id));
      }
    };

    const handleUp = () => {
      if (didBoxDrag) {
        suppressDesktopClickClearRef.current = true;
      }
      selectionStartRef.current = null;
      setSelectionRect(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  // Keyboard delete
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedIds.length > 0) {
        selectedIds.forEach((id) => void removeItem(id));
        clearSelection();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selectedIds, removeItem, clearSelection]);

  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-muted-foreground font-segoe">
        Загрузка закладок…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden font-segoe">
      {/* Wallpaper */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${settings.wallpaper})` }}
      />

      {/* Desktop area */}
      <div
        ref={desktopRef}
        className="absolute inset-0 bottom-12"
        onContextMenu={handleDesktopContext}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          if (e.target !== desktopRef.current) return;
          if (suppressDesktopClickClearRef.current) {
            suppressDesktopClickClearRef.current = false;
            return;
          }
          clearSelection();
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDesktopDrop}
      >
        {/* Icons positioned by grid */}
        {desktopItems.map(item => (
          <div
            key={item.id}
            className="absolute"
            style={{ left: item.gridX * cellSize, top: item.gridY * cellSize }}
          >
            <DesktopIcon
              item={item}
              isSelected={selectedIds.includes(item.id)}
              onContextMenu={handleIconContext}
              onDragStart={handleDragStart}
              isDesktop
            />
          </div>
        ))}
      </div>

      {/* Selection rectangle */}
      {selectionRect && (
        <div
          className="fixed border border-win-accent rounded-sm pointer-events-none"
          style={{
            left: selectionRect.x, top: selectionRect.y,
            width: selectionRect.w, height: selectionRect.h,
            background: 'hsl(207 90% 54% / 0.15)',
          }}
        />
      )}

      {/* Windows */}
      {windows.map(w => <FolderWindowComponent key={w.id} window={w} />)}

      {/* Taskbar */}
      <Taskbar />

      {/* Overlays */}
      {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
      {createDialog && <CreateBookmarkDialog parentId={null} onClose={() => setCreateDialog(false)} />}
      {propsItem && <PropertiesDialog item={propsItem} onClose={() => setPropsItem(null)} />}
    </div>
  );
};
