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

const cellSizeMap: Record<IconSize, number> = { small: 70, medium: 90, large: 110 };

export const Desktop: React.FC = () => {
  const {
    settings, getChildren, windows, selectedIds, setSelectedIds, clearSelection,
    addFolder, removeItem, setIconSize, setSortMode, setWallpaper,
  } = useDesktopStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [propsItem, setPropsItem] = useState<BookmarkItem | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  const desktopItems = getChildren(null);
  const cellSize = cellSizeMap[settings.iconSize];

  const handleDesktopContext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    clearSelection();

    const wallpapers = [
      { name: 'По умолчанию', path: '/images/wallpaper-default.jpg' },
      { name: 'Закат', path: '/images/wallpaper-sunset.jpg' },
      { name: 'Природа', path: '/images/wallpaper-nature.jpg' },
    ];

    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        {
          label: 'Вид', icon: <LayoutGrid size={14} />,
          submenu: [
            { label: 'Мелкие значки', onClick: () => setIconSize('small') },
            { label: 'Обычные значки', onClick: () => setIconSize('medium') },
            { label: 'Крупные значки', onClick: () => setIconSize('large') },
          ]
        },
        {
          label: 'Сортировка', icon: <SortAsc size={14} />,
          submenu: [
            { label: 'По имени', onClick: () => setSortMode('name') },
            { label: 'По дате', onClick: () => setSortMode('date') },
          ]
        },
        { label: 'Обновить', icon: <RefreshCw size={14} />, onClick: () => window.location.reload() },
        { separator: true, label: '' },
        {
          label: 'Создать', icon: <FolderPlus size={14} />,
          submenu: [
            { label: 'Ярлык', icon: <Link size={14} />, onClick: () => setCreateDialog(true) },
            { label: 'Папку', icon: <FolderPlus size={14} />, onClick: () => addFolder('Новая папка', null) },
          ]
        },
        { separator: true, label: '' },
        {
          label: 'Персонализация', icon: <Image size={14} />,
          submenu: wallpapers.map(wp => ({
            label: wp.name,
            onClick: () => setWallpaper(wp.path),
          }))
        },
      ],
    });
  }, [clearSelection, setIconSize, setSortMode, addFolder, setWallpaper]);

  const handleIconContext = useCallback((e: React.MouseEvent, item: BookmarkItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds([item.id]);

    const menuItems: ContextMenuItem[] = item.type === 'bookmark'
      ? [
          { label: 'Открыть', onClick: () => item.url && window.open(item.url, '_blank') },
          { label: 'Копировать ссылку', onClick: () => item.url && navigator.clipboard.writeText(item.url) },
          { separator: true, label: '' },
          { label: 'Переименовать', onClick: () => { const n = prompt('Новое имя:', item.name); if (n) useDesktopStore.getState().renameItem(item.id, n); } },
          { label: 'Удалить', onClick: () => { if (confirm(`Удалить "${item.name}"?`)) removeItem(item.id); } },
          { separator: true, label: '' },
          { label: 'Свойства', onClick: () => setPropsItem(item) },
        ]
      : [
          { label: 'Открыть', onClick: () => useDesktopStore.getState().openFolder(item.id, item.name) },
          { separator: true, label: '' },
          { label: 'Переименовать', onClick: () => { const n = prompt('Новое имя:', item.name); if (n) useDesktopStore.getState().renameItem(item.id, n); } },
          { label: 'Удалить', onClick: () => { if (confirm(`Удалить папку "${item.name}" и все её содержимое?`)) removeItem(item.id); } },
        ];
    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems });
  }, [setSelectedIds, removeItem]);

  const handleDragStart = (e: React.DragEvent, item: BookmarkItem) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDesktopDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || !desktopRef.current) return;

    const rect = desktopRef.current.getBoundingClientRect();
    const gridX = Math.floor((e.clientX - rect.left) / cellSize);
    const gridY = Math.floor((e.clientY - rect.top) / cellSize);
    useDesktopStore.getState().moveItem(draggedId, null, gridX, gridY);
  };

  // Selection rectangle
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || e.target !== desktopRef.current) return;
    clearSelection();
    selectionStartRef.current = { x: e.clientX, y: e.clientY };

    const handleMove = (ev: MouseEvent) => {
      if (!selectionStartRef.current) return;
      const sx = selectionStartRef.current.x;
      const sy = selectionStartRef.current.y;
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
        selectedIds.forEach(id => removeItem(id));
        clearSelection();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selectedIds, removeItem, clearSelection]);

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
        onClick={(e) => { if (e.target === desktopRef.current) clearSelection(); }}
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
