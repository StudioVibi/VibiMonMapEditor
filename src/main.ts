import * as Dom from "./dom";
import * as Cam from "./camera-sync";
import * as Cat from "./glyph-catalog";
import * as History from "./history";
import * as Shortcuts from "./keyboard-shortcuts";
import * as Store from "./level-storage";
import * as Raw from "./raw-format";
import * as St from "./state";
import * as Tools from "./tools";
import type * as T from "./types";
import { DEFAULT_FLOOR_ASSET, VIBIMON_ASSET_ROOT, resolve_cell_visual } from "./vibimon-resolver";
import * as Visual from "./visual-render";

const raw_debounce_ms = 180;
const raw_font_min_px = 8;
const raw_font_max_px = 96;
const raw_font_default_px = 13;
const preview_tile_size = 12;
const preview_frame_width = 300;
const preview_frame_height = 144;

const date_formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

const root = document.querySelector("#app");
if (!root) {
  throw new Error("App root not found.");
}

const refs = Dom.mount_app(root);
const visual = Visual.create_visual_renderer(
  refs.visual_stage,
  refs.visual_grid,
  refs.visual_overlay
);
const state = St.create_initial_state();
let tokens: T.GlyphToken[] = [];
let token_by_key = new Map<string, T.GlyphToken>();
let token_filter = "";
let raw_timer: number | null = null;
let is_space_down = false;
let highlighted_glyph_index = -1;
let filtered_tokens: T.GlyphToken[] = [];
let level_search_query = "";
let load_selected_level_id: string | null = null;
let modal_error_text = "";
let status_flash_text: string | null = null;
let status_flash_timer: number | null = null;

let pointer_drag:
  | null
  | {
      kind: "pan";
      start_x: number;
      start_y: number;
      base_offset_x: number;
      base_offset_y: number;
    }
  | {
      kind: "paint_rect";
      start_x: number;
      start_y: number;
      end_x: number;
      end_y: number;
    }
  | {
      kind: "collider_rect";
      start_x: number;
      start_y: number;
      end_x: number;
      end_y: number;
    }
  | {
      kind: "rubber_rect";
      start_x: number;
      start_y: number;
      end_x: number;
      end_y: number;
    }
  | {
      kind: "move_single";
      from_x: number;
      from_y: number;
      to_x: number;
      to_y: number;
    }
  | {
      kind: "move_select";
      start_x: number;
      start_y: number;
      end_x: number;
      end_y: number;
    }
  | {
      kind: "move_block";
      origin: T.SelectionRect;
      start_x: number;
      start_y: number;
      delta_x: number;
      delta_y: number;
    } = null;

function cell_key(x: number, y: number): string {
  return `${x},${y}`;
}

function in_rect(x: number, y: number, rect: T.SelectionRect): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

function clamp_delta_for_rect(rect: T.SelectionRect, dx: number, dy: number): [number, number] {
  const min_dx = -rect.x;
  const min_dy = -rect.y;
  const max_dx = state.grid.width - (rect.x + rect.w);
  const max_dy = state.grid.height - (rect.y + rect.h);
  const ndx = Math.max(min_dx, Math.min(max_dx, dx));
  const ndy = Math.max(min_dy, Math.min(max_dy, dy));
  return [ndx, ndy];
}

function sprite_id(name: string, ix: number, iy: number): string {
  const pad_x = String(ix).padStart(2, "0");
  const pad_y = String(iy).padStart(2, "0");
  return `${name}_${pad_x}_${pad_y}`;
}

