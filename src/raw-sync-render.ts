import { VISUAL_MAX_ZOOM, VISUAL_MIN_ZOOM, VISUAL_TILE_SIZE } from "./camera-sync";
import type * as T from "./types";

const TILE_SIZE = VISUAL_TILE_SIZE;
const CELL_CHAR_WIDTH = TILE_SIZE / 4;
const CELL_LINE_HEIGHT = TILE_SIZE / 2;

export interface RawSyncRenderer {
  rebuild(grid: T.GridState, raw_text: string): void;
  refresh(grid: T.GridState, raw_text: string): void;
  set_transform(viewport: T.ViewportState): void;
  stage_rect(): DOMRect;
  zoom_to_point(next_zoom: number, client_x: number, client_y: number): T.ViewportState;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function create_raw_sync_renderer(
  stage_el: HTMLDivElement,
  world_el: HTMLDivElement,
  content_el: HTMLDivElement
): RawSyncRenderer {
  function render_lines(grid: T.GridState, raw_text: string): void {
    content_el.innerHTML = "";

    const target_cols = Math.max(0, grid.width * 4);
    const target_lines = Math.max(0, grid.height * 2);
    const lines = raw_text.split("\n");

    world_el.style.width = `${grid.width * TILE_SIZE}px`;
    world_el.style.height = `${grid.height * TILE_SIZE}px`;
    content_el.style.width = `${grid.width * TILE_SIZE}px`;
    content_el.style.height = `${grid.height * TILE_SIZE}px`;

    for (let y = 0; y < target_lines; y++) {
      const src = lines[y] || "";
      const line_text = src.length >= target_cols
        ? src.slice(0, target_cols)
        : `${src}${" ".repeat(target_cols - src.length)}`;

      const line = document.createElement("div");
      line.className = "raw-sync-line";
      line.style.top = `${y * CELL_LINE_HEIGHT}px`;
      line.style.height = `${CELL_LINE_HEIGHT}px`;
      line.style.width = `${grid.width * TILE_SIZE}px`;

      for (let x = 0; x < target_cols; x++) {
        const ch = line_text[x] || " ";
        const char_el = document.createElement("span");
        char_el.className = "raw-sync-char";
        char_el.style.width = `${CELL_CHAR_WIDTH}px`;
        char_el.style.height = `${CELL_LINE_HEIGHT}px`;
        char_el.textContent = ch;
        line.appendChild(char_el);
      }

      content_el.appendChild(line);
    }
  }

  function rebuild(grid: T.GridState, raw_text: string): void {
    render_lines(grid, raw_text);
  }

  function refresh(grid: T.GridState, raw_text: string): void {
    render_lines(grid, raw_text);
  }

  function set_transform(viewport: T.ViewportState): void {
    world_el.style.transform = `translate(${viewport.offset_x}px, ${viewport.offset_y}px) scale(${viewport.zoom})`;
  }

  function stage_rect(): DOMRect {
    return stage_el.getBoundingClientRect();
  }

  function zoom_to_point(next_zoom: number, client_x: number, client_y: number): T.ViewportState {
    const rect = stage_rect();
    const view_x = client_x - rect.left;
    const view_y = client_y - rect.top;
    const center_x = view_x + stage_el.scrollLeft;
    const center_y = view_y + stage_el.scrollTop;
    const transform = getComputedStyle(world_el).transform;
    const matrix = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    const prev_zoom = matrix.a || 1;
    const prev_tx = matrix.e || 0;
    const prev_ty = matrix.f || 0;

    const world_x = (center_x - prev_tx) / prev_zoom;
    const world_y = (center_y - prev_ty) / prev_zoom;
    const zoom = clamp(next_zoom, VISUAL_MIN_ZOOM, VISUAL_MAX_ZOOM);

    return {
      zoom,
      offset_x: center_x - world_x * zoom,
      offset_y: center_y - world_y * zoom
    };
  }

  return {
    rebuild,
    refresh,
    set_transform,
    stage_rect,
    zoom_to_point
  };
}
