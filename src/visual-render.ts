import * as Raw from "./raw-format";
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
  set_move_preview(
    rect: T.SelectionRect | null,
    source_rect?: T.SelectionRect | null,
    invalid?: boolean
  ): void;
  set_paint_preview(
    rect: T.SelectionRect | null,
    token?: T.GlyphToken | null,
    invalid?: boolean
  ): void;
  stage_rect(): DOMRect;
  zoom_to_point(next_zoom: number, client_x: number, client_y: number): T.ViewportState;
}

function cell_key(x: number, y: number): string {
  return `${x},${y}`;
}

function apply_image(
  img: HTMLImageElement,
  src: string,
  missing_behavior: "hide" | "fallback-floor"
): void {
  if (!src) {
    img.style.display = "none";
    img.removeAttribute("src");
    return;
  }

  img.onerror = () => {
    if (missing_behavior === "fallback-floor" && img.dataset.fallbackApplied !== "1") {
      img.dataset.fallbackApplied = "1";
      img.src = Vr.DEFAULT_FLOOR_ASSET;
      return;
    }
    img.style.display = "none";
    img.removeAttribute("src");
  };

  img.style.display = "block";
  if (img.getAttribute("src") === src) {
    return;
  }
  img.dataset.fallbackApplied = "0";
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
  const collider_overlay = el.querySelector(".tile-collider-overlay") as HTMLSpanElement;
  const floor_text = el.querySelector(".tile-floor-glyph") as HTMLSpanElement;
  const ent_text = el.querySelector(".tile-entity-glyph") as HTMLSpanElement;

  apply_image(floor_img, data.floor_asset, "fallback-floor");
  apply_image(ent_img, data.entity_asset, "hide");

  const has_collider = data.entity_glyph === Raw.COLLIDER_ENTITY;
  collider_overlay.style.display = has_collider ? "block" : "none";

  floor_text.textContent = data.floor_glyph;
  ent_text.textContent = has_collider ? "" : data.entity_glyph.trim();
  ent_text.style.display = !has_collider && data.entity_glyph.trim() ? "inline-block" : "none";
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

  const collider_overlay = document.createElement("span");
  collider_overlay.className = "tile-collider-overlay";

  const floor_text = document.createElement("span");
  floor_text.className = "tile-floor-glyph";

  const ent_text = document.createElement("span");
  ent_text.className = "tile-entity-glyph";

  el.appendChild(floor_img);
  el.appendChild(ent_img);
  el.appendChild(collider_overlay);
  el.appendChild(floor_text);
  el.appendChild(ent_text);

  return el;
}

function sprite_id(name: string, ix: number, iy: number): string {
  const pad_x = String(ix).padStart(2, "0");
  const pad_y = String(iy).padStart(2, "0");
  return `${name}_${pad_x}_${pad_y}`;
}

function bigimg_asset(token: T.GlyphToken, ix: number, iy: number): string {
  if (token.single) {
    return `${Vr.VIBIMON_ASSET_ROOT}/${token.name}.png`;
  }
  return `${Vr.VIBIMON_ASSET_ROOT}/${sprite_id(token.name, ix, iy)}.png`;
}

function entity_asset(sprite: string): string {
  if (sprite.startsWith("ent_")) {
    return `${Vr.VIBIMON_ASSET_ROOT}/${sprite}_front_stand.png`;
  }
  return `${Vr.VIBIMON_ASSET_ROOT}/${sprite}.png`;
}