function bigimg_preview_asset(token: T.GlyphToken): string {
  if (token.single) {
    return `${VIBIMON_ASSET_ROOT}/${token.name}.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite_id(token.name, 0, 0)}.png`;
}

function entity_preview_asset(sprite: string): string {
  if (sprite.startsWith("ent_")) {
    return `${VIBIMON_ASSET_ROOT}/${sprite}_front_stand.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite}.png`;
}

function preview_asset(token: T.GlyphToken): string {
  if (token.token === Raw.EMPTY_FLOOR) {
    return DEFAULT_FLOOR_ASSET;
  }

  if ((token.kind === "entity" || token.kind === "player") && token.sprite) {
    return entity_preview_asset(token.sprite);
  }

  if (token.kind === "borded") {
    return `${VIBIMON_ASSET_ROOT}/${token.name}_center.png`;
  }

  if (token.kind === "bigimg") {
    return bigimg_preview_asset(token);
  }

  return DEFAULT_FLOOR_ASSET;
}

function refresh_status(): void {
  if (status_flash_text) {
    Dom.set_status_html(refs, `<span class="status-success">${escape_html(status_flash_text)}</span>`);
    return;
  }

  let level_html = `<span class="status-unsaved">(unsaved)</span>`;
  if (state.current_level_name) {
    level_html = state.is_dirty
      ? `${escape_html(state.current_level_name)} <span class="status-unsaved">(unsaved)</span>`
      : escape_html(state.current_level_name);
  }

  const segments = [
    `Level: ${level_html}`,
    `Mode: ${state.mode.toUpperCase()}`,
    `Sync: ${state.sync_view.enabled ? "ON" : "OFF"}`,
    `Tool: ${state.tool}`,
    `Grid: ${state.grid.width}x${state.grid.height}`
  ];
  const html = segments
    .map((segment, idx) => (idx === 0 ? segment : escape_html(segment)))
    .join(' <span class="status-sep">|</span> ');
  Dom.set_status_html(refs, html);
}

function flash_status(text: string, duration_ms = 2000): void {
  status_flash_text = text;
  if (status_flash_timer !== null) {
    window.clearTimeout(status_flash_timer);
  }
  Dom.set_status_html(refs, `<span class="status-success">${escape_html(text)}</span>`);
  status_flash_timer = window.setTimeout(() => {
    status_flash_text = null;
    status_flash_timer = null;
    refresh_status();
  }, duration_ms);
}

function refresh_map_name(): void {
  Dom.set_map_name(refs, state.current_level_name);
}

function update_dirty_flag(): void {
  state.is_dirty = state.raw_text !== state.last_persisted_raw;
}

function escape_raw_for_typescript(raw: string): string {
  return raw.replace(/\\/g, "\\\\");
}

function unescape_raw_from_typescript(raw: string): string {
  return raw.replace(/\\\\/g, "\\");
}

function raw_for_textarea(raw: string): string {
  if (!state.add_escape_char.enabled) {
    return raw;
  }
  return escape_raw_for_typescript(raw);
}

function raw_from_textarea(raw: string): string {
  if (!state.add_escape_char.enabled) {
    return raw;
  }
  return unescape_raw_from_typescript(raw);
}

function sync_raw_textarea_with_state(): void {
  refs.raw_textarea.value = raw_for_textarea(state.raw_text);
}

function refresh_interaction_ui(): void {
  refs.visual_stage.dataset.tool = state.tool;
  const blocked = state.mode === "visual" && state.tool === "paint" && !state.selected_token;
  refs.visual_stage.classList.toggle("is-action-blocked", blocked);
  refs.visual_stage.classList.toggle("is-panning", is_space_down);
}

function clear_move_preview(): void {
  visual.set_move_preview(null);
}

function paint_preview_for_cell(cell: { x: number; y: number } | null): void {
  if (!cell || state.mode !== "visual" || state.tool !== "paint" || !state.selected_token) {
    visual.set_paint_preview(null);
    return;
  }

  const token = state.selected_token;
  const w = token.single ? 1 : Math.max(1, token.width || 1);
  const h = token.single ? 1 : Math.max(1, token.height || 1);
  const rect = { x: cell.x, y: cell.y, w, h };
  const invalid = rect.x + rect.w > state.grid.width || rect.y + rect.h > state.grid.height;
  visual.set_paint_preview(rect, token, invalid);
}

function rebuild_visual(): void {
  visual.rebuild_grid(state.grid, token_by_key);
  visual.set_transform(state.viewport);
  visual.set_selection(state.move_selection);
  clear_move_preview();
  visual.set_paint_preview(null);
}

function perform_undo(): void {
  const restored = History.undo(state.grid);
  if (!restored) {
    return;
  }
  state.grid = restored;
  state.move_selection = null;
  sync_grid_and_views();
  rebuild_visual();
  flash_status("Undo");
}

function perform_redo(): void {
  const restored = History.redo(state.grid);
  if (!restored) {
    return;
  }
  state.grid = restored;
  state.move_selection = null;
  sync_grid_and_views();
  rebuild_visual();
  flash_status("Redo");
}

function sync_grid_and_views(): void {
  visual.refresh_grid(state.grid, token_by_key);
  St.sync_raw_from_grid(state);
  update_dirty_flag();
  if (state.mode === "raw") {
    sync_raw_textarea_with_state();
  }
  Dom.set_raw_error(refs, state.raw_error);
  refresh_status();
}

function clamp_camera_to_grid(camera: T.SharedCameraState): T.SharedCameraState {
  const max_x = Math.max(0, state.grid.width - 1);
  const max_y = Math.max(0, state.grid.height - 1);
  return {
    center_tile_x: Math.max(0, Math.min(max_x, camera.center_tile_x)),
    center_tile_y: Math.max(0, Math.min(max_y, camera.center_tile_y)),
    visual_zoom: camera.visual_zoom
  };
}

function capture_camera_from_visual(): void {
  const stage = visual.stage_rect();
  const scroll_left = refs.visual_stage.scrollLeft;
  const scroll_top = refs.visual_stage.scrollTop;
  const viewport = {
    zoom: state.viewport.zoom,
    offset_x: state.viewport.offset_x - scroll_left,
    offset_y: state.viewport.offset_y - scroll_top
  };
  state.shared_camera = clamp_camera_to_grid(
    Cam.visual_to_camera(viewport, { width: stage.width, height: stage.height })
  );
}

function capture_camera_from_raw(): void {
  const metrics = Cam.measure_raw_metrics(refs.raw_textarea);
  state.raw_viewport = metrics;
  const viewport = Cam.read_raw_viewport_size(refs.raw_textarea);
  const visual_zoom = Cam.raw_font_px_to_visual_zoom(metrics.font_size_px, metrics);
  state.shared_camera = clamp_camera_to_grid(
    Cam.raw_scroll_to_camera(metrics, viewport, visual_zoom)
  );
}

function apply_camera_to_visual(): void {
  const stage = visual.stage_rect();
  const scroll_left = refs.visual_stage.scrollLeft;
  const scroll_top = refs.visual_stage.scrollTop;
  const viewport = Cam.camera_to_visual(
    state.shared_camera,
    { width: stage.width, height: stage.height }
  );
  state.viewport = {
    zoom: viewport.zoom,
    offset_x: viewport.offset_x + scroll_left,
    offset_y: viewport.offset_y + scroll_top
  };
}

function raw_selection_range_for_tile(tile_x: number, tile_y: number): { start: number; end: number } | null {
  if (tile_x < 0 || tile_y < 0) {
    return null;
  }
  const raw_lines = state.raw_text.split("\n");
  const line_index = tile_y * 2 + 1;
  if (line_index < 0 || line_index >= raw_lines.length) {
    return null;
  }

  const line = raw_lines[line_index];
  if (!line) {
    return null;
  }

  const tile_count = Math.floor(line.length / 4);
  if (tile_count <= 0) {
    return null;
  }

  const target_tile = Math.max(0, Math.min(tile_count - 1, tile_x));
  let start_col = 0;
  for (let x = 0; x < target_tile; x++) {
    const token = line.slice(x * 4, x * 4 + 3);
    start_col += raw_for_textarea(token).length + 1;
  }

  const target_token = line.slice(target_tile * 4, target_tile * 4 + 3);
  const cell_width = raw_for_textarea(target_token).length + 1;

  let offset = 0;
  for (let i = 0; i < line_index; i++) {
    offset += raw_for_textarea(raw_lines[i]).length + 1;
  }

  const display_line = raw_for_textarea(line);
  const start = offset + start_col;
  const end = Math.min(start + cell_width, offset + display_line.length);
  if (end <= start) {
    return null;
  }
  return { start, end };
}

function focus_raw_tile_from_camera(): void {
  const tile_x = Math.max(0, Math.min(state.grid.width - 1, Math.floor(state.shared_camera.center_tile_x)));
  const tile_y = Math.max(0, Math.min(state.grid.height - 1, Math.floor(state.shared_camera.center_tile_y)));
  const range = raw_selection_range_for_tile(tile_x, tile_y);
  if (!range) {
    return;
  }
  refs.raw_textarea.setSelectionRange(range.start, range.end);
}

function apply_camera_to_raw(): void {
  const base_metrics = Cam.measure_raw_metrics(refs.raw_textarea);
  const target_font = Cam.visual_zoom_to_raw_font_px(state.shared_camera.visual_zoom, base_metrics);
  const clamped_font = Math.max(raw_font_min_px, Math.min(raw_font_max_px, target_font));
  refs.raw_textarea.style.fontSize = `${clamped_font}px`;

  const next_metrics = Cam.measure_raw_metrics(refs.raw_textarea);
  const viewport = Cam.read_raw_viewport_size(refs.raw_textarea);
  const scroll = Cam.camera_to_raw_scroll(state.shared_camera, next_metrics, viewport);
  refs.raw_textarea.scrollLeft = scroll.left;
  refs.raw_textarea.scrollTop = scroll.top;
  state.raw_viewport = Cam.measure_raw_metrics(refs.raw_textarea);
  focus_raw_tile_from_camera();
}

function reset_raw_zoom_to_default(): void {
  refs.raw_textarea.style.fontSize = `${raw_font_default_px}px`;
  state.raw_viewport = Cam.measure_raw_metrics(refs.raw_textarea);
}

function escape_html(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sorted_levels(levels: T.PersistedLevel[]): T.PersistedLevel[] {
  if (state.level_sort_mode === "name") {
    return [...levels].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  return [...levels].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

function set_modal_state(next: T.ModalState): void {
  state.modal_state = next;
  render_modal();
}

function close_modal(): void {
  modal_error_text = "";
  set_modal_state({ kind: "none" });
}

function open_save_modal(mode: T.SaveModalMode, error_text = ""): void {
  modal_error_text = error_text;
  set_modal_state({ kind: "save", mode });
}

function open_load_modal(reset_search = true): void {
  if (reset_search) {
    level_search_query = "";
  }
  if (state.modal_state.kind !== "load") {
    load_selected_level_id = state.current_level_id;
  }
  modal_error_text = "";
  set_modal_state({ kind: "load" });
}

function set_saved_level_state(level: T.PersistedLevel): void {
  state.current_level_id = level.id;
  state.current_level_name = level.name;
  state.last_persisted_raw = state.raw_text;
  update_dirty_flag();
  refresh_map_name();
  refresh_status();
}

function persist_level(name: string, id: string | null): T.PersistedLevel {
  const parsed = Raw.parse_raw(state.raw_text);
  const width = parsed.ok ? parsed.grid.width : state.grid.width;
  const height = parsed.ok ? parsed.grid.height : state.grid.height;
  return Store.save_level({
    id,
    name,
    raw_text: state.raw_text,
    grid_width: width,
    grid_height: height
  });
}

function save_current_level(name: string, mode: T.SaveModalMode): void {
  try {
    const target_id = mode === "save-as" ? null : state.current_level_id;
    const saved = persist_level(name, target_id);
    set_saved_level_state(saved);
    close_modal();
    const prefix = mode === "save-as" ? "Saved as" : "Saved";
    flash_status(`${prefix}: ${saved.name}`);
  } catch (err) {
    modal_error_text = `Save failed: ${String(err)}`;
    render_modal();
  }
}

function quick_save_current_level(): void {
  if (!state.current_level_id || !state.current_level_name) {
    open_save_modal("regular");
    return;
  }

  try {
    const saved = persist_level(state.current_level_name, state.current_level_id);
    set_saved_level_state(saved);
    flash_status(`Saved: ${saved.name}`);
  } catch (err) {
    open_save_modal("regular", `Save failed: ${String(err)}`);
  }
}

function request_save_action(): void {
  if (state.current_level_id) {
    quick_save_current_level();
    return;
  }
  open_save_modal("regular");
}

function request_save_as_action(): void {
  open_save_modal("save-as");
}

function find_level(level_id: string): T.PersistedLevel | null {
  try {
    return Store.get_level(level_id);
  } catch {
    return null;
  }
}

function apply_level_from_library(level_id: string): void {
  const level = find_level(level_id);
  if (!level) {
    modal_error_text = "Level not found in local storage.";
    render_modal();
    return;
  }

  const parsed = Raw.parse_raw(level.raw_text);
  if (!parsed.ok) {
    modal_error_text = `Could not load this level: ${parsed.error}`;
    render_modal();
    return;
  }

  state.raw_text = level.raw_text;
  state.grid = parsed.grid;
  state.last_valid_grid = Raw.clone_grid(parsed.grid);
  state.raw_error = null;
  state.move_selection = null;
  History.clear();
  sync_raw_textarea_with_state();
  Dom.set_raw_error(refs, null);
  rebuild_visual();

  state.current_level_id = level.id;
  state.current_level_name = level.name;
  state.last_persisted_raw = state.raw_text;
  update_dirty_flag();
  refresh_map_name();
  refresh_status();

  if (state.mode === "raw") {
    refs.raw_textarea.focus();
  }
  close_modal();
}

function request_level_load(level_id: string): void {
  if (state.is_dirty && state.current_level_id !== level_id) {
    modal_error_text = "";
    set_modal_state({ kind: "confirm-discard", level_id });
    return;
  }
  apply_level_from_library(level_id);
}

function preview_img(src: string, fallback_to_floor: boolean): HTMLImageElement {
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  img.loading = "lazy";
  img.onerror = () => {
    if (fallback_to_floor && img.dataset.fallbackApplied !== "1") {
      img.dataset.fallbackApplied = "1";
      img.src = DEFAULT_FLOOR_ASSET;
      return;
    }
    img.style.display = "none";
  };
  img.dataset.fallbackApplied = "0";
  img.src = src;
  return img;
}

function create_level_preview(level: T.PersistedLevel): HTMLDivElement {
  const frame = document.createElement("div");
  frame.className = "level-preview-frame";

  const parsed = Raw.parse_raw(level.raw_text);
  if (!parsed.ok) {
    const invalid = document.createElement("div");
    invalid.className = "level-preview-invalid";
    invalid.textContent = "Invalid RAW";
    frame.appendChild(invalid);
    return frame;
  }

  const grid = parsed.grid;
  const world = document.createElement("div");
  world.className = "level-preview-world";
  const world_w = grid.width * preview_tile_size;
  const world_h = grid.height * preview_tile_size;
  const scale = Math.min((preview_frame_width - 8) / world_w, (preview_frame_height - 8) / world_h, 1);
  const offset_x = (preview_frame_width - world_w * scale) / 2;
  const offset_y = (preview_frame_height - world_h * scale) / 2;
  world.style.width = `${world_w}px`;
  world.style.height = `${world_h}px`;
  world.style.transform = `translate(${offset_x}px, ${offset_y}px) scale(${scale})`;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const data = resolve_cell_visual(grid, x, y, token_by_key);
      const tile = document.createElement("div");
      tile.className = "level-preview-tile";
      tile.style.left = `${x * preview_tile_size}px`;
      tile.style.top = `${y * preview_tile_size}px`;
      tile.style.width = `${preview_tile_size}px`;
      tile.style.height = `${preview_tile_size}px`;

      if (data.floor_asset) {
        const floor = preview_img(data.floor_asset, true);
        floor.className = "level-preview-floor";
        tile.appendChild(floor);
      }

      if (data.entity_asset) {
        const ent = preview_img(data.entity_asset, false);
        ent.className = "level-preview-entity";
        tile.appendChild(ent);
      }

      world.appendChild(tile);
    }
  }

  frame.appendChild(world);
  return frame;
}

function level_meta(level: T.PersistedLevel): string {
  const updated = Date.parse(level.updated_at);
  const when = Number.isFinite(updated) ? date_formatter.format(new Date(updated)) : level.updated_at;
  return `${level.grid_width}x${level.grid_height} • ${when}`;
}

function get_load_cards(): HTMLDivElement[] {
  if (state.modal_state.kind !== "load") {
    return [];
  }
  return Array.from(refs.modal_body.querySelectorAll<HTMLDivElement>(".level-card[data-level-id]"));
}

function refresh_load_selection_ui(scroll = false): void {
  const cards = get_load_cards();
  for (const card of cards) {
    card.classList.toggle("keyboard-selected", card.dataset.levelId === load_selected_level_id);
  }

  if (!scroll || !load_selected_level_id) {
    return;
  }
  const selected = cards.find((card) => card.dataset.levelId === load_selected_level_id);
  selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function ensure_load_selection(levels: T.PersistedLevel[]): void {
  if (levels.length === 0) {
    load_selected_level_id = null;
    return;
  }

  const ids = new Set(levels.map((level) => level.id));
  if (load_selected_level_id && ids.has(load_selected_level_id)) {
    return;
  }

  if (state.current_level_id && ids.has(state.current_level_id)) {
    load_selected_level_id = state.current_level_id;
    return;
  }

  load_selected_level_id = levels[0].id;
}

function create_level_card(level: T.PersistedLevel): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "level-card";
  card.dataset.levelId = level.id;
  if (state.current_level_id === level.id) {
    card.classList.add("current");
  }
  if (load_selected_level_id === level.id) {
    card.classList.add("keyboard-selected");
  }

  const preview = create_level_preview(level);
  card.appendChild(preview);

  const content = document.createElement("div");
  content.className = "level-card-content";

  const name = document.createElement("div");
  name.className = "level-name";
  name.textContent = level.name;
  content.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "level-meta";
  meta.textContent = level_meta(level);
  content.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "level-actions";

  const load_btn = document.createElement("button");
  load_btn.type = "button";
  load_btn.className = "modal-btn primary";
  load_btn.textContent = "Load";
  load_btn.addEventListener("click", () => {
    load_selected_level_id = level.id;
    refresh_load_selection_ui();
    request_level_load(level.id);
  });
  actions.appendChild(load_btn);

  const rename_btn = document.createElement("button");
  rename_btn.type = "button";
  rename_btn.className = "modal-btn";
  rename_btn.textContent = "Rename";
  rename_btn.addEventListener("click", () => {
    modal_error_text = "";
    set_modal_state({ kind: "rename", level_id: level.id });
  });
  actions.appendChild(rename_btn);

  const delete_btn = document.createElement("button");
  delete_btn.type = "button";
  delete_btn.className = "modal-btn danger";
  delete_btn.textContent = "Delete";
  delete_btn.addEventListener("click", () => {
    modal_error_text = "";
    set_modal_state({ kind: "confirm-delete", level_id: level.id });
  });
  actions.appendChild(delete_btn);

  content.appendChild(actions);
  card.appendChild(content);

  card.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (target?.closest(".modal-btn")) {
      return;
    }
    load_selected_level_id = level.id;
    refresh_load_selection_ui();
  });

  return card;
}

function render_save_modal(): void {
  if (state.modal_state.kind !== "save") {
    return;
  }

  const save_mode = state.modal_state.mode;
  const is_save_as = save_mode === "save-as";
  Dom.set_modal_title(refs, is_save_as ? "Save As New" : "Save Level");
  refs.modal_body.innerHTML = `
    <div class="save-layout">
      <form id="save-form" class="modal-form save-form">
        <label class="modal-field-label" for="save-level-name">Level Name</label>
        <input id="save-level-name" class="modal-input" type="text" maxlength="80" />
        <p id="save-help" class="modal-help"></p>
        <div class="modal-actions">
          <button id="save-cancel" class="modal-btn" type="button">Cancel</button>
          <button class="modal-btn primary" type="submit">${is_save_as ? "Save As" : "Save"}</button>
        </div>
      </form>
      <section class="save-existing-pane" aria-label="Existing levels">
        <h3 class="save-existing-title">Existing Levels</h3>
        <div id="save-existing-list" class="save-existing-list sprite-list"></div>
      </section>
    </div>
  `;

  const form = refs.modal_body.querySelector("#save-form") as HTMLFormElement;
  const name_input = refs.modal_body.querySelector("#save-level-name") as HTMLInputElement;
  const help_el = refs.modal_body.querySelector("#save-help") as HTMLParagraphElement;
  const cancel_btn = refs.modal_body.querySelector("#save-cancel") as HTMLButtonElement;
  const existing_list = refs.modal_body.querySelector("#save-existing-list") as HTMLDivElement;
  const base_help = is_save_as
    ? "Save As creates a new local level, keeping the current one."
    : "Save will update the current level when it already exists.";

  let help_text = modal_error_text || base_help;
  let help_is_error = !!modal_error_text;
  let existing_levels: T.PersistedLevel[] = [];
  try {
    existing_levels = sorted_levels(Store.list_levels());
  } catch (err) {
    if (!help_is_error) {
      help_text = `Could not list saved levels: ${String(err)}`;
      help_is_error = true;
    }
  }

  help_el.textContent = help_text;
  help_el.classList.toggle("error", help_is_error);
  name_input.value = state.current_level_name || "";
  name_input.focus();
  name_input.select();

  let selected_existing_id: string | null = state.current_level_id;
  const sync_existing_highlight = () => {
    for (const child of existing_list.children) {
      if (!(child instanceof HTMLButtonElement)) {
        continue;
      }
      child.classList.toggle("active", child.dataset.levelId === selected_existing_id);
    }
  };
  const sync_selected_from_input = () => {
    const query = name_input.value.trim().toLowerCase();
    const match = existing_levels.find((level) => level.name.toLowerCase() === query);
    selected_existing_id = match ? match.id : null;
    sync_existing_highlight();
  };

  existing_list.innerHTML = "";
  if (existing_levels.length === 0) {
    const empty = document.createElement("div");
    empty.className = "save-existing-empty";
    empty.textContent = "No saved levels yet.";
    existing_list.appendChild(empty);
  } else {
    for (const level of existing_levels) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "save-existing-item sprite-item";
      item.dataset.levelId = level.id;

      const badge = document.createElement("span");
      badge.className = "save-existing-badge";
      badge.textContent = "LV";
      item.appendChild(badge);

      const glyph = document.createElement("span");
      glyph.className = "sprite-glyph";
      glyph.textContent = `${level.grid_width}x${level.grid_height}`;
      item.appendChild(glyph);

      const details = document.createElement("span");
      details.className = "sprite-details";

      const label = document.createElement("span");
      label.className = "sprite-label";
      label.textContent = level.name;
      details.appendChild(label);

      const meta = document.createElement("span");
      meta.className = "sprite-row-meta";
      meta.textContent = level_meta(level);
      details.appendChild(meta);

      item.appendChild(details);

      item.addEventListener("click", () => {
        selected_existing_id = level.id;
        name_input.value = level.name;
        sync_existing_highlight();
        name_input.focus();
        name_input.select();
      });

      existing_list.appendChild(item);
    }
  }
  sync_selected_from_input();

  name_input.addEventListener("input", () => {
    sync_selected_from_input();
  });
  cancel_btn.addEventListener("click", () => close_modal());
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    save_current_level(name_input.value, save_mode);
  });
}

