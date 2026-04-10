import React, { useState, useEffect } from 'react';
import { useDesktopStore } from '@/store/useDesktopStore';
import { Folder, Search } from 'lucide-react';

const WinLogo = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 2.3l6.5-.9v6.3H0V2.3zm7.3-1l8.7-1.3v8.7H7.3V1.3zM16 8.7v8.6l-8.7-1.2V8.7H16zM6.5 16.1L0 15.2V8.7h6.5v7.4z"/>
  </svg>
);

export const Taskbar: React.FC = () => {
  const { windows, focusWindow, minimizeWindow } = useDesktopStore();
  const [time, setTime] = useState(new Date());
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const visibleWindows = windows.filter(w => !w.isMinimized);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-12 z-[5000] flex items-center justify-center"
        style={{ background: 'hsl(0 0% 15% / 0.85)', backdropFilter: 'blur(20px) saturate(150%)' }}
      >
        <div className="flex items-center gap-1 h-full">
          {/* Start button */}
          <button
            onClick={() => setStartOpen(!startOpen)}
            className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-foreground/10 transition-colors text-win-taskbar-fg"
          >
            <WinLogo />
          </button>

          {/* Search */}
          <button className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-foreground/10 transition-colors text-win-taskbar-fg">
            <Search size={18} />
          </button>

          {/* Open folder windows */}
          {windows.map(w => (
            <button
              key={w.id}
              onClick={() => w.isMinimized ? focusWindow(w.id) : minimizeWindow(w.id)}
              className={`h-10 px-3 flex items-center gap-2 rounded-md transition-colors text-win-taskbar-fg ${
                !w.isMinimized ? 'bg-foreground/15' : 'hover:bg-foreground/10'
              }`}
            >
              <Folder size={16} className="text-amber-400" />
              <span className="text-xs max-w-[100px] truncate">{w.folderName}</span>
            </button>
          ))}
        </div>

        {/* Clock */}
        <div className="absolute right-3 flex flex-col items-end text-win-taskbar-fg">
          <span className="text-xs">{time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-[10px] opacity-70">{time.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Start Menu */}
      {startOpen && (
        <>
          <div className="fixed inset-0 z-[4999]" onClick={() => setStartOpen(false)} />
          <StartMenu onClose={() => setStartOpen(false)} />
        </>
      )}
    </>
  );
};

const StartMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { items, settings, setWallpaper, setIconSize, setSortMode } = useDesktopStore();
  const [search, setSearch] = useState('');
  const recentBookmarks = [...items]
    .filter(i => i.type === 'bookmark')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);

  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : [];

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

  return (
    <div
      className="fixed bottom-14 left-1/2 -translate-x-1/2 w-[600px] max-h-[560px] win-acrylic win-shadow-lg rounded-xl z-[5000] animate-win-open overflow-hidden"
    >
      {/* Search */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-background/80 border border-win-context-border">
          <Search size={14} className="text-muted-foreground" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Введите для поиска..."
            className="flex-1 bg-transparent text-sm outline-none"
            autoFocus
          />
        </div>
      </div>

      {search ? (
        <div className="p-3 max-h-[400px] overflow-auto">
          <div className="text-xs text-muted-foreground mb-2 px-1">Результаты поиска</div>
          {filtered.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Ничего не найдено</div>}
          {filtered.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-win-context-hover cursor-pointer"
              onClick={() => {
                if (item.type === 'bookmark' && item.url) window.open(item.url, '_blank');
                else if (item.type === 'folder') useDesktopStore.getState().openFolder(item.id, item.name);
                onClose();
              }}
            >
              {item.type === 'folder' ? <Folder size={18} className="text-amber-400" /> :
                item.favicon ? <img src={item.favicon} className="w-5 h-5" alt="" /> :
                <div className="w-5 h-5 rounded bg-win-accent text-primary-foreground text-[10px] flex items-center justify-center font-bold">{item.name[0]}</div>
              }
              <div className="min-w-0">
                <div className="text-sm truncate">{item.name}</div>
                {item.url && <div className="text-[10px] text-muted-foreground truncate">{item.url}</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Recent */}
          <div>
            <div className="text-xs text-muted-foreground mb-2 px-1">Недавно добавленные</div>
            <div className="grid grid-cols-3 gap-1">
              {recentBookmarks.map(item => (
                <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-win-context-hover cursor-pointer"
                  onClick={() => { if (item.url) window.open(item.url, '_blank'); onClose(); }}
                >
                  {item.favicon ? <img src={item.favicon} className="w-4 h-4" alt="" /> :
                    <div className="w-4 h-4 rounded bg-win-accent text-[8px] text-primary-foreground flex items-center justify-center font-bold">{item.name[0]}</div>}
                  <span className="text-xs truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-win-context-border" />

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-2">Обои</div>
              <div className="flex gap-2">
                {wallpapers.map(wp => (
                  <button
                    key={wp.path}
                    onClick={() => void setWallpaper(wp.path)}
                    className={`w-14 h-9 rounded-md overflow-hidden border-2 transition-colors ${
                      settings.wallpaper === wp.path ? 'border-win-accent' : 'border-transparent'
                    }`}
                  >
                    <img src={wp.path} alt={wp.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">Размер значков</div>
              <div className="flex gap-1">
                {(['small', 'medium', 'large'] as const).map(s => (
                  <button key={s} onClick={() => void setIconSize(s)}
                    className={`px-3 py-1 rounded-md text-xs transition-colors ${
                      settings.iconSize === s ? 'bg-win-accent text-primary-foreground' : 'hover:bg-win-context-hover'
                    }`}
                  >
                    {s === 'small' ? 'Мелкие' : s === 'medium' ? 'Обычные' : 'Крупные'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
