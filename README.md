# WinDesk Bookmarks

Менеджер закладок в интерфейсе «рабочего стола» в духе Windows: иконки на сетке, окна папок, панель задач и контекстные меню.

Доступны два режима:

- **Веб / разработка** (`npm run dev`) — моки `chrome.bookmarks` и `chrome.storage.local` поверх `localStorage`, горячая перезагрузка.
- **Расширение Chrome (Manifest V3)** — переопределение страницы новой вкладки; закладки читаются и изменяются через **`chrome.bookmarks`**, позиции значков и настройки — через **`chrome.storage.local`**.

## Возможности

- Синхронизация с закладками Chrome (создание, переименование, URL, удаление, перенос между папками)
- Позиции иконок на сетке в `chrome.storage.local` (в dev — мок с тем же форматом ключей)
- Обновление UI при изменениях извне (слушатели `chrome.bookmarks.on*`)
- Окна папок, перетаскивание, выделение рамкой, панель задач

## Стек

- [Vite](https://vitejs.dev/) 5, [React](https://react.dev/) 18, TypeScript
- [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- [Zustand](https://zustand-demo.pmnd.rs/) как единое состояние UI (без `persist` закладок)
- [React Router](https://reactrouter.com/) — **`HashRouter`** (совместимость с `chrome-extension://`)
- [Vitest](https://vitest.dev/) для тестов

## Требования

- [Node.js](https://nodejs.org/) 18+ (рекомендуется LTS)
- Для установки расширения: **Google Chrome** (Chromium)

## Установка и запуск (разработка)

```bash
npm install
npm run dev
```

По умолчанию Vite слушает порт **8080** (см. `vite.config.ts`).

## Сборка расширения Chrome

```bash
npm run build:ext
```

В `dist/` появятся `index.html`, `manifest.json`, ассеты с относительными путями (`base: './'`), пригодные для загрузки как распакованное расширение.

### Архив ZIP (удобно перенести на другой ПК)

```bash
npm run pack:ext
```

Команда собирает расширение и создаёт **`release/windesk-bookmarks-<версия>.zip`**. В корне архива — та же структура, что в `dist/` (`index.html`, `manifest.json`, `assets/` и т.д.), без лишней вложенной папки.

На целевой машине: распакуйте архив, затем в Chrome укажите **получившуюся папку** (в ней должен лежать `index.html`). Если упаковать только ZIP без распаковки — Chrome не примет архив как «папку расширения».

Повторно упаковать уже собранный `dist` без пересборки: `npm run zip:ext`.

### Установка в браузере

1. Откройте `chrome://extensions`.
2. Включите **«Режим разработчика»**.
3. **«Загрузить распакованное расширение»** → укажите каталог **`dist/`** после `npm run build:ext` **или** папку после распаковки ZIP из `release/`.
4. Откройте новую вкладку — должна открыться страница WinDesk.

Нужны разрешения из `public/manifest.json`: `bookmarks`, `storage`, `favicon` (иконки сайтов через API favicon расширения).

## Обычная веб-сборка

```bash
npm run build
```

Подходит для статического хостинга; без расширения моки эмулируют API Chrome в браузере.

## Скрипты

| Команда | Назначение |
|--------|------------|
| `npm run dev` | Режим разработки с HMR |
| `npm run build` | Сборка в `dist/` (корень `/`) |
| `npm run build:ext` | Сборка для Chrome extension (`base: './'`, имена чанков без хэша) |
| `npm run pack:ext` | `build:ext` + ZIP в `release/windesk-bookmarks-<версия>.zip` |
| `npm run zip:ext` | Только ZIP из текущего `dist/` (если уже собирали) |
| `npm run preview` | Просмотр `dist` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |

## Данные

| Среда | Закладки | Позиции и настройки UI |
|--------|-----------|-------------------------|
| Расширение | `chrome.bookmarks` | `chrome.storage.local` (`iconPositions`, `settings`) |
| Dev / веб без Chrome API | мок в `localStorage` (префикс `windesk-mock-*`) | мок `chrome.storage.local` |

«Рабочий стол» показывает **верхний уровень панели закладок и «Других закладок»** Chrome (прямые потомки папок с id `1` и `2`), чтобы были видны и ярлыки, и папки с обоих разделов.

## Структура репозитория

```
src/
  extension/           # Фасады chrome.bookmarks / storage + мок для dev
  components/desktop/  # Рабочий стол, окна папок, панель задач
  components/ui/       # shadcn
  lib/                 # Разбор дерева закладок, favicon URL
  store/               # Zustand
  types/
public/
  manifest.json        # Копируется в корень dist (Vite)
```