function render_load_modal(): void {
  Dom.set_modal_title(refs, "Load Level");
  refs.modal_body.innerHTML = `
    <div class="library-toolbar">
      <input id="library-search" class="library-search" type="text" placeholder="Search level name..." />
      <div class="sort-segment" role="tablist" aria-label="Sort levels">
        <button id="sort-recent" class="sort-segment-btn" type="button">Recent</button>
        <button id="sort-name" class="sort-segment-btn" type="button">A-Z</button>
      </div>
    </div>
    <div id="load-error" class="modal-error"></div>
    <div id="level-grid" class="level-grid"></div>
  `;

  const search = refs.modal_body.querySelector("#library-search") as HTMLInputElement;
  const sort_recent = refs.modal_body.querySelector("#sort-recent") as HTMLButtonElement;
  const sort_name = refs.modal_body.querySelector("#sort-name") as HTMLButtonElement;
  const error_el = refs.modal_body.querySelector("#load-error") as HTMLDivElement;
  const grid = refs.modal_body.querySelector("#level-grid") as HTMLDivElement;

  search.value = level_search_query;
  error_el.textContent = modal_error_text;
  sort_recent.classList.toggle("active", state.level_sort_mode === "recent");
  sort_name.classList.toggle("active", state.level_sort_mode === "name");

  let levels: T.PersistedLevel[] = [];
  try {
    levels = Store.search_levels(level_search_query);
  } catch (err) {
    error_el.textContent = `Storage error: ${String(err)}`;
  }
  levels = sorted_levels(levels);
  ensure_load_selection(levels);

  grid.innerHTML = "";
  if (levels.length === 0) {
    const empty = document.createElement("div");
    empty.className = "level-empty";
    empty.textContent = level_search_query
      ? "No saved levels match this search."
      : "No saved levels yet.";
    grid.appendChild(empty);
  } else {
    for (const level of levels) {
      grid.appendChild(create_level_card(level));
    }
    refresh_load_selection_ui();
  }

  search.addEventListener("input", () => {
    level_search_query = search.value;
    render_load_modal();
  });
  sort_recent.addEventListener("click", () => {
    state.level_sort_mode = "recent";
    render_load_modal();
  });
  sort_name.addEventListener("click", () => {
    state.level_sort_mode = "name";
    render_load_modal();
  });
}

