import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = React.useState<{ items: ContextMenuItem[]; x: number; y: number } | null>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // Adjust position to stay on screen
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 20);

  return (
    <div ref={ref} className="fixed z-[9999]" style={{ left: adjustedX, top: adjustedY }}>
      <div className="win-acrylic win-shadow rounded-lg border border-win-context-border py-1.5 min-w-[200px] animate-fade-in">
        {items.map((item, i) => {
          if (item.separator) {
            return <div key={i} className="my-1 mx-3 h-px bg-win-context-border" />;
          }
          return (
            <div
              key={i}
              className={`
                flex items-center gap-3 px-3 py-1.5 mx-1 rounded-md text-sm cursor-pointer transition-colors
                ${item.disabled ? 'opacity-40 pointer-events-none' : 'hover:bg-win-context-hover'}
              `}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                  onClose();
                }
              }}
              onMouseEnter={(e) => {
                if (item.submenu) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setSubmenu({ items: item.submenu, x: rect.right, y: rect.top });
                } else {
                  setSubmenu(null);
                }
              }}
            >
              <span className="w-4 text-muted-foreground flex-shrink-0">{item.icon}</span>
              <span className="flex-1 text-win-surface-fg">{item.label}</span>
              {item.submenu && <span className="text-muted-foreground text-xs">▸</span>}
            </div>
          );
        })}
      </div>
      {submenu && (
        <ContextMenu x={submenu.x} y={submenu.y} items={submenu.items} onClose={onClose} />
      )}
    </div>
  );
};
