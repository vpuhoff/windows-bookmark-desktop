import { hasExtensionBookmarks } from './env';

/** Mirrors chrome.bookmarks.BookmarkTreeNode shape used in the app. */
export type BookmarkTreeNode = {
  id: string;
  parentId?: string;
  index?: number;
  url?: string;
  title: string;
  dateAdded?: number;
  dateGroupModified?: number;
  children?: BookmarkTreeNode[];
};

export type BookmarkCreateArg = {
  parentId: string;
  index?: number;
  title?: string;
  url?: string;
};

export type BookmarkChangesArg = { title?: string; url?: string };

const MOCK_STORAGE_KEY = 'windesk-mock-bookmarks-v1';

type InternalNode = {
  parentId: string;
  title: string;
  url?: string;
  dateAdded: number;
};

type ListenerCreated = (id: string, node: BookmarkTreeNode) => void;
type ListenerRemoved = (id: string, removeInfo: { parentId: string; index: number }) => void;
type ListenerChanged = (id: string, changeInfo: { title?: string; url?: string }) => void;
type ListenerMoved = (
  id: string,
  moveInfo: { parentId: string; index: number; oldParentId: string; oldIndex: number },
) => void;

class MockBookmarksEngine {
  private nodes = new Map<string, InternalNode>();
  private childOrder = new Map<string, string[]>();
  private nextId = 10_000;
  private listeners: {
    created: ListenerCreated[];
    removed: ListenerRemoved[];
    changed: ListenerChanged[];
    moved: ListenerMoved[];
  } = { created: [], removed: [], changed: [], moved: [] };

  constructor() {
    this.loadOrSeed();
  }

  private loadOrSeed() {
    try {
      const raw = localStorage.getItem(MOCK_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as {
          nodes: Record<string, InternalNode>;
          childOrder: Record<string, string[]>;
          nextId: number;
        };
        this.nodes = new Map(Object.entries(data.nodes));
        this.childOrder = new Map(Object.entries(data.childOrder));
        this.nextId = data.nextId;
        return;
      }
    } catch {
      /* seed */
    }
    this.seed();
    this.persist();
  }

  private seed() {
    const now = Date.now();
    this.nodes.set('0', { parentId: '', title: '', dateAdded: now });
    this.nodes.set('1', { parentId: '0', title: 'Панель закладок', dateAdded: now });
    this.nodes.set('2', { parentId: '0', title: 'Другие закладки', dateAdded: now });
    this.childOrder.set('0', ['1', '2']);
    this.childOrder.set('1', []);
    this.childOrder.set('2', []);

    const demo: [string, string, string | undefined][] = [
      ['Избранное', 'folder', undefined],
      ['Работа', 'folder', undefined],
      ['Google', 'bookmark', 'https://google.com'],
      ['GitHub', 'bookmark', 'https://github.com'],
    ];
    for (const [title, kind, url] of demo) {
      const id = this.allocId();
      this.nodes.set(id, {
        parentId: '1',
        title,
        url: kind === 'bookmark' ? url : undefined,
        dateAdded: now,
      });
      this.pushChild('1', id);
    }
  }

  private allocId(): string {
    return String(this.nextId++);
  }

  private persist() {
    localStorage.setItem(
      MOCK_STORAGE_KEY,
      JSON.stringify({
        nodes: Object.fromEntries(this.nodes),
        childOrder: Object.fromEntries(this.childOrder),
        nextId: this.nextId,
      }),
    );
  }

  private pushChild(parentId: string, id: string) {
    const list = this.childOrder.get(parentId) ?? [];
    if (!list.includes(id)) this.childOrder.set(parentId, [...list, id]);
  }

  private removeChildRef(parentId: string, id: string) {
    const list = this.childOrder.get(parentId);
    if (!list) return;
    this.childOrder.set(
      parentId,
      list.filter((c) => c !== id),
    );
  }

  private indexOfChild(parentId: string, id: string): number {
    return (this.childOrder.get(parentId) ?? []).indexOf(id);
  }