function toggle_load_sort(direction: "forward" | "backward"): void {
  const order: T.LevelSortMode[] = ["recent", "name"];
  const current_index = order.indexOf(state.level_sort_mode);
  const delta = direction === "forward" ? 1 : -1;
  const next_index = (current_index + delta + order.length) % order.length;
  state.level_sort_mode = order[next_index];
  render_load_modal();
}

function load_search_is_focused(): boolean {
  if (state.modal_state.kind !== "load") {
    return false;
  }
  const search = refs.modal_body.querySelector("#library-search");
  return document.activeElement === search;
}

function move_load_selection(direction: "left" | "right" | "up" | "down"): void {
  if (state.modal_state.kind !== "load") {
    return;
  }

  const cards = get_load_cards();
  if (cards.length === 0) {
    load_selected_level_id = null;
    return;
  }

  type RowItem = { id: string; card: HTMLDivElement; left: number };
  const rows: RowItem[][] = [];
  const row_tops: number[] = [];
  const tolerance_px = 4;

  for (const card of cards) {
    const id = card.dataset.levelId;
    if (!id) continue;
    const top = card.offsetTop;
    const left = card.offsetLeft;
    let row_index = -1;
    for (let i = 0; i < row_tops.length; i++) {
      if (Math.abs(row_tops[i] - top) <= tolerance_px) {
        row_index = i;
        break;
      }
    }
    if (row_index < 0) {
      row_index = rows.length;
      row_tops.push(top);
      rows.push([]);
    }
    rows[row_index].push({ id, card, left });
  }

  for (const row of rows) {
    row.sort((a, b) => a.left - b.left);
  }

  let current_row_index = 0;
  let current_col_index = 0;
  if (load_selected_level_id) {
    for (let r = 0; r < rows.length; r++) {
      const c = rows[r].findIndex((item) => item.id === load_selected_level_id);
      if (c >= 0) {
        current_row_index = r;
        current_col_index = c;
        break;
      }
    }
  }

  let next_row_index = current_row_index;
  let next_col_index = current_col_index;

  if (direction === "left") {
    next_col_index = Math.max(0, current_col_index - 1);
  } else if (direction === "right") {
    next_col_index = Math.min(rows[current_row_index].length - 1, current_col_index + 1);
  } else {
    const target_row_index = direction === "up"
      ? Math.max(0, current_row_index - 1)
      : Math.min(rows.length - 1, current_row_index + 1);

    const current_left = rows[current_row_index][current_col_index].left;
    let best_col_index = 0;
    let best_distance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < rows[target_row_index].length; i++) {
      const distance = Math.abs(rows[target_row_index][i].left - current_left);
      if (distance < best_distance) {
        best_distance = distance;
        best_col_index = i;
      }
    }

    next_row_index = target_row_index;
    next_col_index = best_col_index;
  }

  const next = rows[next_row_index]?.[next_col_index];
  if (!next) {
    return;
  }
  load_selected_level_id = next.id;
  refresh_load_selection_ui(true);
}

