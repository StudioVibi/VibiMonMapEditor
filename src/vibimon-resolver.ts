import * as Raw from "./raw-format";
import * as St from "./state";
import type * as T from "./types";

export const VIBIMON_ASSET_ROOT = "vibimon-assets";
export const DEFAULT_FLOOR_ASSET = `${VIBIMON_ASSET_ROOT}/tile_grass_00_00.png`;

function sprite_id(name: string, ix: number, iy: number): string {
  const pad_x = String(ix).padStart(2, "0");
  const pad_y = String(iy).padStart(2, "0");
  return `${name}_${pad_x}_${pad_y}`;
}

function building_asset(name: string, ix: number, iy: number): string {
  if (name.startsWith("icon_") || name === "tile_mountain_door") {
    return `${VIBIMON_ASSET_ROOT}/${name}.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite_id(name, ix, iy)}.png`;
}

function border_id(
  name: string,
  up: boolean,
  dw: boolean,
  lf: boolean,
  rg: boolean,
  up_lf: boolean,
  up_rg: boolean,
  dw_lf: boolean,
  dw_rg: boolean
): string {
  const base = `${name}_`;
  let suffix = "center";

  switch (true) {
    case !up && !lf:
      suffix = "outer_top_lft";
      break;
    case !up && !rg:
      suffix = "outer_top_rgt";
      break;
    case !dw && !lf:
      suffix = "outer_bot_lft";
      break;
    case !dw && !rg:
      suffix = "outer_bot_rgt";
      break;
    case !up:
      suffix = "edge_top";
      break;
    case !dw:
      suffix = "edge_bot";
      break;
    case !lf:
      suffix = "edge_lft";
      break;
    case !rg:
      suffix = "edge_rgt";
      break;
    case !up_lf:
      suffix = "inner_top_lft";
      break;
    case !up_rg:
      suffix = "inner_top_rgt";
      break;
    case !dw_lf:
      suffix = "inner_bot_lft";
      break;
    case !dw_rg:
      suffix = "inner_bot_rgt";
      break;
  }

  return base + suffix;
}

function same_floor(grid: T.GridState, x: number, y: number, token: string): boolean {
  const cell = St.grid_get(grid, x, y);
  if (!cell) {
    return false;
  }
  return cell.floor === token;
}

function top_left_of_block(grid: T.GridState, x: number, y: number, token: string): [number, number] {
  let ox = x;
  let oy = y;

  while (ox > 0 && same_floor(grid, ox - 1, oy, token)) {
    ox -= 1;
  }
  while (oy > 0 && same_floor(grid, ox, oy - 1, token)) {
    oy -= 1;
  }
  return [ox, oy];
}

function floor_asset(
  grid: T.GridState,
  x: number,
  y: number,
  token_map: Map<string, T.GlyphToken>
): string {
  const cell = St.grid_get(grid, x, y);
  if (!cell) {
    return DEFAULT_FLOOR_ASSET;
  }

  const tok = cell.floor;
  if (tok === Raw.EMPTY_FLOOR) {
    return DEFAULT_FLOOR_ASSET;
  }

  const def = token_map.get(tok);
  if (!def) {
    return "";
  }

  if (def.kind === "bordered") {
    const up = same_floor(grid, x, y - 1, tok);
    const dw = same_floor(grid, x, y + 1, tok);
    const lf = same_floor(grid, x - 1, y, tok);
    const rg = same_floor(grid, x + 1, y, tok);
    const up_lf = same_floor(grid, x - 1, y - 1, tok);
    const up_rg = same_floor(grid, x + 1, y - 1, tok);
    const dw_lf = same_floor(grid, x - 1, y + 1, tok);
    const dw_rg = same_floor(grid, x + 1, y + 1, tok);
    const id = border_id(def.name, up, dw, lf, rg, up_lf, up_rg, dw_lf, dw_rg);
    return `${VIBIMON_ASSET_ROOT}/${id}.png`;
  }

  if (def.kind === "building") {
    if (def.width > 1 || def.height > 1) {
      const [ox, oy] = top_left_of_block(grid, x, y, tok);
      const ix = (x - ox) % def.width;
      const iy = (y - oy) % def.height;
      return building_asset(def.name, ix, iy);
    }
    return building_asset(def.name, 0, 0);
  }

  if (def.kind === "marker") {
    return DEFAULT_FLOOR_ASSET;
  }

  return "";
}

function entity_asset(
  grid: T.GridState,
  x: number,
  y: number,
  token_map: Map<string, T.GlyphToken>
): string {
  const cell = St.grid_get(grid, x, y);
  if (!cell) {
    return "";
  }
  const tok = cell.entity;
  if (tok === Raw.EMPTY_ENTITY) {
    return "";
  }
  const def = token_map.get(tok);
  if (!def || def.kind !== "entity" || !def.sprite) {
    return "";
  }
  return `${VIBIMON_ASSET_ROOT}/${def.sprite}_front_stand.png`;
}

export interface ResolvedCellVisual {
  floor_asset: string;
  entity_asset: string;
  floor_glyph: string;
  entity_glyph: string;
}

export function resolve_cell_visual(
  grid: T.GridState,
  x: number,
  y: number,
  token_map: Map<string, T.GlyphToken>
): ResolvedCellVisual {
  const cell = St.grid_get(grid, x, y);
  if (!cell) {
    return {
      floor_asset: DEFAULT_FLOOR_ASSET,
      entity_asset: "",
      floor_glyph: Raw.EMPTY_FLOOR,
      entity_glyph: Raw.EMPTY_ENTITY
    };
  }

  return {
    floor_asset: floor_asset(grid, x, y, token_map),
    entity_asset: entity_asset(grid, x, y, token_map),
    floor_glyph: cell.floor,
    entity_glyph: cell.entity
  };
}