  private buildNode(id: string): BookmarkTreeNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`Unknown bookmark id ${id}`);
    const childIds = this.childOrder.get(id) ?? [];
    const children = childIds.map((cid) => this.buildNode(cid));
    const parentId = n.parentId === '' ? undefined : n.parentId;
    const idx = parentId !== undefined ? this.indexOfChild(parentId, id) : undefined;
    return {
      id,
      parentId,
      index: idx >= 0 ? idx : undefined,
      title: n.title,
      url: n.url,
      dateAdded: n.dateAdded,
      children: children.length ? children : undefined,
    };
  }

  getTree(): BookmarkTreeNode[] {
    return [this.buildNode('0')];
  }

  create(arg: BookmarkCreateArg): BookmarkTreeNode {
    const id = this.allocId();
    const parentId = arg.parentId;
    if (!this.nodes.has(parentId)) throw new Error('Invalid parentId');
    const dateAdded = Date.now();
    const internal: InternalNode = {
      parentId,
      title: arg.title ?? '',
      url: arg.url,
      dateAdded,
    };
    this.nodes.set(id, internal);
    const siblings = [...(this.childOrder.get(parentId) ?? [])];
    const insertAt = arg.index !== undefined ? Math.min(arg.index, siblings.length) : siblings.length;
    siblings.splice(insertAt, 0, id);
    this.childOrder.set(parentId, siblings);
    this.childOrder.set(id, []);
    const node = this.buildNode(id);
    this.persist();
    this.listeners.created.forEach((fn) => fn(id, node));
    return node;
  }

  update(id: string, changes: BookmarkChangesArg): BookmarkTreeNode {
    const n = this.nodes.get(id);
    if (!n || id === '0') throw new Error('Cannot update this node');
    const changeInfo: { title?: string; url?: string } = {};
    if (changes.title !== undefined) {
      n.title = changes.title;
      changeInfo.title = changes.title;
    }
    if (changes.url !== undefined) {
      n.url = changes.url;
      changeInfo.url = changes.url;
    }
    this.persist();
    const node = this.buildNode(id);
    this.listeners.changed.forEach((fn) => fn(id, changeInfo));
    return node;
  }

  remove(id: string): void {
    if (id === '0' || id === '1' || id === '2') throw new Error('Cannot remove system folder');
    const n = this.nodes.get(id);
    if (!n) return;
    const parentId = n.parentId;
    const index = this.indexOfChild(parentId, id);
    this.removeChildRef(parentId, id);
    this.nodes.delete(id);
    this.childOrder.delete(id);
    this.persist();
    this.listeners.removed.forEach((fn) => fn(id, { parentId, index }));
  }

  removeTree(id: string): void {
    if (id === '0' || id === '1' || id === '2') throw new Error('Cannot remove system folder');
    const postOrder: string[] = [];
    const postWalk = (nid: string) => {
      for (const c of this.childOrder.get(nid) ?? []) postWalk(c);
      postOrder.push(nid);
    };
    postWalk(id);
    for (const nid of postOrder) {
      const n = this.nodes.get(nid);
      if (!n) continue;
      const parentId = n.parentId;
      const index = this.indexOfChild(parentId, nid);
      this.removeChildRef(parentId, nid);
      this.nodes.delete(nid);
      this.childOrder.delete(nid);
      this.listeners.removed.forEach((fn) => fn(nid, { parentId, index }));
    }
    this.persist();
  }

  move(
    id: string,
    destination: { parentId?: string; index?: number },
  ): BookmarkTreeNode {
    const n = this.nodes.get(id);
    if (!n || id === '0') throw new Error('Cannot move this node');
    const oldParentId = n.parentId;
    const oldIndex = this.indexOfChild(oldParentId, id);
    const newParentId = destination.parentId ?? oldParentId;
    if (!this.nodes.has(newParentId)) throw new Error('Invalid parent');
    this.removeChildRef(oldParentId, id);
    n.parentId = newParentId;
    const siblings = [...(this.childOrder.get(newParentId) ?? [])].filter((c) => c !== id);
    const insertAt =
      destination.index !== undefined ? Math.min(destination.index, siblings.length) : siblings.length;
    siblings.splice(insertAt, 0, id);
    this.childOrder.set(newParentId, siblings);
    this.persist();
    const node = this.buildNode(id);
    this.listeners.moved.forEach((fn) =>
      fn(id, {
        parentId: newParentId,
        index: insertAt,
        oldParentId,
        oldIndex,
      }),
    );
    return node;
  }

  addListener(
    type: 'created' | 'removed' | 'changed' | 'moved',
    fn: ListenerCreated | ListenerRemoved | ListenerChanged | ListenerMoved,
  ) {
    (this.listeners[type] as unknown[]).push(fn);
  }

  removeListener(
    type: 'created' | 'removed' | 'changed' | 'moved',
    fn: ListenerCreated | ListenerRemoved | ListenerChanged | ListenerMoved,
  ) {
    this.listeners[type] = this.listeners[type].filter((x) => x !== fn) as never;
  }
}