function activate_selected_load_level(): void {
  if (state.modal_state.kind !== "load" || !load_selected_level_id) {
    return;
  }
  request_level_load(load_selected_level_id);
}

function render_rename_modal(level_id: string): void {
  const level = find_level(level_id);
  if (!level) {
    modal_error_text = "Level no longer exists.";
    set_modal_state({ kind: "load" });
    return;
  }

  Dom.set_modal_title(refs, "Rename Level");
  refs.modal_body.innerHTML = `
    <form id="rename-form" class="modal-form">
      <label class="modal-field-label" for="rename-level-name">New Name</label>
      <input id="rename-level-name" class="modal-input" type="text" maxlength="80" />
      <div id="rename-error" class="modal-error"></div>
      <div class="modal-actions">
        <button id="rename-cancel" class="modal-btn" type="button">Back</button>
        <button class="modal-btn primary" type="submit">Rename</button>
      </div>
    </form>
  `;

  const form = refs.modal_body.querySelector("#rename-form") as HTMLFormElement;
  const name_input = refs.modal_body.querySelector("#rename-level-name") as HTMLInputElement;
  const error_el = refs.modal_body.querySelector("#rename-error") as HTMLDivElement;
  const cancel_btn = refs.modal_body.querySelector("#rename-cancel") as HTMLButtonElement;
  error_el.textContent = modal_error_text;
  name_input.value = level.name;
  name_input.focus();
  name_input.select();

  cancel_btn.addEventListener("click", () => {
    modal_error_text = "";
    set_modal_state({ kind: "load" });
  });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    try {
      const renamed = Store.rename_level(level.id, name_input.value);
      if (!renamed) {
        modal_error_text = "Level not found.";
        render_rename_modal(level_id);
        return;
      }
      if (state.current_level_id === renamed.id) {
        state.current_level_name = renamed.name;
        refresh_map_name();
      }
      modal_error_text = "";
      set_modal_state({ kind: "load" });
      refresh_status();
    } catch (err) {
      modal_error_text = `Rename failed: ${String(err)}`;
      render_rename_modal(level_id);
    }
  });
}

function render_confirm_discard_modal(level_id: string): void {
  const level = find_level(level_id);
  const target_name = level ? level.name : "this level";
  Dom.set_modal_title(refs, "Discard Unsaved Changes?");
  refs.modal_body.innerHTML = `
    <p class="confirm-copy">
      You have unsaved changes. Loading <strong>${escape_html(target_name)}</strong> will replace the current level.
    </p>
    <div class="modal-actions">
      <button id="discard-cancel" class="modal-btn" type="button">Cancel</button>
      <button id="discard-confirm" class="modal-btn danger" type="button">Load Anyway</button>
    </div>
  `;

  const cancel_btn = refs.modal_body.querySelector("#discard-cancel") as HTMLButtonElement;
  const confirm_btn = refs.modal_body.querySelector("#discard-confirm") as HTMLButtonElement;
  cancel_btn.addEventListener("click", () => set_modal_state({ kind: "load" }));
  confirm_btn.addEventListener("click", () => apply_level_from_library(level_id));
}

function render_confirm_delete_modal(level_id: string): void {
  const level = find_level(level_id);
  const target_name = level ? level.name : "this level";
  Dom.set_modal_title(refs, "Delete Level?");
  refs.modal_body.innerHTML = `
    <p class="confirm-copy">
      Delete <strong>${escape_html(target_name)}</strong> from local storage?
      This action cannot be undone.
    </p>
    <div class="modal-actions">
      <button id="delete-cancel" class="modal-btn" type="button">Cancel</button>
      <button id="delete-confirm" class="modal-btn danger" type="button">Delete</button>
    </div>
  `;

  const cancel_btn = refs.modal_body.querySelector("#delete-cancel") as HTMLButtonElement;
  const confirm_btn = refs.modal_body.querySelector("#delete-confirm") as HTMLButtonElement;
  cancel_btn.addEventListener("click", () => set_modal_state({ kind: "load" }));
  confirm_btn.addEventListener("click", () => {
    try {
      const deleted = Store.delete_level(level_id);
      if (!deleted) {
        modal_error_text = "Level not found.";
        set_modal_state({ kind: "load" });
        return;
      }
      if (state.current_level_id === level_id) {
        state.current_level_id = null;
        state.current_level_name = null;
        state.last_persisted_raw = "";
        state.is_dirty = true;
        refresh_map_name();
        refresh_status();
      }
      modal_error_text = "";
      set_modal_state({ kind: "load" });
    } catch (err) {
      modal_error_text = `Delete failed: ${String(err)}`;
      set_modal_state({ kind: "load" });
    }
  });
}

function render_modal(): void {
  const kind = state.modal_state.kind;
  if (kind === "none") {
    Dom.set_modal_open(refs, false);
    Dom.set_modal_close_visible(refs, true);
    refs.modal_body.innerHTML = "";
    refs.modal_title.textContent = "";
    refs.modal_window.className = "modal-window";
    return;
  }

  Dom.set_modal_open(refs, true);
  const hide_close = kind === "save";
  Dom.set_modal_close_visible(refs, !hide_close);
  refs.modal_window.className = [
    "modal-window",
    `modal-kind-${kind}`,
    hide_close ? "hide-header-close" : ""
  ].filter(Boolean).join(" ");
  switch (kind) {
    case "save":
      render_save_modal();
      return;
    case "load":
      render_load_modal();
      return;
    case "rename":
      render_rename_modal(state.modal_state.level_id);
      return;
    case "confirm-discard":
      render_confirm_discard_modal(state.modal_state.level_id);
      return;
    case "confirm-delete":
      render_confirm_delete_modal(state.modal_state.level_id);
      return;
    default:
      return;
  }
}

function set_sync_view_enabled(enabled: boolean): void {
  state.sync_view.enabled = enabled;
  Dom.set_sync_view_ui(refs, enabled);
  if (!enabled) {
    reset_raw_zoom_to_default();
  }
  refresh_status();
}

function toggle_sync_view(): void {
  set_sync_view_enabled(!state.sync_view.enabled);
}

function set_add_escape_char_enabled(enabled: boolean): void {
  if (state.add_escape_char.enabled === enabled) {
    Dom.set_add_escape_char_ui(refs, enabled);
    return;
  }

  let selection_start = 0;
  let selection_end = 0;
  let canonical_raw = state.raw_text;
  if (state.mode === "raw") {
    selection_start = refs.raw_textarea.selectionStart;
    selection_end = refs.raw_textarea.selectionEnd;
    canonical_raw = raw_from_textarea(refs.raw_textarea.value);
  }

  if (raw_timer !== null) {
    window.clearTimeout(raw_timer);
    raw_timer = null;
  }

  state.add_escape_char.enabled = enabled;
  Dom.set_add_escape_char_ui(refs, enabled);

  if (state.mode === "raw") {
    St.sync_grid_from_raw(state, canonical_raw);
    Dom.set_raw_error(refs, state.raw_error);
    if (!state.raw_error) {
      rebuild_visual();
    }
    sync_raw_textarea_with_state();
    const max = refs.raw_textarea.value.length;
    refs.raw_textarea.setSelectionRange(
      Math.max(0, Math.min(max, selection_start)),
      Math.max(0, Math.min(max, selection_end))
    );
    refs.raw_textarea.focus();
  }

  update_dirty_flag();
  refresh_status();
}

