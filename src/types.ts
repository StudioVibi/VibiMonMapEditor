export type Glyph2 = string;

export interface TileCell {
  floor: Glyph2;
  entity: Glyph2;
}

export interface GridState {
  width: number;
  height: number;
  cells: TileCell[][];
}

export type Tool = "move" | "paint" | "rubber";
export type ViewMode = "raw" | "visual";

export interface ViewportState {
  zoom: number;
  offset_x: number;
  offset_y: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type GlyphKind = "building" | "bordered" | "entity" | "marker";

export interface GlyphToken {
  token: Glyph2;
  kind: GlyphKind;
  name: string;
  width: number;
  height: number;
  wall: boolean;
  sprite: string | null;
  label: string;
}

export interface EditorState {
  grid: GridState;
  mode: ViewMode;
  tool: Tool;
  selected_token_key: string | null;
  selected_token: GlyphToken | null;
  viewport: ViewportState;
  raw_text: string;
  raw_error: string | null;
  last_valid_grid: GridState;
  move_selection: SelectionRect | null;
}
