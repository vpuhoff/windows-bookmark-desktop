import React, { useState } from 'react';
import { useDesktopStore } from '@/store/useDesktopStore';
import { X } from 'lucide-react';

interface Props {
  parentId: string | null;
  onClose: () => void;
}

export const CreateBookmarkDialog: React.FC<Props> = ({ parentId, onClose }) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const { addBookmark } = useDesktopStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    const finalName = name || (() => { try { return new URL(finalUrl).hostname; } catch { return url; } })();
    await addBookmark(finalName, finalUrl, parentId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-foreground/20" onClick={onClose}>
      <div
        className="win-mica win-shadow-lg rounded-xl w-[420px] animate-win-open"
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-win-context-border">
          <span className="text-sm font-semibold text-win-surface-fg">Создать ярлык</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-win-context-hover transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">URL-адрес</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 rounded-md border border-win-context-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-win-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Название (необязательно)</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Название сайта"
              className="w-full px-3 py-2 rounded-md border border-win-context-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-win-accent"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-md text-sm border border-win-context-border hover:bg-win-context-hover transition-colors">
              Отмена
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-md text-sm bg-win-accent text-primary-foreground hover:bg-win-accent-hover transition-colors">
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