function modal_is_open(): boolean {
  return state.modal_state.kind !== "none";
}

function is_text_entry_target(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function set_mode(mode: T.ViewMode): void {
  if (mode === state.mode) {
    return;
  }

  const from_mode = state.mode;
  if (state.sync_view.enabled) {
    if (from_mode === "visual" && mode === "raw") {
      capture_camera_from_visual();
    } else if (from_mode === "raw" && mode === "visual") {
      capture_camera_from_raw();
    }
  }

  state.mode = mode;
  Dom.set_mode_ui(refs, mode);
  clear_move_preview();
  visual.set_paint_preview(null);

  if (mode === "raw") {
    sync_raw_textarea_with_state();
    if (state.sync_view.enabled && from_mode === "visual") {
      apply_camera_to_raw();
    }
    refs.raw_textarea.focus();
  } else {
    if (state.sync_view.enabled && from_mode === "raw") {
      apply_camera_to_visual();
    }
    rebuild_visual();
  }

  refresh_interaction_ui();
  refresh_status();
}

function set_tool(tool: T.Tool): void {
  state.tool = tool;
  Dom.set_tool_ui(refs, tool);
  clear_move_preview();
  visual.set_paint_preview(null);
  if (tool !== "move") {
    state.move_selection = null;
    visual.set_selection(null);
  }
  refresh_interaction_ui();
  refresh_status();
}

function select_token(token: T.GlyphToken): void {
  state.selected_token = token;
  state.selected_token_key = token.token;
  for (const child of refs.sprite_list.children) {
    if (!(child instanceof HTMLButtonElement)) {
      continue;
    }
    child.classList.toggle("active", child.dataset.spriteId === token.token);
  }
  refresh_interaction_ui();
  refresh_status();
}

function get_sprite_buttons(): HTMLButtonElement[] {
  const buttons: HTMLButtonElement[] = [];
  for (const child of refs.sprite_list.children) {
    if (child instanceof HTMLButtonElement) {
      buttons.push(child);
    }
  }
  return buttons;
}

function update_highlighted_ui(): void {
  const buttons = get_sprite_buttons();
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle("highlighted", i === highlighted_glyph_index);
  }
  if (highlighted_glyph_index >= 0 && highlighted_glyph_index < buttons.length) {
    buttons[highlighted_glyph_index].scrollIntoView({ block: "nearest" });
  }
}

function navigate_glyphs(direction: "up" | "down"): void {
  const buttons = get_sprite_buttons();
  if (buttons.length === 0) return;

  if (direction === "down") {
    highlighted_glyph_index = Math.min(highlighted_glyph_index + 1, buttons.length - 1);
  } else {
    highlighted_glyph_index = Math.max(highlighted_glyph_index - 1, 0);
  }
  update_highlighted_ui();
}

function select_highlighted_glyph(): void {
  const buttons = get_sprite_buttons();
  if (highlighted_glyph_index >= 0 && highlighted_glyph_index < buttons.length) {
    const token_key = buttons[highlighted_glyph_index].dataset.spriteId;
    if (token_key) {
      const token = token_by_key.get(token_key);
      if (token) {
        select_token(token);
      }
    }
  }
}

function dismiss_search(): void {
  refs.sprite_search.value = "";
  token_filter = "";
  refs.sprite_search.blur();
  highlighted_glyph_index = -1;
  render_token_list();
  set_tool("move");
}

function render_token_list(): void {
  refs.sprite_list.innerHTML = "";
  highlighted_glyph_index = -1;
  const q = token_filter.trim().toLowerCase();
  filtered_tokens = tokens.filter((entry) => {
    if (!q) {
      return true;
    }
    return (
      entry.token.toLowerCase().includes(q) ||
      entry.name.toLowerCase().includes(q) ||
      entry.label.toLowerCase().includes(q) ||
      entry.kind.toLowerCase().includes(q)
    );
  });

  let last_kind: T.GlyphKind | null = null;

  for (const entry of filtered_tokens) {
    if (entry.kind !== last_kind) {
      const group = document.createElement("div");
      group.className = "sprite-group-label";
      group.textContent = entry.kind;
      refs.sprite_list.appendChild(group);
      last_kind = entry.kind;
    }

    const row = document.createElement("button");
    row.type = "button";
    row.className = "sprite-item";
    row.dataset.spriteId = entry.token;

    const img = document.createElement("img");
    img.alt = entry.name;
    img.className = "sprite-thumb";
    img.loading = "lazy";
    img.onerror = () => {
      if (img.dataset.fallbackApplied === "1") {
        img.style.display = "none";
        return;
      }
      img.dataset.fallbackApplied = "1";
      img.src = DEFAULT_FLOOR_ASSET;
    };
    img.dataset.fallbackApplied = "0";
    img.src = preview_asset(entry);
    row.appendChild(img);

    const glyph = document.createElement("span");
    glyph.className = "sprite-glyph";
    glyph.textContent = entry.token;
    row.appendChild(glyph);

    const details = document.createElement("span");
    details.className = "sprite-details";

    const label = document.createElement("span");
    label.className = "sprite-label";
    label.textContent = entry.label;
    details.appendChild(label);

    const meta = document.createElement("span");
    meta.className = "sprite-row-meta";
    meta.textContent = `${entry.name} [${entry.kind}]`;
    details.appendChild(meta);

    row.appendChild(details);

    row.addEventListener("click", () => {
      select_token(entry);
    });

    refs.sprite_list.appendChild(row);
  }

  if (state.selected_token_key) {
    for (const child of refs.sprite_list.children) {
      if (!(child instanceof HTMLButtonElement)) {
        continue;
      }
      child.classList.toggle("active", child.dataset.spriteId === state.selected_token_key);
    }
  }
}

function cell_from_event(ev: PointerEvent): { x: number; y: number } | null {
  const cell = visual.hit_test(ev.clientX, ev.clientY);
  if (!cell) {
    return null;
  }
  if (cell.x < 0 || cell.y < 0 || cell.x >= state.grid.width || cell.y >= state.grid.height) {
    return null;
  }
  return cell;
}

function on_visual_pointer_down(ev: PointerEvent): void {
  if (state.mode !== "visual") {
    return;
  }

  const pan_gesture = is_space_down || ev.button === 1;
  if (pan_gesture) {
    pointer_drag = {
      kind: "pan",
      start_x: ev.clientX,
      start_y: ev.clientY,
      base_offset_x: state.viewport.offset_x,
      base_offset_y: state.viewport.offset_y
    };
    refs.visual_stage.classList.add("is-grabbing");
    refs.visual_stage.setPointerCapture(ev.pointerId);
    visual.set_paint_preview(null);
    return;
  }

  if (ev.button !== 0) {
    return;
  }

  const cell = cell_from_event(ev);
  if (!cell) {
    return;
  }

  refs.visual_stage.setPointerCapture(ev.pointerId);

  if (state.tool === "paint") {
    if (!state.selected_token) {
      return;
    }
    pointer_drag = {
      kind: "paint_rect",
      start_x: cell.x,
      start_y: cell.y,
      end_x: cell.x,
      end_y: cell.y
    };
    const rect = St.normalize_rect(cell.x, cell.y, cell.x, cell.y);
    visual.set_selection(rect);
    paint_preview_for_cell(null);
    return;
  }

  if (state.tool === "collider") {
    pointer_drag = {
      kind: "collider_rect",
      start_x: cell.x,
      start_y: cell.y,
      end_x: cell.x,
      end_y: cell.y
    };
    const rect = St.normalize_rect(cell.x, cell.y, cell.x, cell.y);
    visual.set_selection(rect);
    return;
  }

  if (state.tool === "rubber") {
    pointer_drag = {
      kind: "rubber_rect",
      start_x: cell.x,
      start_y: cell.y,
      end_x: cell.x,
      end_y: cell.y
    };
    const rect = St.normalize_rect(cell.x, cell.y, cell.x, cell.y);
    visual.set_selection(rect);
    return;
  }

  const existing = state.move_selection;
  if (existing && in_rect(cell.x, cell.y, existing)) {
    pointer_drag = {
      kind: "move_block",
      origin: existing,
      start_x: cell.x,
      start_y: cell.y,
      delta_x: 0,
      delta_y: 0
    };
    return;
  }

  const source = St.grid_get(state.grid, cell.x, cell.y);
  if (source && !St.is_empty_cell(source)) {
    pointer_drag = {
      kind: "move_single",
      from_x: cell.x,
      from_y: cell.y,
      to_x: cell.x,
      to_y: cell.y
    };
    state.move_selection = null;
    visual.set_selection({ x: cell.x, y: cell.y, w: 1, h: 1 });
    return;
  }

  pointer_drag = {
    kind: "move_select",
    start_x: cell.x,
    start_y: cell.y,
    end_x: cell.x,
    end_y: cell.y
  };
  visual.set_selection(St.normalize_rect(cell.x, cell.y, cell.x, cell.y));
}

