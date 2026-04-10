import type { DesktopSettings, IconSize } from '@/types/bookmark';

/** Размер ячейки сетки (как в Desktop.tsx / DesktopIcon). */
export const DESKTOP_CELL_SIZE: Record<IconSize, number> = {
  small: 70,
  medium: 90,
  large: 110,
};

/**
 * Сколько колонок помещается на экране по ширине (без горизонтального «уезда» за край).
 * Заполнение идёт по строкам: слева направо, затем следующая строка.
 */
export function getMaxGridColumns(settings: DesktopSettings): number {
  if (typeof window === 'undefined') return 12;
  const cell = DESKTOP_CELL_SIZE[settings.iconSize];
  const reserve = 40;
  const w = Math.max(0, window.innerWidth - reserve);
  return Math.max(4, Math.min(48, Math.floor(w / cell)));
}

/** Первая свободная ячейка: строка за строкой (слева направо), затем вниз. */
export function findFreeGridSlot(
  occupied: Set<string>,
  maxCols: number,
): { gridX: number; gridY: number } {
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < maxCols; x++) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) return { gridX: x, gridY: y };
    }
  }
  return { gridX: 0, gridY: 0 };
}
