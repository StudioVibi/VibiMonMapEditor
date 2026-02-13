import * as Dom from "./dom";
import * as Cat from "./glyph-catalog";
import * as St from "./state";
import * as Tools from "./tools";
import type * as T from "./types";
import * as Visual from "./visual-render";

const raw_debounce_ms = 180;

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
      kind: "paint";
      last_cell: string;
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

function preview_asset(token: T.GlyphToken): string {
  if (token.token === "::") {
    return "VibiMon/assets/tile_grass_00_00.png";
  }

  if (token.kind === "entity" && token.sprite) {
    return `VibiMon/assets/${token.sprite}_front_stand.png`;
  }

  if (token.kind === "bordered") {
    return `VibiMon/assets/${token.name}_center.png`;
  }

  if (token.kind === "building") {
    if (token.name.startsWith("icon_")) {
      return `VibiMon/assets/${token.name}.png`;
    }
    return `VibiMon/assets/${sprite_id(token.name, 0, 0)}.png`;
  }

  return "VibiMon/assets/tile_grass_00_00.png";
}

function refresh_status(): void {
  const picked = state.selected_token
    ? `${state.selected_token.token} ${state.selected_token.name}`
    : "none";
  const text = [
    `Mode: ${state.mode.toUpperCase()}`,
    `Tool: ${state.tool}`,
    `Grid: ${state.grid.width}x${state.grid.height}`,
    `Glyph: ${picked}`
  ].join(" | ");
  Dom.set_status(refs, text);
}

function rebuild_visual(): void {
  visual.rebuild_grid(state.grid, token_by_key);
  visual.set_transform(state.viewport);
  visual.set_selection(state.move_selection);
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

function set_mode(mode: T.ViewMode): void {
  state.mode = mode;
  Dom.set_mode_ui(refs, mode);
  if (mode === "raw") {
    refs.raw_textarea.value = state.raw_text;
    refs.raw_textarea.focus();
  } else {
    rebuild_visual();
  }
  refresh_status();
}

function set_tool(tool: T.Tool): void {
  state.tool = tool;
  Dom.set_tool_ui(refs, tool);
  if (tool !== "move") {
    state.move_selection = null;
    visual.set_selection(null);
  }
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
  refresh_status();
}

function render_token_list(): void {
  refs.sprite_list.innerHTML = "";
  const q = token_filter.trim().toLowerCase();
  const filtered = tokens.filter((entry) => {
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

  for (const entry of filtered) {
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
    img.src = preview_asset(entry);
    img.alt = entry.name;
    img.className = "sprite-thumb";
    img.loading = "lazy";
    img.onerror = () => {
      img.style.display = "none";
    };
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
    refs.visual_stage.setPointerCapture(ev.pointerId);
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
    Tools.apply_paint_at(state.grid, cell.x, cell.y, state.selected_token);
    pointer_drag = {
      kind: "paint",
      last_cell: cell_key(cell.x, cell.y)
    };
    sync_grid_and_views();
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
  if (!pointer_drag) {
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

  const cell = cell_from_event(ev);
  if (!cell) {
    return;
  }

  if (pointer_drag.kind === "paint") {
    if (!state.selected_token) {
      return;
    }
    const key = cell_key(cell.x, cell.y);
    if (key === pointer_drag.last_cell) {
      return;
    }
    pointer_drag.last_cell = key;
    Tools.apply_paint_at(state.grid, cell.x, cell.y, state.selected_token);
    sync_grid_and_views();
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
    return;
  }

  if (pointer_drag.kind === "move_single") {
    pointer_drag.to_x = cell.x;
    pointer_drag.to_y = cell.y;
    visual.set_selection({ x: cell.x, y: cell.y, w: 1, h: 1 });
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
    return;
  }

  const raw_dx = cell.x - pointer_drag.start_x;
  const raw_dy = cell.y - pointer_drag.start_y;
  const [dx, dy] = clamp_delta_for_rect(pointer_drag.origin, raw_dx, raw_dy);
  pointer_drag.delta_x = dx;
  pointer_drag.delta_y = dy;
  visual.set_selection({
    x: pointer_drag.origin.x + dx,
    y: pointer_drag.origin.y + dy,
    w: pointer_drag.origin.w,
    h: pointer_drag.origin.h
  });
}

function on_visual_pointer_up(ev: PointerEvent): void {
  if (!pointer_drag) {
    return;
  }

  refs.visual_stage.releasePointerCapture(ev.pointerId);

  if (pointer_drag.kind === "pan") {
    pointer_drag = null;
    return;
  }

  if (pointer_drag.kind === "paint") {
    pointer_drag = null;
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
  sync_grid_and_views();
}

function bind_events(): void {
  refs.mode_raw_btn.addEventListener("click", () => set_mode("raw"));
  refs.mode_visual_btn.addEventListener("click", () => set_mode("visual"));

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
      refs.visual_stage.classList.add("is-panning");
    }
    if (ev.key === "0") {
      state.viewport = { zoom: 1, offset_x: 0, offset_y: 0 };
      visual.set_transform(state.viewport);
    }
  });

  window.addEventListener("keyup", (ev) => {
    if (ev.key === " ") {
      is_space_down = false;
      refs.visual_stage.classList.remove("is-panning");
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

  const preferred = tokens.find((entry) => entry.token === "TT");
  if (preferred) {
    select_token(preferred);
  } else if (tokens.length > 0) {
    select_token(tokens[0]);
  }

  rebuild_visual();
}

function bootstrap(): void {
  refs.raw_textarea.value = state.raw_text;
  Dom.set_mode_ui(refs, state.mode);
  Dom.set_tool_ui(refs, state.tool);
  Dom.set_raw_error(refs, null);
  rebuild_visual();
  bind_events();
  refresh_status();
  void init_tokens();
}

bootstrap();