function on_visual_pointer_move(ev: PointerEvent): void {
  const cell = cell_from_event(ev);

  if (!pointer_drag) {
    paint_preview_for_cell(cell);
    return;
  }

  if (pointer_drag.kind === "pan") {
    const dx = ev.clientX - pointer_drag.start_x;
    const dy = ev.clientY - pointer_drag.start_y;
    state.viewport.offset_x = pointer_drag.base_offset_x + dx;
    state.viewport.offset_y = pointer_drag.base_offset_y + dy;
    visual.set_transform(state.viewport);
    return;
  }

  if (!cell) {
    paint_preview_for_cell(null);
    return;
  }

  if (pointer_drag.kind === "paint_rect") {
    if (!state.selected_token) {
      return;
    }
    pointer_drag.end_x = cell.x;
    pointer_drag.end_y = cell.y;
    const rect = St.normalize_rect(
      pointer_drag.start_x,
      pointer_drag.start_y,
      pointer_drag.end_x,
      pointer_drag.end_y
    );
    visual.set_selection(rect);
    clear_move_preview();
    paint_preview_for_cell(null);
    return;
  }

  if (pointer_drag.kind === "collider_rect") {
    pointer_drag.end_x = cell.x;
    pointer_drag.end_y = cell.y;
    const rect = St.normalize_rect(
      pointer_drag.start_x,
      pointer_drag.start_y,
      pointer_drag.end_x,
      pointer_drag.end_y
    );
    visual.set_selection(rect);
    clear_move_preview();
    visual.set_paint_preview(null);
    return;
  }

  if (pointer_drag.kind === "rubber_rect") {
    pointer_drag.end_x = cell.x;
    pointer_drag.end_y = cell.y;
    const rect = St.normalize_rect(
      pointer_drag.start_x,
      pointer_drag.start_y,
      pointer_drag.end_x,
      pointer_drag.end_y
    );
    visual.set_selection(rect);
    clear_move_preview();
    visual.set_paint_preview(null);
    return;
  }

  if (pointer_drag.kind === "move_single") {
    pointer_drag.to_x = cell.x;
    pointer_drag.to_y = cell.y;
    const rect = { x: cell.x, y: cell.y, w: 1, h: 1 };
    visual.set_selection(rect);
    visual.set_move_preview(rect, {
      x: pointer_drag.from_x,
      y: pointer_drag.from_y,
      w: 1,
      h: 1
    });
    return;
  }

  if (pointer_drag.kind === "move_select") {
    pointer_drag.end_x = cell.x;
    pointer_drag.end_y = cell.y;
    visual.set_selection(
      St.normalize_rect(
        pointer_drag.start_x,
        pointer_drag.start_y,
        pointer_drag.end_x,
        pointer_drag.end_y
      )
    );
    clear_move_preview();
    visual.set_paint_preview(null);
    return;
  }

  const raw_dx = cell.x - pointer_drag.start_x;
  const raw_dy = cell.y - pointer_drag.start_y;
  const [dx, dy] = clamp_delta_for_rect(pointer_drag.origin, raw_dx, raw_dy);
  pointer_drag.delta_x = dx;
  pointer_drag.delta_y = dy;
  const rect = {
    x: pointer_drag.origin.x + dx,
    y: pointer_drag.origin.y + dy,
    w: pointer_drag.origin.w,
    h: pointer_drag.origin.h
  };
  visual.set_selection(rect);
  visual.set_move_preview(rect, {
    x: pointer_drag.origin.x,
    y: pointer_drag.origin.y,
    w: pointer_drag.origin.w,
    h: pointer_drag.origin.h
  });
  visual.set_paint_preview(null);
}

function on_visual_pointer_up(ev: PointerEvent): void {
  if (!pointer_drag) {
    return;
  }

  refs.visual_stage.releasePointerCapture(ev.pointerId);
  refs.visual_stage.classList.remove("is-grabbing");

  if (pointer_drag.kind === "pan") {
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    return;
  }

  if (pointer_drag.kind === "paint_rect") {
    const token = state.selected_token;
    if (token) {
      const rect = St.normalize_rect(
        pointer_drag.start_x,
        pointer_drag.start_y,
        pointer_drag.end_x,
        pointer_drag.end_y
      );
      History.push_snapshot(state.grid);
      Tools.apply_paint_rect(state.grid, rect, token);
      sync_grid_and_views();
    }
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    return;
  }

  if (pointer_drag.kind === "collider_rect") {
    const rect = St.normalize_rect(
      pointer_drag.start_x,
      pointer_drag.start_y,
      pointer_drag.end_x,
      pointer_drag.end_y
    );
    History.push_snapshot(state.grid);
    Tools.apply_collider_rect(state.grid, rect);
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    sync_grid_and_views();
    return;
  }

  if (pointer_drag.kind === "rubber_rect") {
    const rect = St.normalize_rect(
      pointer_drag.start_x,
      pointer_drag.start_y,
      pointer_drag.end_x,
      pointer_drag.end_y
    );
    History.push_snapshot(state.grid);
    Tools.apply_erase_rect(state.grid, rect);
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    sync_grid_and_views();
    return;
  }

  if (pointer_drag.kind === "move_single") {
    History.push_snapshot(state.grid);
    Tools.move_single_cell(
      state.grid,
      pointer_drag.from_x,
      pointer_drag.from_y,
      pointer_drag.to_x,
      pointer_drag.to_y
    );
    state.move_selection = null;
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    sync_grid_and_views();
    return;
  }

  if (pointer_drag.kind === "move_select") {
    const rect = St.normalize_rect(
      pointer_drag.start_x,
      pointer_drag.start_y,
      pointer_drag.end_x,
      pointer_drag.end_y
    );
    state.move_selection = rect;
    visual.set_selection(rect);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    refresh_status();
    return;
  }

  const [dx, dy] = clamp_delta_for_rect(
    pointer_drag.origin,
    pointer_drag.delta_x,
    pointer_drag.delta_y
  );
  History.push_snapshot(state.grid);
  Tools.move_rect(state.grid, pointer_drag.origin, dx, dy);
  state.move_selection = {
    x: pointer_drag.origin.x + dx,
    y: pointer_drag.origin.y + dy,
    w: pointer_drag.origin.w,
    h: pointer_drag.origin.h
  };
  visual.set_selection(state.move_selection);
  pointer_drag = null;
  clear_move_preview();
  visual.set_paint_preview(null);
  sync_grid_and_views();
}

