import * as Raw from "./raw-format";
import type * as T from "./types";

function normalize_glyph(token: string): string {
  if (token.length === 3) {
    return token;
  }
  if (token.length < 3) {
    return token.padEnd(3, " ");
  }
  return token.slice(0, 3);
}

export function create_initial_state(): T.EditorState {
  const grid = Raw.make_empty_grid(20, 20);
  const raw_text = Raw.serialize_raw(grid);
  return {
    grid,
    mode: "visual",
    tool: "move",
    selected_token_key: null,
    selected_token: null,
    current_level_id: null,
    current_level_name: null,
    last_persisted_raw: raw_text,
    is_dirty: false,
    level_sort_mode: "recent",
    modal_state: { kind: "none" },
    viewport: {
      zoom: 1,
      offset_x: 0,
      offset_y: 0
    },
    shared_camera: {
      center_tile_x: grid.width / 2,
      center_tile_y: grid.height / 2,
      visual_zoom: 1
    },
    raw_viewport: {
      font_size_px: 13,
      char_width_px: 8,
      line_height_px: 15.6,
      padding_left_px: 10,
      padding_top_px: 10,
      scroll_left: 0,
      scroll_top: 0
    },
    sync_view: {
      enabled: false
    },
    add_escape_char: {
      enabled: false
    },
    raw_text,
    raw_error: null,
    last_valid_grid: Raw.clone_grid(grid),
    move_selection: null
  };
}

export function clamp_cell(grid: T.GridState, x: number, y: number): [number, number] {
  const nx = Math.max(0, Math.min(grid.width - 1, x));
  const ny = Math.max(0, Math.min(grid.height - 1, y));
  return [nx, ny];
}

export function grid_get(grid: T.GridState, x: number, y: number): T.TileCell | null {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
    return null;
  }
  return grid.cells[y][x];
}

export function grid_set(grid: T.GridState, x: number, y: number, cell: T.TileCell): void {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
    return;
  }
  const normalized_backup =
    typeof cell.entity_backup === "string" ? normalize_glyph(cell.entity_backup) : undefined;
  grid.cells[y][x] = {
    floor: normalize_glyph(cell.floor),
    entity: normalize_glyph(cell.entity),
    entity_backup: normalized_backup
  };
}

export function is_empty_cell(cell: T.TileCell): boolean {
  return cell.floor === Raw.EMPTY_FLOOR && cell.entity === Raw.EMPTY_ENTITY;
}

export function normalize_rect(a_x: number, a_y: number, b_x: number, b_y: number): T.SelectionRect {
  const x0 = Math.min(a_x, b_x);
  const y0 = Math.min(a_y, b_y);
  const x1 = Math.max(a_x, b_x);
  const y1 = Math.max(a_y, b_y);
  return {
    x: x0,
    y: y0,
    w: x1 - x0 + 1,
    h: y1 - y0 + 1
  };
}

export function sync_raw_from_grid(state: T.EditorState): void {
  state.raw_text = Raw.serialize_raw(state.grid);
  state.raw_error = null;
  state.last_valid_grid = Raw.clone_grid(state.grid);
}

export function sync_grid_from_raw(state: T.EditorState, raw_text: string): void {
  state.raw_text = raw_text;
  const parsed = Raw.parse_raw(raw_text);
  if (!parsed.ok) {
    state.raw_error = parsed.error;
    return;
  }
  state.grid = parsed.grid;
  state.raw_text = Raw.serialize_raw(parsed.grid);
  state.last_valid_grid = Raw.clone_grid(parsed.grid);
  state.raw_error = null;
  if (state.move_selection) {
    state.move_selection = null;
  }
}
