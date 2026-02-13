import type * as T from "./types";
import * as Vr from "./vibimon-resolver";

const TILE_SIZE = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export interface VisualRenderer {
  rebuild_grid(grid: T.GridState, token_map: Map<string, T.GlyphToken>): void;
  refresh_grid(grid: T.GridState, token_map: Map<string, T.GlyphToken>): void;
  set_transform(viewport: T.ViewportState): void;
  hit_test(client_x: number, client_y: number): { x: number; y: number } | null;
  set_selection(rect: T.SelectionRect | null): void;
  stage_rect(): DOMRect;
  zoom_to_point(next_zoom: number, client_x: number, client_y: number): T.ViewportState;
}

function cell_key(x: number, y: number): string {
  return `${x},${y}`;
}

function apply_image(img: HTMLImageElement, src: string): void {
  if (!src) {
    img.style.display = "none";
    img.removeAttribute("src");
    return;
  }
  img.style.display = "block";
  if (img.src.endsWith(src)) {
    return;
  }
  img.src = src;
}

function apply_cell_visual(
  el: HTMLDivElement,
  x: number,
  y: number,
  grid: T.GridState,
  token_map: Map<string, T.GlyphToken>
): void {
  const data = Vr.resolve_cell_visual(grid, x, y, token_map);

  const floor_img = el.querySelector(".tile-floor-img") as HTMLImageElement;
  const ent_img = el.querySelector(".tile-entity-img") as HTMLImageElement;
  const floor_text = el.querySelector(".tile-floor-glyph") as HTMLSpanElement;
  const ent_text = el.querySelector(".tile-entity-glyph") as HTMLSpanElement;

  apply_image(floor_img, data.floor_asset);
  apply_image(ent_img, data.entity_asset);

  floor_text.textContent = data.floor_glyph;
  ent_text.textContent = data.entity_glyph.trim();
  ent_text.style.display = data.entity_glyph.trim() ? "inline-block" : "none";
}

function create_cell(x: number, y: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "tile-cell";
  el.style.left = `${x * TILE_SIZE}px`;
  el.style.top = `${y * TILE_SIZE}px`;
  el.style.width = `${TILE_SIZE}px`;
  el.style.height = `${TILE_SIZE}px`;
  el.dataset.x = String(x);
  el.dataset.y = String(y);

  const floor_img = document.createElement("img");
  floor_img.className = "tile-floor-img";
  floor_img.alt = "";
  floor_img.draggable = false;

  const ent_img = document.createElement("img");
  ent_img.className = "tile-entity-img";
  ent_img.alt = "";
  ent_img.draggable = false;

  const floor_text = document.createElement("span");
  floor_text.className = "tile-floor-glyph";

  const ent_text = document.createElement("span");
  ent_text.className = "tile-entity-glyph";

  el.appendChild(floor_img);
  el.appendChild(ent_img);
  el.appendChild(floor_text);
  el.appendChild(ent_text);

  return el;
}

export function create_visual_renderer(
  stage_el: HTMLDivElement,
  grid_el: HTMLDivElement,
  overlay_el: HTMLDivElement
): VisualRenderer {
  const tile_dom = new Map<string, HTMLDivElement>();

  function set_transform(viewport: T.ViewportState): void {
    const tx = viewport.offset_x;
    const ty = viewport.offset_y;
    grid_el.style.transform = `translate(${tx}px, ${ty}px) scale(${viewport.zoom})`;
    overlay_el.style.transform = `translate(${tx}px, ${ty}px) scale(${viewport.zoom})`;
  }

  function rebuild_grid(grid: T.GridState, token_map: Map<string, T.GlyphToken>): void {
    tile_dom.clear();
    grid_el.innerHTML = "";
    overlay_el.innerHTML = "";

    grid_el.style.width = `${grid.width * TILE_SIZE}px`;
    grid_el.style.height = `${grid.height * TILE_SIZE}px`;
    overlay_el.style.width = `${grid.width * TILE_SIZE}px`;
    overlay_el.style.height = `${grid.height * TILE_SIZE}px`;

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const el = create_cell(x, y);
        apply_cell_visual(el, x, y, grid, token_map);
        grid_el.appendChild(el);
        tile_dom.set(cell_key(x, y), el);
      }
    }
  }

  function refresh_grid(grid: T.GridState, token_map: Map<string, T.GlyphToken>): void {
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const key = cell_key(x, y);
        const el = tile_dom.get(key);
        if (!el) {
          continue;
        }
        apply_cell_visual(el, x, y, grid, token_map);
      }
    }
  }

  function stage_rect(): DOMRect {
    return stage_el.getBoundingClientRect();
  }

  function hit_test(client_x: number, client_y: number): { x: number; y: number } | null {
    const rect = stage_rect();
    const rel_x = client_x - rect.left;
    const rel_y = client_y - rect.top;
    if (rel_x < 0 || rel_y < 0 || rel_x > rect.width || rel_y > rect.height) {
      return null;
    }

    const transform = getComputedStyle(grid_el).transform;
    const matrix = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    const scale = matrix.a || 1;
    const tx = matrix.e || 0;
    const ty = matrix.f || 0;

    const world_x = (rel_x - tx) / scale;
    const world_y = (rel_y - ty) / scale;
    const x = Math.floor(world_x / TILE_SIZE);
    const y = Math.floor(world_y / TILE_SIZE);

    if (x < 0 || y < 0) {
      return null;
    }
    return { x, y };
  }

  function set_selection(rect: T.SelectionRect | null): void {
    overlay_el.innerHTML = "";
    if (!rect) {
      return;
    }
    const marker = document.createElement("div");
    marker.className = "selection-rect";
    marker.style.left = `${rect.x * TILE_SIZE}px`;
    marker.style.top = `${rect.y * TILE_SIZE}px`;
    marker.style.width = `${rect.w * TILE_SIZE}px`;
    marker.style.height = `${rect.h * TILE_SIZE}px`;
    overlay_el.appendChild(marker);
  }

  function zoom_to_point(
    next_zoom: number,
    client_x: number,
    client_y: number
  ): T.ViewportState {
    const rect = stage_rect();
    const center_x = client_x - rect.left;
    const center_y = client_y - rect.top;
    const transform = getComputedStyle(grid_el).transform;
    const matrix = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    const prev_zoom = matrix.a || 1;
    const prev_tx = matrix.e || 0;
    const prev_ty = matrix.f || 0;

    const world_x = (center_x - prev_tx) / prev_zoom;
    const world_y = (center_y - prev_ty) / prev_zoom;

    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next_zoom));
    return {
      zoom: clamped,
      offset_x: center_x - world_x * clamped,
      offset_y: center_y - world_y * clamped
    };
  }

  return {
    rebuild_grid,
    refresh_grid,
    set_transform,
    hit_test,
    set_selection,
    stage_rect,
    zoom_to_point
  };
}