let mockEngine: MockBookmarksEngine | null = null;

function getMock(): MockBookmarksEngine {
  if (!mockEngine) mockEngine = new MockBookmarksEngine();
  return mockEngine;
}

function promisifyLastError<T>(fn: (cb: (r: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((r: T) => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve(r);
    });
  });
}

export const bookmarksApi = {
  async getTree(): Promise<BookmarkTreeNode[]> {
    if (hasExtensionBookmarks()) {
      return promisifyLastError((cb) => chrome.bookmarks.getTree(cb)) as Promise<BookmarkTreeNode[]>;
    }
    return Promise.resolve(getMock().getTree());
  },

  async create(arg: BookmarkCreateArg): Promise<BookmarkTreeNode> {
    if (hasExtensionBookmarks()) {
      return promisifyLastError((cb) => chrome.bookmarks.create(arg, cb)) as Promise<BookmarkTreeNode>;
    }
    return Promise.resolve(getMock().create(arg));
  },

  async update(id: string, changes: BookmarkChangesArg): Promise<BookmarkTreeNode> {
    if (hasExtensionBookmarks()) {
      return promisifyLastError((cb) => chrome.bookmarks.update(id, changes, cb)) as Promise<BookmarkTreeNode>;
    }
    return Promise.resolve(getMock().update(id, changes));
  },

  async remove(id: string): Promise<void> {
    if (hasExtensionBookmarks()) {
      await promisifyLastError<void>((cb) => chrome.bookmarks.remove(id, cb));
      return;
    }
    getMock().remove(id);
  },

  async removeTree(id: string): Promise<void> {
    if (hasExtensionBookmarks()) {
      await promisifyLastError<void>((cb) => chrome.bookmarks.removeTree(id, cb));
      return;
    }
    getMock().removeTree(id);
  },

  async move(
    id: string,
    destination: { parentId?: string; index?: number },
  ): Promise<BookmarkTreeNode> {
    if (hasExtensionBookmarks()) {
      return promisifyLastError((cb) => chrome.bookmarks.move(id, destination, cb)) as Promise<BookmarkTreeNode>;
    }
    return Promise.resolve(getMock().move(id, destination));
  },

  addListener(
    type: 'created' | 'removed' | 'changed' | 'moved',
    fn: ListenerCreated | ListenerRemoved | ListenerChanged | ListenerMoved,
  ): void {
    if (hasExtensionBookmarks()) {
      const api = chrome.bookmarks;
      if (type === 'created') api.onCreated.addListener(fn as ListenerCreated);
      else if (type === 'removed') api.onRemoved.addListener(fn as ListenerRemoved);
      else if (type === 'changed') api.onChanged.addListener(fn as ListenerChanged);
      else api.onMoved.addListener(fn as ListenerMoved);
      return;
    }
    getMock().addListener(type, fn);
  },

  removeListener(
    type: 'created' | 'removed' | 'changed' | 'moved',
    fn: ListenerCreated | ListenerRemoved | ListenerChanged | ListenerMoved,
  ): void {
    if (hasExtensionBookmarks()) {
      const api = chrome.bookmarks;
      if (type === 'created') api.onCreated.removeListener(fn as ListenerCreated);
      else if (type === 'removed') api.onRemoved.removeListener(fn as ListenerRemoved);
      else if (type === 'changed') api.onChanged.removeListener(fn as ListenerChanged);
      else api.onMoved.removeListener(fn as ListenerMoved);
      return;
    }
    getMock().removeListener(type, fn);
  },
};
