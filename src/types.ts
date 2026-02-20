export type Glyph = string;

export type GlyphKind = "none" | "bigimg" | "borded" | "entity" | "player";
export type GlyphLayer = "floor" | "entity";

export interface TileCell {
  floor: Glyph;
  entity: Glyph;
  entity_backup?: Glyph;
}

export interface GridState {
  width: number;
  height: number;
  cells: TileCell[][];
}

export type Tool = "move" | "collider" | "door" | "paint" | "rubber";
export type ViewMode = "raw" | "visual";

export interface ViewportState {
  zoom: number;
  offset_x: number;
  offset_y: number;
}

export interface SharedCameraState {
  center_tile_x: number;
  center_tile_y: number;
  visual_zoom: number;
}

export interface RawViewportState {
  font_size_px: number;
  char_width_px: number;
  line_height_px: number;
  scroll_left: number;
  scroll_top: number;
}

export interface SyncViewState {
  enabled: boolean;
}

export interface AddEscapeCharState {
  enabled: boolean;
}

export interface PersistedLevel {
  id: string;
  name: string;
  raw_text: string;
  grid_width: number;
  grid_height: number;
  created_at: string;
  updated_at: string;
}

export type LevelSortMode = "recent" | "name";
export type SaveModalMode = "regular" | "save-as";

export type ModalState =
  | { kind: "none" }
  | { kind: "save"; mode: SaveModalMode }
  | { kind: "load" }
  | { kind: "rename"; level_id: string }
  | { kind: "confirm-discard"; level_id: string }
  | { kind: "confirm-delete"; level_id: string };

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GlyphToken {
  token: Glyph;
  kind: GlyphKind;
  layer: GlyphLayer;
  name: string;
  width: number;
  height: number;
  single: boolean;
  sprite: string | null;
  label: string;
}

export interface DoorInspectorMeta {
  destination: string;
}

export type DoorInspectorStore = Record<string, Record<string, DoorInspectorMeta>>;
export type DoorInspectorDismissed = Set<string>;

export interface EditorState {
  grid: GridState;
  mode: ViewMode;
  tool: Tool;
  selected_token_key: string | null;
  selected_token: GlyphToken | null;
  current_level_id: string | null;
  current_level_name: string | null;
  last_persisted_raw: string;
  is_dirty: boolean;
  level_sort_mode: LevelSortMode;
  modal_state: ModalState;
  viewport: ViewportState;
  shared_camera: SharedCameraState;
  raw_viewport: RawViewportState;
  sync_view: SyncViewState;
  add_escape_char: AddEscapeCharState;
  raw_text: string;
  raw_error: string | null;
  last_valid_grid: GridState;
  move_selection: SelectionRect | null;
}