export function create_visual_renderer(
  stage_el: HTMLDivElement,
  grid_el: HTMLDivElement,
  overlay_el: HTMLDivElement
): VisualRenderer {
  const tile_dom = new Map<string, HTMLDivElement>();
  let selection_layer: HTMLDivElement | null = null;
  let preview_layer: HTMLDivElement | null = null;

  function ensure_overlay_layers(): void {
    if (!selection_layer) {
      selection_layer = document.createElement("div");
      selection_layer.className = "overlay-selection-layer";
      overlay_el.appendChild(selection_layer);
    }
    if (!preview_layer) {
      preview_layer = document.createElement("div");
      preview_layer.className = "overlay-preview-layer";
      overlay_el.appendChild(preview_layer);
    }
  }

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
    selection_layer = null;
    preview_layer = null;
    ensure_overlay_layers();

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
    ensure_overlay_layers();
    if (!selection_layer) {
      return;
    }
    selection_layer.innerHTML = "";
    if (!rect) {
      return;
    }
    const marker = document.createElement("div");
    marker.className = "selection-rect";
    marker.style.left = `${rect.x * TILE_SIZE}px`;
    marker.style.top = `${rect.y * TILE_SIZE}px`;
    marker.style.width = `${rect.w * TILE_SIZE}px`;
    marker.style.height = `${rect.h * TILE_SIZE}px`;
    selection_layer.appendChild(marker);
  }

  function set_move_preview(
    rect: T.SelectionRect | null,
    source_rect?: T.SelectionRect | null,
    invalid = false
  ): void {
    ensure_overlay_layers();
    if (!preview_layer) {
      return;
    }
    preview_layer.innerHTML = "";
    if (!rect) {
      return;
    }

    const preview = document.createElement("div");
    preview.className = "move-preview";
    if (invalid) {
      preview.classList.add("invalid");
    }
    preview.style.left = `${rect.x * TILE_SIZE}px`;
    preview.style.top = `${rect.y * TILE_SIZE}px`;
    preview.style.width = `${rect.w * TILE_SIZE}px`;
    preview.style.height = `${rect.h * TILE_SIZE}px`;

    if (source_rect) {
      for (let dy = 0; dy < rect.h; dy++) {
        for (let dx = 0; dx < rect.w; dx++) {
          const source_x = source_rect.x + dx;
          const source_y = source_rect.y + dy;
          const source = tile_dom.get(cell_key(source_x, source_y));
          if (!source) {
            continue;
          }

          const preview_tile = document.createElement("div");
          preview_tile.className = "move-preview-tile";
          preview_tile.style.left = `${dx * TILE_SIZE}px`;
          preview_tile.style.top = `${dy * TILE_SIZE}px`;
          preview_tile.style.width = `${TILE_SIZE}px`;
          preview_tile.style.height = `${TILE_SIZE}px`;

          const source_floor = source.querySelector(".tile-floor-img") as HTMLImageElement | null;
          const source_entity = source.querySelector(".tile-entity-img") as HTMLImageElement | null;

          if (source_floor?.src) {
            const floor = document.createElement("img");
            floor.className = "move-preview-floor";
            floor.alt = "";
            floor.src = source_floor.src;
            preview_tile.appendChild(floor);
          }

          if (source_entity?.src) {
            const entity = document.createElement("img");
            entity.className = "move-preview-entity";
            entity.alt = "";
            entity.src = source_entity.src;
            preview_tile.appendChild(entity);
          }

          preview.appendChild(preview_tile);
        }
      }
    }

    preview_layer.appendChild(preview);
  }

  function set_paint_preview(
    rect: T.SelectionRect | null,
    token?: T.GlyphToken | null,
    invalid = false
  ): void {
    ensure_overlay_layers();
    if (!preview_layer) {
      return;
    }
    preview_layer.innerHTML = "";
    if (!rect || !token) {
      return;
    }

    const preview = document.createElement("div");
    preview.className = "move-preview paint-preview";
    if (invalid) {
      preview.classList.add("invalid");
    }
    preview.style.left = `${rect.x * TILE_SIZE}px`;
    preview.style.top = `${rect.y * TILE_SIZE}px`;
    preview.style.width = `${rect.w * TILE_SIZE}px`;
    preview.style.height = `${rect.h * TILE_SIZE}px`;

    for (let iy = 0; iy < rect.h; iy++) {
      for (let ix = 0; ix < rect.w; ix++) {
        const tile = document.createElement("div");
        tile.className = "move-preview-tile";
        tile.style.left = `${ix * TILE_SIZE}px`;
        tile.style.top = `${iy * TILE_SIZE}px`;
        tile.style.width = `${TILE_SIZE}px`;
        tile.style.height = `${TILE_SIZE}px`;

        if ((token.kind === "entity" || token.kind === "player") && token.sprite) {
          const entity = document.createElement("img");
          entity.className = "move-preview-entity";
          entity.alt = "";
          apply_image(entity, entity_asset(token.sprite), "hide");
          tile.appendChild(entity);
        } else if (token.kind === "bigimg") {
          const floor = document.createElement("img");
          floor.className = "move-preview-floor";
          floor.alt = "";
          apply_image(
            floor,
            token.width > 1 || token.height > 1
              ? bigimg_asset(token, ix, iy)
              : bigimg_asset(token, 0, 0),
            "fallback-floor"
          );
          tile.appendChild(floor);
        } else if (token.kind === "borded") {
          const floor = document.createElement("img");
          floor.className = "move-preview-floor";
          floor.alt = "";
          apply_image(floor, `${Vr.VIBIMON_ASSET_ROOT}/${token.name}_center.png`, "fallback-floor");
          tile.appendChild(floor);
        }

        preview.appendChild(tile);
      }
    }

    preview_layer.appendChild(preview);
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
    set_move_preview,
    set_paint_preview,
    stage_rect,
    zoom_to_point
  };
}