function bind_events(): void {
  refs.action_save_btn.addEventListener("click", () => request_save_action());
  refs.action_save_as_btn.addEventListener("click", () => request_save_as_action());
  refs.action_load_btn.addEventListener("click", () => open_load_modal(true));
  refs.mode_raw_btn.addEventListener("click", () => set_mode("raw"));
  refs.mode_visual_btn.addEventListener("click", () => set_mode("visual"));
  refs.sync_view_toggle.addEventListener("change", () => {
    set_sync_view_enabled(refs.sync_view_toggle.checked);
  });
  refs.add_escape_char_toggle.addEventListener("change", () => {
    set_add_escape_char_enabled(refs.add_escape_char_toggle.checked);
  });
  refs.modal_close_btn.addEventListener("click", () => close_modal());
  refs.modal_backdrop.addEventListener("click", () => close_modal());

  refs.tool_collider_btn.addEventListener("click", () => set_tool("collider"));
  refs.tool_move_btn.addEventListener("click", () => set_tool("move"));
  refs.tool_paint_btn.addEventListener("click", () => set_tool("paint"));
  refs.tool_rubber_btn.addEventListener("click", () => set_tool("rubber"));

  refs.sprite_search.addEventListener("input", () => {
    token_filter = refs.sprite_search.value;
    render_token_list();
  });

  refs.raw_textarea.addEventListener("input", () => {
    if (raw_timer !== null) {
      window.clearTimeout(raw_timer);
    }
    raw_timer = window.setTimeout(() => {
      raw_timer = null;
      const canonical_raw = raw_from_textarea(refs.raw_textarea.value);
      History.push_snapshot(state.grid);
      St.sync_grid_from_raw(state, canonical_raw);
      Dom.set_raw_error(refs, state.raw_error);
      if (!state.raw_error) {
        rebuild_visual();
      }
      update_dirty_flag();
      refresh_status();
    }, raw_debounce_ms);
  });
  refs.raw_textarea.addEventListener("copy", (ev) => {
    const start = refs.raw_textarea.selectionStart;
    const end = refs.raw_textarea.selectionEnd;
    if (start === end) {
      return;
    }
    const clipboard = ev.clipboardData;
    if (!clipboard) {
      return;
    }
    ev.preventDefault();
    const selected = refs.raw_textarea.value.slice(start, end);
    clipboard.setData("text/plain", selected);
    flash_status(state.add_escape_char.enabled ? "RAW copied with escape chars" : "RAW copied");
  });
  refs.raw_textarea.addEventListener("wheel", (ev) => {
    if (!ev.ctrlKey && !ev.metaKey) {
      return;
    }
    ev.preventDefault();
    const metrics = Cam.measure_raw_metrics(refs.raw_textarea);
    const factor = ev.deltaY < 0 ? 1.1 : 0.9;
    const next_font = Math.max(
      raw_font_min_px,
      Math.min(raw_font_max_px, metrics.font_size_px * factor)
    );
    refs.raw_textarea.style.fontSize = `${next_font}px`;
    state.raw_viewport = Cam.measure_raw_metrics(refs.raw_textarea);
    refresh_status();
  }, { passive: false });

  refs.visual_stage.addEventListener("pointerdown", on_visual_pointer_down);
  refs.visual_stage.addEventListener("pointermove", on_visual_pointer_move);
  refs.visual_stage.addEventListener("pointerup", on_visual_pointer_up);
  refs.visual_stage.addEventListener("pointercancel", on_visual_pointer_up);
  refs.visual_stage.addEventListener("selectstart", (ev) => {
    ev.preventDefault();
  });
  refs.visual_stage.addEventListener("dragstart", (ev) => {
    ev.preventDefault();
  });
  refs.visual_stage.addEventListener("pointerleave", () => {
    visual.set_paint_preview(null);
    clear_move_preview();
  });

  refs.visual_stage.addEventListener("wheel", (ev) => {
    if (!ev.ctrlKey && !ev.metaKey) {
      return;
    }
    ev.preventDefault();
    const delta = -ev.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    const next_zoom = state.viewport.zoom * factor;
    state.viewport = visual.zoom_to_point(next_zoom, ev.clientX, ev.clientY);
    visual.set_transform(state.viewport);
  });

  window.addEventListener("keydown", (ev) => {
    const in_text_entry = is_text_entry_target(ev.target);
    if (in_text_entry || modal_is_open()) {
      if (ev.key === "Control" || ev.key === "Meta") {
        refs.visual_stage.classList.add("is-zoom-key");
      }
      return;
    }

    if (ev.key === " ") {
      is_space_down = true;
      refresh_interaction_ui();
    }
    if (ev.key === "0") {
      state.viewport = { zoom: 1, offset_x: 0, offset_y: 0 };
      visual.set_transform(state.viewport);
    }
    if (ev.key === "Control" || ev.key === "Meta") {
      refs.visual_stage.classList.add("is-zoom-key");
    }
  });

  window.addEventListener("keyup", (ev) => {
    if (is_text_entry_target(ev.target) || modal_is_open()) {
      if (ev.key === "Control" || ev.key === "Meta") {
        refs.visual_stage.classList.remove("is-zoom-key");
      }
      return;
    }

    if (ev.key === " ") {
      is_space_down = false;
      refresh_interaction_ui();
    }
    if (ev.key === "Control" || ev.key === "Meta") {
      refs.visual_stage.classList.remove("is-zoom-key");
    }
  });

  Shortcuts.bind_shortcuts({
    get_context: () => ({
      modal_kind: state.modal_state.kind,
      in_text_entry: is_text_entry_target(document.activeElement),
      load_search_focused: load_search_is_focused()
    }),
    system_save: () => {
      request_save_action();
    },
    system_save_as: () => {
      request_save_as_action();
    },
    system_load: () => {
      open_load_modal(true);
    },
    system_undo: () => {
      perform_undo();
    },
    system_redo: () => {
      perform_redo();
    },
    set_tool: (tool) => {
      set_tool(tool);
    },
    navigate_glyphs: (direction) => {
      navigate_glyphs(direction);
    },
    select_highlighted_glyph: () => {
      select_highlighted_glyph();
    },
    dismiss: () => {
      if (modal_is_open()) {
        close_modal();
        return;
      }
      dismiss_search();
    },
    focus_glyph_search: () => refs.sprite_search.focus(),
    toggle_viewport: () => {
      set_mode(state.mode === "raw" ? "visual" : "raw");
    },
    toggle_sync_view: () => {
      toggle_sync_view();
    },
    load_toggle_sort: (direction) => {
      toggle_load_sort(direction);
    },
    load_move_selection: (direction) => {
      move_load_selection(direction);
    },
    load_activate_selection: () => {
      activate_selected_load_level();
    }
  });
}

async function init_tokens(): Promise<void> {
  try {
    tokens = await Cat.load_glyph_catalog();
    token_by_key = Cat.token_map(tokens);
  } catch (err) {
    tokens = [];
    token_by_key = new Map<string, T.GlyphToken>();
    Dom.set_status(refs, `Failed to load glyph catalog: ${String(err)}`);
  }

  render_token_list();

  const preferred = tokens.find((entry) => entry.token === Raw.EMPTY_FLOOR);
  if (preferred) {
    select_token(preferred);
  } else if (tokens.length > 0) {
    select_token(tokens[0]);
  }

  rebuild_visual();
  refresh_interaction_ui();
  if (modal_is_open()) {
    render_modal();
  }
}

function bootstrap(): void {
  sync_raw_textarea_with_state();
  Dom.set_mode_ui(refs, state.mode);
  Dom.set_sync_view_ui(refs, state.sync_view.enabled);
  Dom.set_add_escape_char_ui(refs, state.add_escape_char.enabled);
  Dom.set_tool_ui(refs, state.tool);
  Dom.set_modal_open(refs, false);
  Dom.set_modal_close_visible(refs, true);
  refresh_map_name();
  Dom.set_raw_error(refs, null);
  rebuild_visual();
  bind_events();
  refresh_interaction_ui();
  refresh_status();
  void init_tokens();
}

bootstrap();
