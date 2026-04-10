import React, { useState, useRef } from 'react';
import { BookmarkItem, IconSize } from '@/types/bookmark';
import { useDesktopStore } from '@/store/useDesktopStore';
import { Folder } from 'lucide-react';

const sizeMap: Record<IconSize, { icon: number; cell: number; fontSize: string }> = {
  small: { icon: 32, cell: 70, fontSize: 'text-[10px]' },
  medium: { icon: 48, cell: 90, fontSize: 'text-xs' },
  large: { icon: 64, cell: 110, fontSize: 'text-sm' },
};

interface DesktopIconProps {
  item: BookmarkItem;
  isSelected: boolean;
  onContextMenu: (e: React.MouseEvent, item: BookmarkItem) => void;
  onDragStart: (e: React.DragEvent, item: BookmarkItem) => void;
  isDesktop?: boolean;
}

export const DesktopIcon: React.FC<DesktopIconProps> = ({
  item, isSelected, onContextMenu, onDragStart, isDesktop = true,
}) => {
  const { settings, openFolder, setSelectedIds, clearSelection } = useDesktopStore();
  const { icon: iconSize, cell: cellSize, fontSize } = sizeMap[settings.iconSize];
  const [imgError, setImgError] = useState(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    clickCountRef.current++;
    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => {
        // single click - select
        if (e.ctrlKey || e.metaKey) {
          setSelectedIds([...useDesktopStore.getState().selectedIds, item.id]);
        } else {
          setSelectedIds([item.id]);
        }
        clickCountRef.current = 0;
      }, 250);
    } else if (clickCountRef.current === 2) {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      // double click
      if (item.type === 'folder') {
        openFolder(item.id, item.name);
      } else if (item.url) {
        window.open(item.url, '_blank');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (item.type === 'folder') {
      e.preventDefault();
      e.currentTarget.classList.add('ring-2', 'ring-win-accent');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('ring-2', 'ring-win-accent');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('ring-2', 'ring-win-accent');
    if (item.type === 'folder') {
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== item.id) {
        const store = useDesktopStore.getState();
        const pos = store.findFreePosition(item.id);
        void store.moveItem(draggedId, item.id, pos.gridX, pos.gridY);
      }
    }
  };

  const renderIcon = () => {
    if (item.type === 'folder') {
      return (
        <div style={{ width: iconSize, height: iconSize }} className="flex items-center justify-center">
          <Folder
            size={iconSize * 0.85}
            className="text-amber-400 drop-shadow-sm"
            fill="currentColor"
            strokeWidth={1}
          />
        </div>
      );
    }
    if (item.favicon && !imgError) {
      return (
        <img
          src={item.favicon}
          alt=""
          style={{ width: iconSize * 0.75, height: iconSize * 0.75 }}
          className="object-contain drop-shadow-sm"
          onError={() => setImgError(true)}
          draggable={false}
        />
      );
    }
    return (
      <div
        style={{ width: iconSize * 0.75, height: iconSize * 0.75 }}
        className="rounded-md bg-win-accent flex items-center justify-center text-primary-foreground font-semibold"
      >
        {item.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div
      className={`
        flex flex-col items-center justify-start gap-1 rounded-md cursor-pointer select-none p-1.5 transition-colors
        ${isSelected ? 'bg-win-selection/25 ring-1 ring-win-selection/50' : 'hover:bg-foreground/10'}
      `}
      style={isDesktop ? { width: cellSize, height: cellSize + 10 } : { width: cellSize, minHeight: cellSize }}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, item)}
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={item.type === 'bookmark' ? `${item.name}\n${item.url}` : item.name}
    >
      <div className="flex items-center justify-center flex-shrink-0" style={{ height: iconSize }}>
        {renderIcon()}
      </div>
      <span
        className={`${fontSize} text-center leading-tight w-full truncate ${
          isDesktop ? 'text-win-icon-text drop-shadow-[0_1px_2px_hsl(var(--win-icon-text-shadow)/0.8)]' : 'text-foreground'
        }`}
      >
        {item.name}
      </span>
    </div>
  );
};
