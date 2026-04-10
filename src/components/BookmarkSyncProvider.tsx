import { useEffect, type ReactNode } from 'react';
import { bookmarksApi } from '@/extension/bookmarksApi';
import { useDesktopStore } from '@/store/useDesktopStore';

/** Подписка на события chrome.bookmarks и первичная загрузка (hydrate внутри стора). */
export function BookmarkSyncProvider({ children }: { children: ReactNode }) {
  const hydrate = useDesktopStore((s) => s.hydrate);
  const refreshFromChrome = useDesktopStore((s) => s.refreshFromChrome);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onCreated = () => {
      void refreshFromChrome();
    };
    const onRemoved = () => {
      void refreshFromChrome();
    };
    const onChanged = () => {
      void refreshFromChrome();
    };
    const onMoved = () => {
      void refreshFromChrome();
    };

    bookmarksApi.addListener('created', onCreated);
    bookmarksApi.addListener('removed', onRemoved);
    bookmarksApi.addListener('changed', onChanged);
    bookmarksApi.addListener('moved', onMoved);

    return () => {
      bookmarksApi.removeListener('created', onCreated);
      bookmarksApi.removeListener('removed', onRemoved);
      bookmarksApi.removeListener('changed', onChanged);
      bookmarksApi.removeListener('moved', onMoved);
    };
  }, [refreshFromChrome]);

  return <>{children}</>;
}
