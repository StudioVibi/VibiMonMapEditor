import * as Dom from "./dom";
import * as Cam from "./camera-sync";
import * as Cat from "./glyph-catalog";
import * as Shortcuts from "./keyboard-shortcuts";
import * as St from "./state";
import * as Tools from "./tools";
import type * as T from "./types";
import { DEFAULT_FLOOR_ASSET, VIBIMON_ASSET_ROOT } from "./vibimon-resolver";
import * as Visual from "./visual-render";

const raw_debounce_ms = 180;
const raw_font_min_px = 8;
const raw_font_max_px = 96;

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

function building_preview_asset(name: string): string {
  if (name.startsWith("icon_") || name === "tile_mountain_door") {
    return `${VIBIMON_ASSET_ROOT}/${name}.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite_id(name, 0, 0)}.png`;
}

function preview_asset(token: T.GlyphToken): string {
  if (token.token === "::") {
    return DEFAULT_FLOOR_ASSET;
  }

  if (token.kind === "entity" && token.sprite) {
    return `${VIBIMON_ASSET_ROOT}/${token.sprite}_front_stand.png`;
  }

  if (token.kind === "bordered") {
    return `${VIBIMON_ASSET_ROOT}/${token.name}_center.png`;
  }

  if (token.kind === "building") {
    return building_preview_asset(token.name);
  }

  return DEFAULT_FLOOR_ASSET;
}

function refresh_status(): void {
  const picked = state.selected_token
    ? `${state.selected_token.token} ${state.selected_token.name}`
    : "none";
  const text = [
    `Mode: ${state.mode.toUpperCase()}`,
    `Sync: ${state.sync_view.enabled ? "ON" : "OFF"}`,
    `Tool: ${state.tool}`,
    `Grid: ${state.grid.width}x${state.grid.height}`,
    `Glyph: ${picked}`
  ].join(" | ");
  Dom.set_status(refs, text);
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
  const w = Math.max(1, token.width || 1);
  const h = Math.max(1, token.height || 1);
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

function sync_grid_and_views(): void {
  visual.refresh_grid(state.grid, token_by_key);
  St.sync_raw_from_grid(state);
  if (state.mode === "raw") {
    refs.raw_textarea.value = state.raw_text;
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
  state.shared_camera = clamp_camera_to_grid(
    Cam.visual_to_camera(state.viewport, { width: stage.width, height: stage.height })
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
  state.viewport = Cam.camera_to_visual(
    state.shared_camera,
    { width: stage.width, height: stage.height }
  );
}

function raw_selection_range_for_tile(tile_x: number, tile_y: number): { start: number; end: number } | null {
  if (tile_x < 0 || tile_y < 0) {
    return null;
  }
  const lines = state.raw_text.split("\n");
  const line_index = tile_y * 2 + 1;
  if (line_index < 0 || line_index >= lines.length) {
    return null;
  }

  const line = lines[line_index];
  if (!line) {
    return null;
  }

  const start_col = Math.max(0, Math.min(Math.max(0, line.length - 4), tile_x * 4));
  let offset = 0;
  for (let i = 0; i < line_index; i++) {
    offset += lines[i].length + 1;
  }

  const start = offset + start_col;
  const end = Math.min(start + 4, offset + line.length);
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
    refs.raw_textarea.value = state.raw_text;
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
      Tools.apply_paint_rect(state.grid, rect, token);
      sync_grid_and_views();
    }
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    return;
  }

  if (pointer_drag.kind === "rubber_rect") {
    const rect = St.normalize_rect(
      pointer_drag.start_x,
      pointer_drag.start_y,
      pointer_drag.end_x,
      pointer_drag.end_y
    );
    Tools.apply_erase_rect(state.grid, rect);
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    sync_grid_and_views();
    return;
  }

  if (pointer_drag.kind === "move_single") {
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
  refs.mode_raw_btn.addEventListener("click", () => set_mode("raw"));
  refs.mode_visual_btn.addEventListener("click", () => set_mode("visual"));
  refs.sync_view_toggle.addEventListener("change", () => {
    state.sync_view.enabled = refs.sync_view_toggle.checked;
    Dom.set_sync_view_ui(refs, state.sync_view.enabled);
    refresh_status();
  });

  refs.tool_move_btn.addEventListener("click", () => set_tool("move"));
  refs.tool_paint_btn.addEventListener("click", () => set_tool("paint"));
  refs.tool_rubber_btn.addEventListener("click", () => set_tool("rubber"));

  refs.sprite_search.addEventListener("input", () => {
    token_filter = refs.sprite_search.value;
    render_token_list();
  });

  refs.raw_textarea.addEventListener("input", () => {
    const val = refs.raw_textarea.value;
    if (raw_timer !== null) {
      window.clearTimeout(raw_timer);
    }
    raw_timer = window.setTimeout(() => {
      St.sync_grid_from_raw(state, val);
      Dom.set_raw_error(refs, state.raw_error);
      if (!state.raw_error) {
        rebuild_visual();
      }
      refresh_status();
    }, raw_debounce_ms);
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
    if (ev.key === " ") {
      is_space_down = false;
      refresh_interaction_ui();
    }
    if (ev.key === "Control" || ev.key === "Meta") {
      refs.visual_stage.classList.remove("is-zoom-key");
    }
  });

  Shortcuts.bind_shortcuts({
    set_tool,
    navigate_glyphs,
    select_highlighted_glyph,
    dismiss: dismiss_search,
    focus_glyph_search: () => refs.sprite_search.focus(),
    toggle_viewport: () => set_mode(state.mode === "raw" ? "visual" : "raw"),
    toggle_sync_view: () => {
      state.sync_view.enabled = !state.sync_view.enabled;
      Dom.set_sync_view_ui(refs, state.sync_view.enabled);
      refresh_status();
    },
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

  const preferred = tokens.find((entry) => entry.token === "TT");
  if (preferred) {
    select_token(preferred);
  } else if (tokens.length > 0) {
    select_token(tokens[0]);
  }

  rebuild_visual();
  refresh_interaction_ui();
}

function bootstrap(): void {
  refs.raw_textarea.value = state.raw_text;
  Dom.set_mode_ui(refs, state.mode);
  Dom.set_sync_view_ui(refs, state.sync_view.enabled);
  Dom.set_tool_ui(refs, state.tool);
  Dom.set_raw_error(refs, null);
  rebuild_visual();
  bind_events();
  refresh_interaction_ui();
  refresh_status();
  void init_tokens();
}

bootstrap();
