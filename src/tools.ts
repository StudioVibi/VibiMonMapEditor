import * as Raw from "./raw-format";
import * as St from "./state";
import type * as T from "./types";

function in_bounds(grid: T.GridState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function apply_paint_at(
  grid: T.GridState,
  x: number,
  y: number,
  token: T.GlyphToken
): void {
  if (!in_bounds(grid, x, y)) {
    return;
  }

  if (token.kind === "bigimg" && (token.width > 1 || token.height > 1)) {
    for (let iy = 0; iy < token.height; iy++) {
      for (let ix = 0; ix < token.width; ix++) {
        const tx = x + ix;
        const ty = y + iy;
        if (!in_bounds(grid, tx, ty)) {
          continue;
        }
        const cell = St.grid_get(grid, tx, ty);
        if (!cell) {
          continue;
        }
        const next = { ...cell, floor: token.token };
        St.grid_set(grid, tx, ty, next);
      }
    }
    return;
  }

  const cell = St.grid_get(grid, x, y);
  if (!cell) {
    return;
  }

  const next = { ...cell };
  if (token.layer === "entity") {
    next.entity = token.token;
    next.entity_backup = undefined;
  } else {
    next.floor = token.token;
  }
  St.grid_set(grid, x, y, next);
}

export function apply_paint_rect(
  grid: T.GridState,
  rect: T.SelectionRect,
  token: T.GlyphToken
): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      apply_paint_at(grid, x, y, token);
    }
  }
}

export function apply_erase_at(grid: T.GridState, x: number, y: number): void {
  if (!in_bounds(grid, x, y)) {
    return;
  }
  St.grid_set(grid, x, y, {
    floor: Raw.EMPTY_FLOOR,
    entity: Raw.EMPTY_ENTITY,
    entity_backup: undefined
  });
}

export function apply_erase_rect(grid: T.GridState, rect: T.SelectionRect): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      apply_erase_at(grid, x, y);
    }
  }
}

export function apply_collider_at(grid: T.GridState, x: number, y: number): void {
  if (!in_bounds(grid, x, y)) {
    return;
  }
  const cell = St.grid_get(grid, x, y);
  if (!cell) {
    return;
  }

  if (cell.entity === Raw.COLLIDER_ENTITY) {
    const restored =
      typeof cell.entity_backup === "string" &&
      cell.entity_backup !== Raw.EMPTY_ENTITY &&
      cell.entity_backup !== Raw.COLLIDER_ENTITY
        ? cell.entity_backup
        : Raw.EMPTY_ENTITY;
    St.grid_set(grid, x, y, {
      ...cell,
      entity: restored,
      entity_backup: undefined
    });
    return;
  }

  St.grid_set(grid, x, y, {
    ...cell,
    entity: Raw.COLLIDER_ENTITY,
    entity_backup: cell.entity
  });
}

export function apply_collider_rect(grid: T.GridState, rect: T.SelectionRect): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      apply_collider_at(grid, x, y);
    }
  }
}

export function move_single_cell(
  grid: T.GridState,
  from_x: number,
  from_y: number,
  to_x: number,
  to_y: number
): void {
  if (!in_bounds(grid, from_x, from_y) || !in_bounds(grid, to_x, to_y)) {
    return;
  }
  const from = St.grid_get(grid, from_x, from_y);
  if (!from || St.is_empty_cell(from)) {
    return;
  }
  const to = St.grid_get(grid, to_x, to_y);
  if (!to) {
    return;
  }

  St.grid_set(grid, to_x, to_y, from);
  St.grid_set(grid, from_x, from_y, {
    floor: Raw.EMPTY_FLOOR,
    entity: Raw.EMPTY_ENTITY
  });
}

export function move_rect(
  grid: T.GridState,
  rect: T.SelectionRect,
  delta_x: number,
  delta_y: number
): void {
  if (delta_x === 0 && delta_y === 0) {
    return;
  }

  const snapshot: T.TileCell[] = [];
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const src_x = rect.x + x;
      const src_y = rect.y + y;
      const cell = St.grid_get(grid, src_x, src_y);
      snapshot.push(cell ? { ...cell } : { floor: Raw.EMPTY_FLOOR, entity: Raw.EMPTY_ENTITY });
    }
  }

  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const src_x = rect.x + x;
      const src_y = rect.y + y;
      if (in_bounds(grid, src_x, src_y)) {
        St.grid_set(grid, src_x, src_y, {
          floor: Raw.EMPTY_FLOOR,
          entity: Raw.EMPTY_ENTITY,
          entity_backup: undefined
        });
      }
    }
  }

  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const idx = y * rect.w + x;
      const dst_x = rect.x + x + delta_x;
      const dst_y = rect.y + y + delta_y;
      if (!in_bounds(grid, dst_x, dst_y)) {
        continue;
      }
      St.grid_set(grid, dst_x, dst_y, snapshot[idx]);
    }
  }
}
