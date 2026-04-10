import React, { useRef, useState, useCallback } from 'react';
import { FolderWindow as FolderWindowType, BookmarkItem } from '@/types/bookmark';
import { useDesktopStore } from '@/store/useDesktopStore';
import { DesktopIcon } from './DesktopIcon';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { CreateBookmarkDialog } from './CreateBookmarkDialog';
import { PropertiesDialog } from './PropertiesDialog';
import { X, Minus, Square, ChevronLeft, Folder } from 'lucide-react';

interface Props {
  window: FolderWindowType;
}

export const FolderWindowComponent: React.FC<Props> = ({ window: win }) => {
  const {
    getChildren, closeWindow, minimizeWindow, maximizeWindow, focusWindow,
    moveWindow, selectedIds, setSelectedIds, addFolder, removeItem,
  } = useDesktopStore();
  const [currentFolderId, setCurrentFolderId] = useState(win.folderId);
  const [currentFolderName, setCurrentFolderName] = useState(win.folderName);
  const [pathHistory, setPathHistory] = useState<{ id: string; name: string }[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [propsItem, setPropsItem] = useState<BookmarkItem | null>(null);

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const items = getChildren(currentFolderId);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    focusWindow(win.id);
    if (win.isMaximized) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: win.x, origY: win.y };
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      moveWindow(win.id,
        dragRef.current.origX + ev.clientX - dragRef.current.startX,
        dragRef.current.origY + ev.clientY - dragRef.current.startY
      );
    };
    const handleUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [win, focusWindow, moveWindow]);

  const navigateInto = (folderId: string, folderName: string) => {
    setPathHistory(prev => [...prev, { id: currentFolderId, name: currentFolderName }]);
    setCurrentFolderId(folderId);
    setCurrentFolderName(folderName);
  };

  const navigateBack = () => {
    const prev = pathHistory[pathHistory.length - 1];
    if (prev) {
      setPathHistory(p => p.slice(0, -1));
      setCurrentFolderId(prev.id);
      setCurrentFolderName(prev.name);
    }
  };

  const handleIconContext = (e: React.MouseEvent, item: BookmarkItem) => {
    e.preventDefault();
    e.stopPropagation();
    const menuItems: ContextMenuItem[] = item.type === 'bookmark'
      ? [
          { label: 'Открыть', onClick: () => item.url && window.open(item.url, '_blank') },
          { label: 'Копировать ссылку', onClick: () => item.url && navigator.clipboard.writeText(item.url) },
          { separator: true, label: '' },
          { label: 'Переименовать', onClick: () => { const n = prompt('Новое имя:', item.name); if (n) void useDesktopStore.getState().renameItem(item.id, n); } },
          { label: 'Удалить', onClick: () => void removeItem(item.id) },
          { separator: true, label: '' },
          { label: 'Свойства', onClick: () => setPropsItem(item) },
        ]
      : [
          { label: 'Открыть', onClick: () => navigateInto(item.id, item.name) },
          { label: 'Переименовать', onClick: () => { const n = prompt('Новое имя:', item.name); if (n) void useDesktopStore.getState().renameItem(item.id, n); } },
          { label: 'Удалить', onClick: () => void removeItem(item.id) },
        ];
    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems });
  };

  const handleBgContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Создать ярлык', onClick: () => setCreateDialog(true) },
        { label: 'Создать папку', onClick: () => void addFolder('Новая папка', currentFolderId) },
      ]
    });
  };

  const handleDragStart = (e: React.DragEvent, item: BookmarkItem) => {
    e.dataTransfer.setData('text/plain', item.id);
  };

  if (win.isMinimized) return null;

  const style: React.CSSProperties = win.isMaximized
    ? { left: 0, top: 0, width: '100%', height: 'calc(100% - 48px)', borderRadius: 0 }
    : { left: win.x, top: win.y, width: win.width, height: win.height };

  return (
    <>
      <div
        className="fixed win-mica win-shadow-lg rounded-xl overflow-hidden flex flex-col animate-win-open"
        style={{ ...style, zIndex: win.zIndex }}
        onClick={() => focusWindow(win.id)}
      >
        {/* Title bar */}
        <div
          className="flex items-center h-10 px-2 bg-win-titlebar flex-shrink-0 border-b border-win-context-border"
          onMouseDown={handleMouseDown}
        >
          <button data-no-drag onClick={navigateBack} disabled={pathHistory.length === 0}
            className="p-1 rounded hover:bg-win-context-hover disabled:opacity-30 transition-colors mr-1">
            <ChevronLeft size={16} className="text-win-titlebar-fg" />
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-1 min-w-0" data-no-drag>
            <Folder size={14} className="text-amber-500 flex-shrink-0" />
            {pathHistory.map((p, i) => (
              <React.Fragment key={i}>
                <span className="hover:underline cursor-pointer truncate" onClick={() => {
                  setCurrentFolderId(p.id);
                  setCurrentFolderName(p.name);
                  setPathHistory(prev => prev.slice(0, i));
                }}>{p.name}</span>
                <span>›</span>
              </React.Fragment>
            ))}
            <span className="text-win-titlebar-fg font-medium truncate">{currentFolderName}</span>
          </div>

          {/* Window controls */}
          <div className="flex items-center" data-no-drag>
            <button onClick={() => minimizeWindow(win.id)} className="w-10 h-8 flex items-center justify-center hover:bg-win-context-hover transition-colors rounded-sm">
              <Minus size={14} className="text-win-titlebar-fg" />
            </button>
            <button onClick={() => maximizeWindow(win.id)} className="w-10 h-8 flex items-center justify-center hover:bg-win-context-hover transition-colors rounded-sm">
              <Square size={11} className="text-win-titlebar-fg" />
            </button>
            <button onClick={() => closeWindow(win.id)} className="w-10 h-8 flex items-center justify-center hover:bg-win-close-hover hover:text-primary-foreground transition-colors rounded-sm">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3" onContextMenu={handleBgContext} onClick={() => setSelectedIds([])}>
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Эта папка пуста
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 content-start">
              {items.map(item => (
                <DesktopIcon
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.includes(item.id)}
                  onContextMenu={handleIconContext}
                  onDragStart={handleDragStart}
                  isDesktop={false}
                />
              ))}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="h-6 px-3 flex items-center border-t border-win-context-border bg-win-titlebar text-[10px] text-muted-foreground flex-shrink-0">
          {items.length} элемент(ов)
        </div>
      </div>

      {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
      {createDialog && <CreateBookmarkDialog parentId={currentFolderId} onClose={() => setCreateDialog(false)} />}
      {propsItem && <PropertiesDialog item={propsItem} onClose={() => setPropsItem(null)} />}
    </>
  );
};
