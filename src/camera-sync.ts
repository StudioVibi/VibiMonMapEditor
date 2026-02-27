import type * as T from "./types";

export const VISUAL_TILE_SIZE = 40;
export const VISUAL_MIN_ZOOM = 0.5;
export const VISUAL_MAX_ZOOM = 4;

export interface ViewportSize {
  width: number;
  height: number;
}

export interface RawViewportSize {
  client_width: number;
  client_height: number;
  scroll_width: number;
  scroll_height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safe_number(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function to_px(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function raw_tile_size_avg(metrics: T.RawViewportState): number {
  const tile_x = 4 * metrics.char_width_px;
  const tile_y = 2 * metrics.line_height_px;
  return (tile_x + tile_y) / 2;
}

function apply_probe_style(
  el: HTMLElement,
  computed: CSSStyleDeclaration,
  fallback_font_size: number
): void {
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.top = "-9999px";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.whiteSpace = "pre";
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.border = "0";
  el.style.fontFamily = computed.fontFamily;
  el.style.fontSize = computed.fontSize || `${fallback_font_size}px`;
  el.style.fontWeight = computed.fontWeight;
  el.style.fontStyle = computed.fontStyle;
  el.style.letterSpacing = computed.letterSpacing;
  el.style.lineHeight = computed.lineHeight;
}

function measure_char_width(textarea: HTMLTextAreaElement, font_size_px: number): number {
  const computed = getComputedStyle(textarea);
  const probe = document.createElement("span");
  apply_probe_style(probe, computed, font_size_px);
  probe.textContent = "MMMMMMMMMMMMMMMM";
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width / 16;
  probe.remove();
  return width > 0 ? width : font_size_px * 0.62;
}

function measure_line_height(textarea: HTMLTextAreaElement, font_size_px: number): number {
  const computed = getComputedStyle(textarea);
  const parsed = to_px(computed.lineHeight, Number.NaN);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const probe = document.createElement("div");
  apply_probe_style(probe, computed, font_size_px);
  probe.textContent = "M\nM";
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height / 2;
  probe.remove();
  return height > 0 ? height : font_size_px * 1.2;
}

export function visual_to_camera(
  viewport: T.ViewportState,
  stage: ViewportSize,
  tile_size = VISUAL_TILE_SIZE
): T.SharedCameraState {
  const zoom = safe_number(viewport.zoom, 1);
  const center_x = stage.width / 2;
  const center_y = stage.height / 2;
  const world_x = (center_x - viewport.offset_x) / zoom;
  const world_y = (center_y - viewport.offset_y) / zoom;
  return {
    center_tile_x: world_x / tile_size,
    center_tile_y: world_y / tile_size,
    visual_zoom: clamp(zoom, VISUAL_MIN_ZOOM, VISUAL_MAX_ZOOM)
  };
}

export function camera_to_visual(
  camera: T.SharedCameraState,
  stage: ViewportSize,
  tile_size = VISUAL_TILE_SIZE
): T.ViewportState {
  const zoom = clamp(camera.visual_zoom, VISUAL_MIN_ZOOM, VISUAL_MAX_ZOOM);
  const world_x = camera.center_tile_x * tile_size;
  const world_y = camera.center_tile_y * tile_size;
  return {
    zoom,
    offset_x: stage.width / 2 - world_x * zoom,
    offset_y: stage.height / 2 - world_y * zoom
  };
}

export function measure_raw_metrics(textarea: HTMLTextAreaElement): T.RawViewportState {
  const computed = getComputedStyle(textarea);
  const font_size_px = to_px(computed.fontSize, 13);
  const char_width_px = measure_char_width(textarea, font_size_px);
  const line_height_px = measure_line_height(textarea, font_size_px);
  const padding_left_px = to_px(computed.paddingLeft, 0);
  const padding_top_px = to_px(computed.paddingTop, 0);
  return {
    font_size_px,
    char_width_px,
    line_height_px,
    padding_left_px,
    padding_top_px,
    scroll_left: textarea.scrollLeft,
    scroll_top: textarea.scrollTop
  };
}

export function read_raw_viewport_size(textarea: HTMLTextAreaElement): RawViewportSize {
  return {
    client_width: textarea.clientWidth,
    client_height: textarea.clientHeight,
    scroll_width: textarea.scrollWidth,
    scroll_height: textarea.scrollHeight
  };
}

export function visual_zoom_to_raw_font_px(
  visual_zoom: number,
  base_metrics: T.RawViewportState,
  tile_size = VISUAL_TILE_SIZE
): number {
  const base_tile_size = raw_tile_size_avg(base_metrics);
  if (base_tile_size <= 0) {
    return base_metrics.font_size_px;
  }
  const target_tile_size = tile_size * clamp(visual_zoom, VISUAL_MIN_ZOOM, VISUAL_MAX_ZOOM);
  const scale = target_tile_size / base_tile_size;
  return clamp(base_metrics.font_size_px * scale, 8, 96);
}

export function raw_font_px_to_visual_zoom(
  raw_font_px: number,
  base_metrics: T.RawViewportState,
  tile_size = VISUAL_TILE_SIZE
): number {
  if (base_metrics.font_size_px <= 0) {
    return 1;
  }
  const scale = raw_font_px / base_metrics.font_size_px;
  const raw_tile_size = raw_tile_size_avg(base_metrics) * scale;
  if (raw_tile_size <= 0) {
    return 1;
  }
  return clamp(raw_tile_size / tile_size, VISUAL_MIN_ZOOM, VISUAL_MAX_ZOOM);
}

export function camera_to_raw_scroll(
  camera: T.SharedCameraState,
  raw_metrics: T.RawViewportState,
  viewport: RawViewportSize
): { left: number; top: number } {
  const char_width = Math.max(1, raw_metrics.char_width_px);
  const line_height = Math.max(1, raw_metrics.line_height_px);
  const padding_left = Math.max(0, raw_metrics.padding_left_px);
  const padding_top = Math.max(0, raw_metrics.padding_top_px);
  const char_center = camera.center_tile_x * 4 + 2;
  const line_center = camera.center_tile_y * 2 + 1;

  const left = char_center * char_width + padding_left - viewport.client_width / 2;
  const top = line_center * line_height + padding_top - viewport.client_height / 2;

  const max_left = Math.max(0, viewport.scroll_width - viewport.client_width);
  const max_top = Math.max(0, viewport.scroll_height - viewport.client_height);
  return {
    left: clamp(left, 0, max_left),
    top: clamp(top, 0, max_top)
  };
}

export function raw_scroll_to_camera(
  raw_metrics: T.RawViewportState,
  viewport: RawViewportSize,
  visual_zoom: number
): T.SharedCameraState {
  const char_width = Math.max(1, raw_metrics.char_width_px);
  const line_height = Math.max(1, raw_metrics.line_height_px);
  const padding_left = Math.max(0, raw_metrics.padding_left_px);
  const padding_top = Math.max(0, raw_metrics.padding_top_px);

  const char_center =
    (raw_metrics.scroll_left + viewport.client_width / 2 - padding_left) / char_width;
  const line_center =
    (raw_metrics.scroll_top + viewport.client_height / 2 - padding_top) / line_height;

  return {
    center_tile_x: (char_center - 2) / 4,
    center_tile_y: (line_center - 1) / 2,
    visual_zoom: clamp(visual_zoom, VISUAL_MIN_ZOOM, VISUAL_MAX_ZOOM)
  };
}
