// src/dom.ts
function mount_app(root) {
  root.innerHTML = `
    <div class="editor-shell">
      <header class="topbar">
        <div class="topbar-col topbar-col-brand">
          <div class="project-title">Vibi Level Editor</div>
        </div>
        <div class="topbar-col topbar-col-main">
          <div id="map-name" class="map-name"></div>
        </div>
        <div class="topbar-col topbar-col-actions">
          <div class="topbar-actions">
            <button id="action-save" class="topbar-action-btn" type="button">Save</button>
            <button id="action-save-as" class="topbar-action-btn" type="button">Save As</button>
            <button id="action-load" class="topbar-action-btn" type="button">Load</button>
          </div>
        </div>
        <div class="mode-toggle" role="tablist" aria-label="Render mode">
          <button id="mode-visual" class="mode-btn active" type="button">VISUAL</button>
          <button id="mode-raw" class="mode-btn" type="button">RAW</button>
        </div>
      </header>
      <main class="main-layout">
        <aside class="sidebar">
          <section class="tool-section">
            <h2>Collider</h2>
            <button id="tool-collider" class="tool-btn icon-only" type="button" aria-label="Collider tool" title="Collider">
              <img src="assets/collider.svg" alt="" />
            </button>
          </section>
          <section class="tool-section">
            <h2>Select/Move</h2>
            <button id="tool-move" class="tool-btn icon-only active" type="button" aria-label="Move tool" title="Move">
              <img src="assets/move.svg" alt="" />
            </button>
          </section>
          <section class="tool-section">
            <h2>Sprites</h2>
            <div class="tool-row">
              <button id="tool-paint" class="tool-btn icon-only" type="button" aria-label="Paint tool" title="Paint">
                <img src="assets/paint.svg" alt="" />
              </button>
              <button id="tool-rubber" class="tool-btn icon-only rubber-btn" type="button" aria-label="Rubber tool" title="Rubber">
                <span>×</span>
              </button>
            </div>
          </section>
          <section id="paint-panel" class="paint-panel hidden">
            <h3>Glyph Tilesets</h3>
            <input id="sprite-search" type="text" placeholder="Search glyph/token..." />
            <div id="sprite-meta" class="sprite-meta" aria-hidden="true"></div>
            <div id="sprite-list" class="sprite-list"></div>
          </section>
        </aside>
        <section class="workspace">
          <div id="visual-panel" class="panel visual-panel active">
            <div class="visual-toolbar">
              <span class="visual-toolbar-hints">Pan: Space+Drag | Zoom: Ctrl/Cmd+Wheel | Reset: 0 | Toggle View: Tab</span>
              <div class="visual-toolbar-actions">
                <label class="sync-toggle" for="sync-view">
                  <input id="sync-view" class="sync-toggle-input" type="checkbox" />
                  <span class="sync-toggle-track" aria-hidden="true"></span>
                  <span class="sync-toggle-text">Sync View <span class="sync-toggle-key">(S)</span></span>
                </label>
                <label class="sync-toggle" for="add-escape-char">
                  <input id="add-escape-char" class="sync-toggle-input" type="checkbox" />
                  <span class="sync-toggle-track" aria-hidden="true"></span>
                  <span class="sync-toggle-text">Add Escape Char</span>
                </label>
              </div>
            </div>
            <div id="visual-stage" class="visual-stage">
              <div id="visual-grid" class="visual-grid"></div>
              <div id="visual-overlay" class="visual-overlay"></div>
            </div>
          </div>
          <div id="raw-panel" class="panel raw-panel">
            <textarea id="raw-text" spellcheck="false"></textarea>
            <div id="raw-error" class="raw-error"></div>
          </div>
        </section>
      </main>
      <footer class="statusbar">
        <div id="status-text"></div>
      </footer>
      <div id="modal-root" class="modal-root" aria-hidden="true">
        <div id="modal-backdrop" class="modal-backdrop"></div>
        <div id="modal-window" class="modal-window" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-window-header">
            <h2 id="modal-title" class="modal-title"></h2>
            <button id="modal-close" class="modal-close" type="button" aria-label="Close dialog">Close</button>
          </div>
          <div id="modal-body" class="modal-body"></div>
        </div>
      </div>
    </div>
  `;
  return {
    app: root,
    action_save_btn: root.querySelector("#action-save"),
    action_save_as_btn: root.querySelector("#action-save-as"),
    action_load_btn: root.querySelector("#action-load"),
    map_name: root.querySelector("#map-name"),
    mode_raw_btn: root.querySelector("#mode-raw"),
    mode_visual_btn: root.querySelector("#mode-visual"),
    sync_view_toggle: root.querySelector("#sync-view"),
    add_escape_char_toggle: root.querySelector("#add-escape-char"),
    tool_collider_btn: root.querySelector("#tool-collider"),
    tool_move_btn: root.querySelector("#tool-move"),
    tool_paint_btn: root.querySelector("#tool-paint"),
    tool_rubber_btn: root.querySelector("#tool-rubber"),
    raw_panel: root.querySelector("#raw-panel"),
    raw_textarea: root.querySelector("#raw-text"),
    raw_error: root.querySelector("#raw-error"),
    visual_panel: root.querySelector("#visual-panel"),
    visual_stage: root.querySelector("#visual-stage"),
    visual_grid: root.querySelector("#visual-grid"),
    visual_overlay: root.querySelector("#visual-overlay"),
    paint_panel: root.querySelector("#paint-panel"),
    sprite_search: root.querySelector("#sprite-search"),
    sprite_list: root.querySelector("#sprite-list"),
    sprite_meta: root.querySelector("#sprite-meta"),
    status_text: root.querySelector("#status-text"),
    modal_root: root.querySelector("#modal-root"),
    modal_backdrop: root.querySelector("#modal-backdrop"),
    modal_window: root.querySelector("#modal-window"),
    modal_title: root.querySelector("#modal-title"),
    modal_body: root.querySelector("#modal-body"),
    modal_close_btn: root.querySelector("#modal-close")
  };
}
function set_mode_ui(refs, mode) {
  refs.mode_raw_btn.classList.toggle("active", mode === "raw");
  refs.mode_visual_btn.classList.toggle("active", mode === "visual");
  refs.raw_panel.classList.toggle("active", mode === "raw");
  refs.visual_panel.classList.toggle("active", mode === "visual");
}
function set_sync_view_ui(refs, enabled) {
  refs.sync_view_toggle.checked = enabled;
}
function set_add_escape_char_ui(refs, enabled) {
  refs.add_escape_char_toggle.checked = enabled;
}
function set_map_name(refs, name) {
  refs.map_name.textContent = name || "";
}
function set_modal_open(refs, open) {
  refs.modal_root.classList.toggle("open", open);
  refs.modal_root.setAttribute("aria-hidden", open ? "false" : "true");
}
function set_modal_title(refs, title) {
  refs.modal_title.textContent = title;
}
function set_modal_close_visible(refs, visible) {
  refs.modal_close_btn.hidden = !visible;
}
function set_tool_ui(refs, tool) {
  refs.tool_collider_btn.classList.toggle("active", tool === "collider");
  refs.tool_move_btn.classList.toggle("active", tool === "move");
  refs.tool_paint_btn.classList.toggle("active", tool === "paint");
  refs.tool_rubber_btn.classList.toggle("active", tool === "rubber");
  refs.paint_panel.classList.toggle("hidden", tool !== "paint");
}
function set_raw_error(refs, error) {
  refs.raw_error.textContent = error || "";
  refs.raw_error.classList.toggle("visible", !!error);
}
function set_status(refs, text) {
  refs.status_text.textContent = text;
}
function set_status_html(refs, html) {
  refs.status_text.innerHTML = html;
}

// src/camera-sync.ts
var VISUAL_TILE_SIZE = 40;
var VISUAL_MIN_ZOOM = 0.5;
var VISUAL_MAX_ZOOM = 4;
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function safe_number(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
function to_px(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function raw_tile_size_avg(metrics) {
  const tile_x = 4 * metrics.char_width_px;
  const tile_y = 2 * metrics.line_height_px;
  return (tile_x + tile_y) / 2;
}
function apply_probe_style(el, computed, fallback_font_size) {
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
function measure_char_width(textarea, font_size_px) {
  const computed = getComputedStyle(textarea);
  const probe = document.createElement("span");
  apply_probe_style(probe, computed, font_size_px);
  probe.textContent = "MMMMMMMMMMMMMMMM";
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width / 16;
  probe.remove();
  return width > 0 ? width : font_size_px * 0.62;
}
function measure_line_height(textarea, font_size_px) {
  const computed = getComputedStyle(textarea);
  const parsed = to_px(computed.lineHeight, Number.NaN);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  const probe = document.createElement("div");
  apply_probe_style(probe, computed, font_size_px);
  probe.textContent = `M
M`;
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height / 2;
  probe.remove();
  return height > 0 ? height : font_size_px * 1.2;
}
function visual_to_camera(viewport, stage, tile_size = VISUAL_TILE_SIZE) {
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
function camera_to_visual(camera, stage, tile_size = VISUAL_TILE_SIZE) {
  const zoom = clamp(camera.visual_zoom, VISUAL_MIN_ZOOM, VISUAL_MAX_ZOOM);
  const world_x = camera.center_tile_x * tile_size;
  const world_y = camera.center_tile_y * tile_size;
  return {
    zoom,
    offset_x: stage.width / 2 - world_x * zoom,
    offset_y: stage.height / 2 - world_y * zoom
  };
}
function measure_raw_metrics(textarea) {
  const computed = getComputedStyle(textarea);
  const font_size_px = to_px(computed.fontSize, 13);
  const char_width_px = measure_char_width(textarea, font_size_px);
  const line_height_px = measure_line_height(textarea, font_size_px);
  return {
    font_size_px,
    char_width_px,
    line_height_px,
    scroll_left: textarea.scrollLeft,
    scroll_top: textarea.scrollTop
  };
}
function read_raw_viewport_size(textarea) {
  return {
    client_width: textarea.clientWidth,
    client_height: textarea.clientHeight,
    scroll_width: textarea.scrollWidth,
    scroll_height: textarea.scrollHeight
  };
}
function visual_zoom_to_raw_font_px(visual_zoom, base_metrics, tile_size = VISUAL_TILE_SIZE) {
  const base_tile_size = raw_tile_size_avg(base_metrics);
  if (base_tile_size <= 0) {
    return base_metrics.font_size_px;
  }
  const target_tile_size = tile_size * clamp(visual_zoom, VISUAL_MIN_ZOOM, VISUAL_MAX_ZOOM);
  const scale = target_tile_size / base_tile_size;
  return clamp(base_metrics.font_size_px * scale, 8, 96);
}
function raw_font_px_to_visual_zoom(raw_font_px, base_metrics, tile_size = VISUAL_TILE_SIZE) {
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
function camera_to_raw_scroll(camera, raw_metrics, viewport) {
  const char_width = Math.max(1, raw_metrics.char_width_px);
  const line_height = Math.max(1, raw_metrics.line_height_px);
  const char_center = camera.center_tile_x * 4 + 2;
  const line_center = camera.center_tile_y * 2 + 1;
  const left = char_center * char_width - viewport.client_width / 2;
  const top = line_center * line_height - viewport.client_height / 2;
  const max_left = Math.max(0, viewport.scroll_width - viewport.client_width);
  const max_top = Math.max(0, viewport.scroll_height - viewport.client_height);
  return {
    left: clamp(left, 0, max_left),
    top: clamp(top, 0, max_top)
  };
}
function raw_scroll_to_camera(raw_metrics, viewport, visual_zoom) {
  const char_width = Math.max(1, raw_metrics.char_width_px);
  const line_height = Math.max(1, raw_metrics.line_height_px);
  const char_center = (raw_metrics.scroll_left + viewport.client_width / 2) / char_width;
  const line_center = (raw_metrics.scroll_top + viewport.client_height / 2) / line_height;
  return {
    center_tile_x: (char_center - 2) / 4,
    center_tile_y: (line_center - 1) / 2,
    visual_zoom: clamp(visual_zoom, VISUAL_MIN_ZOOM, VISUAL_MAX_ZOOM)
  };
}

// src/raw-format.ts
var EMPTY_FLOOR = "___";
var EMPTY_ENTITY = "   ";
var COLLIDER_ENTITY = ":::";
function normalize_glyph_3(token) {
  if (token.length === 3) {
    return token;
  }
  if (token.length < 3) {
    return token.padEnd(3, " ");
  }
  return token.slice(0, 3);
}
function parse_line(line) {
  let text = line;
  if (text.endsWith("\r")) {
    text = text.slice(0, -1);
  }
  if (text.length === 0) {
    return { ok: true, row: [] };
  }
  if (text.length % 4 !== 0) {
    return { ok: false, error: "line width must be a multiple of 4." };
  }
  const row = [];
  for (let i = 0;i < text.length; i += 4) {
    const cell = text.slice(i, i + 4);
    if (cell.length !== 4 || cell[3] !== "|") {
      return {
        ok: false,
        error: `invalid cell separator at column ${i + 4}.`
      };
    }
    row.push(normalize_glyph_3(cell.slice(0, 3)));
  }
  return { ok: true, row };
}
function make_empty_grid(width, height) {
  const cells = [];
  for (let y = 0;y < height; y++) {
    const row = [];
    for (let x = 0;x < width; x++) {
      row.push({ floor: EMPTY_FLOOR, entity: EMPTY_ENTITY });
    }
    cells.push(row);
  }
  return { width, height, cells };
}
function clone_grid(grid) {
  return {
    width: grid.width,
    height: grid.height,
    cells: grid.cells.map((row) => row.map((cell) => ({ ...cell })))
  };
}
function serialize_raw(grid) {
  const lines = [];
  for (let y = 0;y < grid.height; y++) {
    let entity_line = "";
    let floor_line = "";
    for (let x = 0;x < grid.width; x++) {
      const cell = grid.cells[y][x];
      entity_line += `${normalize_glyph_3(cell.entity)}|`;
      floor_line += `${normalize_glyph_3(cell.floor)}|`;
    }
    lines.push(entity_line);
    lines.push(floor_line);
  }
  return lines.join(`
`);
}
function parse_raw(text) {
  const lines = text.split(`
`).map((line) => line.endsWith("\r") ? line.slice(0, -1) : line).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { ok: false, error: "RAW is empty." };
  }
  if (lines.length % 2 !== 0) {
    return { ok: false, error: "RAW must have an even number of lines." };
  }
  const entity_rows = [];
  const floor_rows = [];
  for (let i = 0;i < lines.length; i += 2) {
    const entity_row_res = parse_line(lines[i]);
    if (!entity_row_res.ok) {
      return { ok: false, error: `Line ${i + 1}: ${entity_row_res.error}` };
    }
    const floor_row_res = parse_line(lines[i + 1]);
    if (!floor_row_res.ok) {
      return { ok: false, error: `Line ${i + 2}: ${floor_row_res.error}` };
    }
    const entity_row = entity_row_res.row;
    const floor_row = floor_row_res.row;
    if (entity_row.length !== floor_row.length) {
      const line_no = i + 1;
      return {
        ok: false,
        error: `Line ${line_no}: entity and floor have different widths.`
      };
    }
    entity_rows.push(entity_row);
    floor_rows.push(floor_row);
  }
  const width = floor_rows[0]?.length ?? 0;
  if (width === 0) {
    return { ok: false, error: "RAW has no valid columns." };
  }
  for (let y = 0;y < floor_rows.length; y++) {
    if (floor_rows[y].length !== width || entity_rows[y].length !== width) {
      return { ok: false, error: `Tile row ${y + 1} has inconsistent width.` };
    }
  }
  const cells = [];
  for (let y = 0;y < floor_rows.length; y++) {
    const row = [];
    for (let x = 0;x < width; x++) {
      row.push({
        entity: normalize_glyph_3(entity_rows[y][x]),
        floor: normalize_glyph_3(floor_rows[y][x])
      });
    }
    cells.push(row);
  }
  return {
    ok: true,
    grid: {
      width,
      height: floor_rows.length,
      cells
    }
  };
}

// src/glyph-catalog.ts
function label_from_name(name) {
  return name.replace(/^tile_/, "").replace(/^ent_/, "").replace(/^icon_/, "").replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}
function normalize_token(token) {
  if (token.length === 3) {
    return token;
  }
  if (token.length < 3) {
    return token.padEnd(3, " ");
  }
  return token.slice(0, 3);
}
function parse_num(str, fallback = 1) {
  const n = Number(str.trim());
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}
function parse_bool(str, fallback = false) {
  const v = str.trim();
  if (v === "true") {
    return true;
  }
  if (v === "false") {
    return false;
  }
  return fallback;
}
function split_call_args(text) {
  const args = [];
  let current = "";
  let depth = 0;
  let in_string = false;
  let escaped = false;
  for (let i = 0;i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      current += ch;
      in_string = !in_string;
      continue;
    }
    if (!in_string) {
      if (ch === "(" || ch === "[" || ch === "{") {
        depth += 1;
      } else if (ch === ")" || ch === "]" || ch === "}") {
        depth = Math.max(0, depth - 1);
      } else if (ch === "," && depth === 0) {
        args.push(current.trim());
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) {
    args.push(current.trim());
  }
  return args;
}
function strip_quotes(value) {
  const v = value.trim();
  if (v.length < 2 || v[0] !== '"' || v[v.length - 1] !== '"') {
    return null;
  }
  return v.slice(1, -1);
}
function decode_escaped_literal(value) {
  const safe = value.replace(/"/g, "\\\"");
  try {
    return JSON.parse(`"${safe}"`);
  } catch {
    return value;
  }
}
function push_unique(tokens, next) {
  for (const tok of tokens) {
    if (tok.token === next.token) {
      return;
    }
  }
  tokens.push(next);
}
function parse_new_entries(source) {
  const out = [];
  const entry_re = /"((?:\\.|[^"])*)"\s*:\s*Glyph\.(none|bigimg|borded|entity|player)(?:\(([\s\S]*?)\))?\s*,?/g;
  let m = entry_re.exec(source);
  while (m) {
    const token = normalize_token(decode_escaped_literal(m[1]));
    const kind = m[2];
    const args = split_call_args(m[3] || "");
    if (kind === "none") {
      push_unique(out, {
        token,
        kind,
        layer: "entity",
        name: "none",
        width: 1,
        height: 1,
        single: false,
        sprite: null,
        label: "Empty"
      });
      m = entry_re.exec(source);
      continue;
    }
    if (kind === "player") {
      push_unique(out, {
        token,
        kind,
        layer: "entity",
        name: "Player",
        width: 1,
        height: 1,
        single: false,
        sprite: "ent_red",
        label: "Player"
      });
      m = entry_re.exec(source);
      continue;
    }
    if (kind === "bigimg") {
      const name = strip_quotes(args[0] || "") || token;
      const width = parse_num(args[1] || "1", 1);
      const height = parse_num(args[2] || "1", 1);
      const single = parse_bool(args[3] || "false", false);
      push_unique(out, {
        token,
        kind,
        layer: "floor",
        name,
        width,
        height,
        single,
        sprite: null,
        label: label_from_name(name)
      });
      m = entry_re.exec(source);
      continue;
    }
    if (kind === "borded") {
      const name = strip_quotes(args[0] || "") || token;
      push_unique(out, {
        token,
        kind,
        layer: "floor",
        name,
        width: 1,
        height: 1,
        single: false,
        sprite: null,
        label: label_from_name(name)
      });
      m = entry_re.exec(source);
      continue;
    }
    if (kind === "entity") {
      const label_name = strip_quotes(args[0] || "") || token;
      const sprite = strip_quotes(args[1] || "");
      push_unique(out, {
        token,
        kind,
        layer: "entity",
        name: label_name,
        width: 1,
        height: 1,
        single: false,
        sprite,
        label: label_from_name(label_name)
      });
    }
    m = entry_re.exec(source);
  }
  return out;
}
function parse_str(block, key) {
  const re = new RegExp(`${key}:\\s*"([^"]+)"`);
  const m = block.match(re);
  if (!m) {
    return null;
  }
  return m[1];
}
function parse_num_field(block, key, fallback) {
  const re = new RegExp(`${key}:\\s*(\\d+)`);
  const m = block.match(re);
  if (!m) {
    return fallback;
  }
  return Number(m[1]);
}
function parse_legacy_entries(source) {
  const out = [];
  const token_re = /"([^"]{2})"\s*:\s*\{([\s\S]*?)\n\s*\},?/g;
  let m = token_re.exec(source);
  while (m) {
    const token = normalize_token(m[1]);
    const block = m[2];
    const legacy_kind = parse_str(block, "kind");
    const name = parse_str(block, "name") || token.trim();
    const width = Math.max(1, parse_num_field(block, "width", 1));
    const height = Math.max(1, parse_num_field(block, "height", 1));
    const sprite = parse_str(block, "sprite");
    if (legacy_kind === "bordered") {
      push_unique(out, {
        token,
        kind: "borded",
        layer: "floor",
        name,
        width: 1,
        height: 1,
        single: false,
        sprite: null,
        label: label_from_name(name)
      });
    } else if (legacy_kind === "entity") {
      const is_player = (sprite || "").startsWith("ent_") && name.toLowerCase() === "player";
      push_unique(out, {
        token,
        kind: is_player ? "player" : "entity",
        layer: "entity",
        name,
        width: 1,
        height: 1,
        single: false,
        sprite: sprite || null,
        label: label_from_name(name)
      });
    } else if (legacy_kind === "building") {
      const as_entity = name.startsWith("icon_") || name === "tile_mountain_door";
      push_unique(out, {
        token,
        kind: as_entity ? "entity" : "bigimg",
        layer: as_entity ? "entity" : "floor",
        name,
        width,
        height,
        single: false,
        sprite: as_entity ? name : null,
        label: label_from_name(name)
      });
    }
    m = token_re.exec(source);
  }
  return out;
}
function ensure_defaults(tokens) {
  const out = [...tokens];
  push_unique(out, {
    token: EMPTY_ENTITY,
    kind: "none",
    layer: "entity",
    name: "none",
    width: 1,
    height: 1,
    single: false,
    sprite: null,
    label: "Empty"
  });
  push_unique(out, {
    token: EMPTY_FLOOR,
    kind: "bigimg",
    layer: "floor",
    name: "tile_grass",
    width: 1,
    height: 1,
    single: false,
    sprite: null,
    label: "Grass"
  });
  const rank = {
    none: 0,
    bigimg: 1,
    borded: 2,
    entity: 3,
    player: 4
  };
  out.sort((a, b) => {
    const ar = rank[a.kind] ?? 99;
    const br = rank[b.kind] ?? 99;
    if (ar !== br) {
      return ar - br;
    }
    return a.token.localeCompare(b.token);
  });
  return out;
}
function parse_glyph_entries(source) {
  const modern = parse_new_entries(source);
  if (modern.length > 0) {
    return ensure_defaults(modern);
  }
  const legacy = parse_legacy_entries(source);
  return ensure_defaults(legacy);
}
async function load_glyph_catalog() {
  const candidates = ["vibimon-assets/Glyph.ts", "VibiMon/src/data/Glyph.ts"];
  let last_error = "Could not load Glyph.ts.";
  for (const path of candidates) {
    const res = await fetch(path);
    if (!res.ok) {
      last_error = `Could not load ${path}.`;
      continue;
    }
    const source = await res.text();
    return parse_glyph_entries(source);
  }
  throw new Error(last_error);
}
function token_map(tokens) {
  const map = new Map;
  for (const tok of tokens) {
    map.set(tok.token, tok);
  }
  return map;
}

// src/keyboard-shortcuts.ts
function consume(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation();
}
function has_only_primary_modifier(ev) {
  const primary_count = Number(ev.metaKey) + Number(ev.ctrlKey);
  return primary_count === 1 && !ev.altKey;
}
function is_primary_combo(ev, key, shift) {
  return has_only_primary_modifier(ev) && ev.shiftKey === shift && ev.key.toLowerCase() === key.toLowerCase();
}
function is_unmodified(ev, key) {
  return !ev.metaKey && !ev.ctrlKey && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === key.toLowerCase();
}
function is_unmodified_named(ev, key) {
  return !ev.metaKey && !ev.ctrlKey && !ev.altKey && !ev.shiftKey && ev.key === key;
}
function is_tab_without_system_modifiers(ev) {
  return ev.key === "Tab" && !ev.metaKey && !ev.ctrlKey && !ev.altKey;
}
function handle_editor_shortcuts(ev, ctx, handlers) {
  if (is_tab_without_system_modifiers(ev)) {
    consume(ev);
    handlers.toggle_viewport();
    return;
  }
  const navigation_keys = new Set(["ArrowUp", "ArrowDown", "Enter", "Escape"]);
  if (ctx.in_text_entry && !navigation_keys.has(ev.key)) {
    return;
  }
  if (is_unmodified(ev, "m")) {
    consume(ev);
    handlers.set_tool("move");
    return;
  }
  if (is_unmodified(ev, "c")) {
    consume(ev);
    handlers.set_tool("collider");
    return;
  }
  if (is_unmodified(ev, "p")) {
    consume(ev);
    handlers.set_tool("paint");
    handlers.focus_glyph_search();
    return;
  }
  if (is_unmodified(ev, "d")) {
    consume(ev);
    handlers.set_tool("rubber");
    return;
  }
  if (is_unmodified(ev, "s")) {
    consume(ev);
    handlers.toggle_sync_view();
    return;
  }
  if (is_unmodified_named(ev, "ArrowUp")) {
    consume(ev);
    handlers.navigate_glyphs("up");
    return;
  }
  if (is_unmodified_named(ev, "ArrowDown")) {
    consume(ev);
    handlers.navigate_glyphs("down");
    return;
  }
  if (is_unmodified_named(ev, "Enter")) {
    consume(ev);
    handlers.select_highlighted_glyph();
    return;
  }
  if (is_unmodified_named(ev, "Escape")) {
    consume(ev);
    handlers.dismiss();
  }
}
function handle_load_modal_shortcuts(ev, ctx, handlers) {
  if (is_tab_without_system_modifiers(ev)) {
    consume(ev);
    handlers.load_toggle_sort(ev.shiftKey ? "backward" : "forward");
    return;
  }
  if (is_unmodified_named(ev, "Escape")) {
    consume(ev);
    handlers.dismiss();
    return;
  }
  if (ctx.load_search_focused || ctx.in_text_entry) {
    return;
  }
  if (is_unmodified_named(ev, "ArrowLeft")) {
    consume(ev);
    handlers.load_move_selection("left");
    return;
  }
  if (is_unmodified_named(ev, "ArrowRight")) {
    consume(ev);
    handlers.load_move_selection("right");
    return;
  }
  if (is_unmodified_named(ev, "ArrowUp")) {
    consume(ev);
    handlers.load_move_selection("up");
    return;
  }
  if (is_unmodified_named(ev, "ArrowDown")) {
    consume(ev);
    handlers.load_move_selection("down");
    return;
  }
  if (is_unmodified_named(ev, "Enter")) {
    consume(ev);
    handlers.load_activate_selection();
  }
}
function handle_non_load_modal_shortcuts(ev, handlers) {
  if (is_tab_without_system_modifiers(ev)) {
    consume(ev);
    return;
  }
  if (is_unmodified_named(ev, "Escape")) {
    consume(ev);
    handlers.dismiss();
  }
}
function bind_shortcuts(handlers) {
  const handle_keydown = (ev) => {
    if (is_primary_combo(ev, "s", false)) {
      consume(ev);
      handlers.system_save();
      return;
    }
    if (is_primary_combo(ev, "s", true)) {
      consume(ev);
      handlers.system_save_as();
      return;
    }
    if (is_primary_combo(ev, "o", false)) {
      consume(ev);
      handlers.system_load();
      return;
    }
    const ctx = handlers.get_context();
    if (ctx.modal_kind === "load") {
      handle_load_modal_shortcuts(ev, ctx, handlers);
      return;
    }
    if (ctx.modal_kind !== "none") {
      handle_non_load_modal_shortcuts(ev, handlers);
      return;
    }
    handle_editor_shortcuts(ev, ctx, handlers);
  };
  window.addEventListener("keydown", handle_keydown);
  return () => window.removeEventListener("keydown", handle_keydown);
}

// src/level-storage.ts
var STORAGE_KEY = "vibimon_map_editor_levels_v2";
function now_iso() {
  return new Date().toISOString();
}
function normalize_name(name) {
  return name.trim();
}
function make_id() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lvl_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function safe_parse(raw) {
  if (!raw) {
    return { levels: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.levels)) {
      return { levels: [] };
    }
    const levels = [];
    for (const item of parsed.levels) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const level = item;
      if (typeof level.id !== "string" || typeof level.name !== "string" || typeof level.raw_text !== "string" || typeof level.grid_width !== "number" || typeof level.grid_height !== "number" || typeof level.created_at !== "string" || typeof level.updated_at !== "string") {
        continue;
      }
      levels.push(level);
    }
    return { levels };
  } catch {
    return { levels: [] };
  }
}
function read_collection() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return safe_parse(raw);
}
function write_collection(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function sort_recent(levels) {
  return [...levels].sort((a, b) => {
    const at = Date.parse(a.updated_at);
    const bt = Date.parse(b.updated_at);
    return bt - at;
  });
}
function unique_name(base_name, existing_levels, exclude_id) {
  const normalized = normalize_name(base_name);
  if (!normalized) {
    throw new Error("Level name is required.");
  }
  const exists = (candidate) => {
    const candidate_lower = candidate.toLowerCase();
    for (const level of existing_levels) {
      if (exclude_id && level.id === exclude_id) {
        continue;
      }
      if (level.name.toLowerCase() === candidate_lower) {
        return true;
      }
    }
    return false;
  };
  if (!exists(normalized)) {
    return normalized;
  }
  let idx = 1;
  while (true) {
    const candidate = `${normalized} ${idx}`;
    if (!exists(candidate)) {
      return candidate;
    }
    idx += 1;
  }
}
function list_levels() {
  return sort_recent(read_collection().levels);
}
function get_level(id) {
  for (const level of read_collection().levels) {
    if (level.id === id) {
      return level;
    }
  }
  return null;
}
function search_levels(query) {
  const q = query.trim().toLowerCase();
  const levels = list_levels();
  if (!q) {
    return levels;
  }
  return levels.filter((level) => level.name.toLowerCase().includes(q));
}
function save_level(input) {
  const normalized_name = normalize_name(input.name);
  if (!normalized_name) {
    throw new Error("Level name is required.");
  }
  const collection = read_collection();
  const idx = input.id ? collection.levels.findIndex((level) => level.id === input.id) : -1;
  const now = now_iso();
  if (idx >= 0) {
    const current = collection.levels[idx];
    const next_name = unique_name(normalized_name, collection.levels, current.id);
    const updated = {
      ...current,
      name: next_name,
      raw_text: input.raw_text,
      grid_width: input.grid_width,
      grid_height: input.grid_height,
      updated_at: now
    };
    collection.levels[idx] = updated;
    write_collection(collection);
    return updated;
  }
  const created = {
    id: make_id(),
    name: unique_name(normalized_name, collection.levels, null),
    raw_text: input.raw_text,
    grid_width: input.grid_width,
    grid_height: input.grid_height,
    created_at: now,
    updated_at: now
  };
  collection.levels.push(created);
  write_collection(collection);
  return created;
}
function rename_level(id, name) {
  const normalized_name = normalize_name(name);
  if (!normalized_name) {
    throw new Error("Level name is required.");
  }
  const collection = read_collection();
  const idx = collection.levels.findIndex((level) => level.id === id);
  if (idx < 0) {
    return null;
  }
  const current = collection.levels[idx];
  const next_name = unique_name(normalized_name, collection.levels, current.id);
  const updated = {
    ...current,
    name: next_name,
    updated_at: now_iso()
  };
  collection.levels[idx] = updated;
  write_collection(collection);
  return updated;
}
function delete_level(id) {
  const collection = read_collection();
  const before = collection.levels.length;
  collection.levels = collection.levels.filter((level) => level.id !== id);
  if (collection.levels.length === before) {
    return false;
  }
  write_collection(collection);
  return true;
}

// src/state.ts
function normalize_glyph(token) {
  if (token.length === 3) {
    return token;
  }
  if (token.length < 3) {
    return token.padEnd(3, " ");
  }
  return token.slice(0, 3);
}
function create_initial_state() {
  const grid = make_empty_grid(20, 20);
  const raw_text = serialize_raw(grid);
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
    last_valid_grid: clone_grid(grid),
    move_selection: null
  };
}
function grid_get(grid, x, y) {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
    return null;
  }
  return grid.cells[y][x];
}
function grid_set(grid, x, y, cell) {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
    return;
  }
  const normalized_backup = typeof cell.entity_backup === "string" ? normalize_glyph(cell.entity_backup) : undefined;
  grid.cells[y][x] = {
    floor: normalize_glyph(cell.floor),
    entity: normalize_glyph(cell.entity),
    entity_backup: normalized_backup
  };
}
function is_empty_cell(cell) {
  return cell.floor === EMPTY_FLOOR && cell.entity === EMPTY_ENTITY;
}
function normalize_rect(a_x, a_y, b_x, b_y) {
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
function sync_raw_from_grid(state) {
  state.raw_text = serialize_raw(state.grid);
  state.raw_error = null;
  state.last_valid_grid = clone_grid(state.grid);
}
function sync_grid_from_raw(state, raw_text) {
  state.raw_text = raw_text;
  const parsed = parse_raw(raw_text);
  if (!parsed.ok) {
    state.raw_error = parsed.error;
    return;
  }
  state.grid = parsed.grid;
  state.last_valid_grid = clone_grid(parsed.grid);
  state.raw_error = null;
  if (state.move_selection) {
    state.move_selection = null;
  }
}

// src/tools.ts
function in_bounds(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}
function apply_paint_at(grid, x, y, token) {
  if (!in_bounds(grid, x, y)) {
    return;
  }
  if (token.kind === "bigimg" && (token.width > 1 || token.height > 1)) {
    for (let iy = 0;iy < token.height; iy++) {
      for (let ix = 0;ix < token.width; ix++) {
        const tx = x + ix;
        const ty = y + iy;
        if (!in_bounds(grid, tx, ty)) {
          continue;
        }
        const cell2 = grid_get(grid, tx, ty);
        if (!cell2) {
          continue;
        }
        const next2 = { ...cell2, floor: token.token };
        grid_set(grid, tx, ty, next2);
      }
    }
    return;
  }
  const cell = grid_get(grid, x, y);
  if (!cell) {
    return;
  }
  const next = { ...cell };
  if (token.layer === "entity") {
    next.entity = token.token;
    next.entity_backup = undefined;
  } else {
    next.floor = token.token;
  }
  grid_set(grid, x, y, next);
}
function apply_paint_rect(grid, rect, token) {
  for (let y = rect.y;y < rect.y + rect.h; y++) {
    for (let x = rect.x;x < rect.x + rect.w; x++) {
      apply_paint_at(grid, x, y, token);
    }
  }
}
function apply_erase_at(grid, x, y) {
  if (!in_bounds(grid, x, y)) {
    return;
  }
  grid_set(grid, x, y, {
    floor: EMPTY_FLOOR,
    entity: EMPTY_ENTITY,
    entity_backup: undefined
  });
}
function apply_erase_rect(grid, rect) {
  for (let y = rect.y;y < rect.y + rect.h; y++) {
    for (let x = rect.x;x < rect.x + rect.w; x++) {
      apply_erase_at(grid, x, y);
    }
  }
}
function apply_collider_at(grid, x, y) {
  if (!in_bounds(grid, x, y)) {
    return;
  }
  const cell = grid_get(grid, x, y);
  if (!cell) {
    return;
  }
  if (cell.entity === COLLIDER_ENTITY) {
    const restored = typeof cell.entity_backup === "string" && cell.entity_backup !== EMPTY_ENTITY && cell.entity_backup !== COLLIDER_ENTITY ? cell.entity_backup : EMPTY_ENTITY;
    grid_set(grid, x, y, {
      ...cell,
      entity: restored,
      entity_backup: undefined
    });
    return;
  }
  grid_set(grid, x, y, {
    ...cell,
    entity: COLLIDER_ENTITY,
    entity_backup: cell.entity
  });
}
function apply_collider_rect(grid, rect) {
  for (let y = rect.y;y < rect.y + rect.h; y++) {
    for (let x = rect.x;x < rect.x + rect.w; x++) {
      apply_collider_at(grid, x, y);
    }
  }
}
function move_single_cell(grid, from_x, from_y, to_x, to_y) {
  if (!in_bounds(grid, from_x, from_y) || !in_bounds(grid, to_x, to_y)) {
    return;
  }
  const from = grid_get(grid, from_x, from_y);
  if (!from || is_empty_cell(from)) {
    return;
  }
  const to = grid_get(grid, to_x, to_y);
  if (!to) {
    return;
  }
  grid_set(grid, to_x, to_y, from);
  grid_set(grid, from_x, from_y, {
    floor: EMPTY_FLOOR,
    entity: EMPTY_ENTITY
  });
}
function move_rect(grid, rect, delta_x, delta_y) {
  if (delta_x === 0 && delta_y === 0) {
    return;
  }
  const snapshot = [];
  for (let y = 0;y < rect.h; y++) {
    for (let x = 0;x < rect.w; x++) {
      const src_x = rect.x + x;
      const src_y = rect.y + y;
      const cell = grid_get(grid, src_x, src_y);
      snapshot.push(cell ? { ...cell } : { floor: EMPTY_FLOOR, entity: EMPTY_ENTITY });
    }
  }
  for (let y = 0;y < rect.h; y++) {
    for (let x = 0;x < rect.w; x++) {
      const src_x = rect.x + x;
      const src_y = rect.y + y;
      if (in_bounds(grid, src_x, src_y)) {
        grid_set(grid, src_x, src_y, {
          floor: EMPTY_FLOOR,
          entity: EMPTY_ENTITY,
          entity_backup: undefined
        });
      }
    }
  }
  for (let y = 0;y < rect.h; y++) {
    for (let x = 0;x < rect.w; x++) {
      const idx = y * rect.w + x;
      const dst_x = rect.x + x + delta_x;
      const dst_y = rect.y + y + delta_y;
      if (!in_bounds(grid, dst_x, dst_y)) {
        continue;
      }
      grid_set(grid, dst_x, dst_y, snapshot[idx]);
    }
  }
}

// src/vibimon-resolver.ts
var VIBIMON_ASSET_ROOT = "vibimon-assets";
var DEFAULT_FLOOR_ASSET = `${VIBIMON_ASSET_ROOT}/tile_grass_00_00.png`;
function sprite_id(name, ix, iy) {
  const pad_x = String(ix).padStart(2, "0");
  const pad_y = String(iy).padStart(2, "0");
  return `${name}_${pad_x}_${pad_y}`;
}
function bigimg_asset(def, ix, iy) {
  if (def.single) {
    return `${VIBIMON_ASSET_ROOT}/${def.name}.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite_id(def.name, ix, iy)}.png`;
}
function entity_sprite_asset(sprite) {
  if (sprite.startsWith("ent_")) {
    return `${VIBIMON_ASSET_ROOT}/${sprite}_front_stand.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite}.png`;
}
function border_id(name, up, dw, lf, rg, up_lf, up_rg, dw_lf, dw_rg) {
  const base = `${name}_`;
  let suffix = "center";
  switch (true) {
    case (!up && !lf):
      suffix = "outer_top_lft";
      break;
    case (!up && !rg):
      suffix = "outer_top_rgt";
      break;
    case (!dw && !lf):
      suffix = "outer_bot_lft";
      break;
    case (!dw && !rg):
      suffix = "outer_bot_rgt";
      break;
    case !up:
      suffix = "edge_top";
      break;
    case !dw:
      suffix = "edge_bot";
      break;
    case !lf:
      suffix = "edge_lft";
      break;
    case !rg:
      suffix = "edge_rgt";
      break;
    case !up_lf:
      suffix = "inner_top_lft";
      break;
    case !up_rg:
      suffix = "inner_top_rgt";
      break;
    case !dw_lf:
      suffix = "inner_bot_lft";
      break;
    case !dw_rg:
      suffix = "inner_bot_rgt";
      break;
  }
  return base + suffix;
}
function same_floor(grid, x, y, token) {
  const cell = grid_get(grid, x, y);
  if (!cell) {
    return false;
  }
  return cell.floor === token;
}
function top_left_of_block(grid, x, y, token) {
  let ox = x;
  let oy = y;
  while (ox > 0 && same_floor(grid, ox - 1, oy, token)) {
    ox -= 1;
  }
  while (oy > 0 && same_floor(grid, ox, oy - 1, token)) {
    oy -= 1;
  }
  return [ox, oy];
}
function floor_asset(grid, x, y, token_map2) {
  const cell = grid_get(grid, x, y);
  if (!cell) {
    return DEFAULT_FLOOR_ASSET;
  }
  const tok = cell.floor;
  if (tok === EMPTY_FLOOR) {
    return DEFAULT_FLOOR_ASSET;
  }
  const def = token_map2.get(tok);
  if (!def) {
    return "";
  }
  if (def.kind === "borded") {
    const up = same_floor(grid, x, y - 1, tok);
    const dw = same_floor(grid, x, y + 1, tok);
    const lf = same_floor(grid, x - 1, y, tok);
    const rg = same_floor(grid, x + 1, y, tok);
    const up_lf = same_floor(grid, x - 1, y - 1, tok);
    const up_rg = same_floor(grid, x + 1, y - 1, tok);
    const dw_lf = same_floor(grid, x - 1, y + 1, tok);
    const dw_rg = same_floor(grid, x + 1, y + 1, tok);
    const id = border_id(def.name, up, dw, lf, rg, up_lf, up_rg, dw_lf, dw_rg);
    return `${VIBIMON_ASSET_ROOT}/${id}.png`;
  }
  if (def.kind === "bigimg") {
    if (def.width > 1 || def.height > 1) {
      const [ox, oy] = top_left_of_block(grid, x, y, tok);
      const ix = (x - ox) % def.width;
      const iy = (y - oy) % def.height;
      return bigimg_asset(def, ix, iy);
    }
    return bigimg_asset(def, 0, 0);
  }
  if (def.kind === "none") {
    return DEFAULT_FLOOR_ASSET;
  }
  return "";
}
function entity_asset(grid, x, y, token_map2) {
  const cell = grid_get(grid, x, y);
  if (!cell) {
    return "";
  }
  let tok = cell.entity;
  if (tok === COLLIDER_ENTITY) {
    tok = typeof cell.entity_backup === "string" ? cell.entity_backup : EMPTY_ENTITY;
  }
  if (tok === EMPTY_ENTITY || tok === COLLIDER_ENTITY) {
    return "";
  }
  const def = token_map2.get(tok);
  if (!def || def.kind !== "entity" && def.kind !== "player" || !def.sprite) {
    return "";
  }
  return entity_sprite_asset(def.sprite);
}
function resolve_cell_visual(grid, x, y, token_map2) {
  const cell = grid_get(grid, x, y);
  if (!cell) {
    return {
      floor_asset: DEFAULT_FLOOR_ASSET,
      entity_asset: "",
      floor_glyph: EMPTY_FLOOR,
      entity_glyph: EMPTY_ENTITY
    };
  }
  return {
    floor_asset: floor_asset(grid, x, y, token_map2),
    entity_asset: entity_asset(grid, x, y, token_map2),
    floor_glyph: cell.floor,
    entity_glyph: cell.entity
  };
}

// src/visual-render.ts
var TILE_SIZE = 40;
var MIN_ZOOM = 0.5;
var MAX_ZOOM = 4;
function cell_key(x, y) {
  return `${x},${y}`;
}
function apply_image(img, src, missing_behavior) {
  if (!src) {
    img.style.display = "none";
    img.removeAttribute("src");
    return;
  }
  img.onerror = () => {
    if (missing_behavior === "fallback-floor" && img.dataset.fallbackApplied !== "1") {
      img.dataset.fallbackApplied = "1";
      img.src = DEFAULT_FLOOR_ASSET;
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
function apply_cell_visual(el, x, y, grid, token_map2) {
  const data = resolve_cell_visual(grid, x, y, token_map2);
  const floor_img = el.querySelector(".tile-floor-img");
  const ent_img = el.querySelector(".tile-entity-img");
  const collider_overlay = el.querySelector(".tile-collider-overlay");
  const floor_text = el.querySelector(".tile-floor-glyph");
  const ent_text = el.querySelector(".tile-entity-glyph");
  apply_image(floor_img, data.floor_asset, "fallback-floor");
  apply_image(ent_img, data.entity_asset, "hide");
  const has_collider = data.entity_glyph === COLLIDER_ENTITY;
  collider_overlay.style.display = has_collider ? "block" : "none";
  floor_text.textContent = data.floor_glyph;
  ent_text.textContent = has_collider ? "" : data.entity_glyph.trim();
  ent_text.style.display = !has_collider && data.entity_glyph.trim() ? "inline-block" : "none";
}
function create_cell(x, y) {
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
function sprite_id2(name, ix, iy) {
  const pad_x = String(ix).padStart(2, "0");
  const pad_y = String(iy).padStart(2, "0");
  return `${name}_${pad_x}_${pad_y}`;
}
function bigimg_asset2(token, ix, iy) {
  if (token.single) {
    return `${VIBIMON_ASSET_ROOT}/${token.name}.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite_id2(token.name, ix, iy)}.png`;
}
function entity_asset2(sprite) {
  if (sprite.startsWith("ent_")) {
    return `${VIBIMON_ASSET_ROOT}/${sprite}_front_stand.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite}.png`;
}
function create_visual_renderer(stage_el, grid_el, overlay_el) {
  const tile_dom = new Map;
  let selection_layer = null;
  let preview_layer = null;
  function ensure_overlay_layers() {
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
  function set_transform(viewport) {
    const tx = viewport.offset_x;
    const ty = viewport.offset_y;
    grid_el.style.transform = `translate(${tx}px, ${ty}px) scale(${viewport.zoom})`;
    overlay_el.style.transform = `translate(${tx}px, ${ty}px) scale(${viewport.zoom})`;
  }
  function rebuild_grid(grid, token_map2) {
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
    for (let y = 0;y < grid.height; y++) {
      for (let x = 0;x < grid.width; x++) {
        const el = create_cell(x, y);
        apply_cell_visual(el, x, y, grid, token_map2);
        grid_el.appendChild(el);
        tile_dom.set(cell_key(x, y), el);
      }
    }
  }
  function refresh_grid(grid, token_map2) {
    for (let y = 0;y < grid.height; y++) {
      for (let x = 0;x < grid.width; x++) {
        const key = cell_key(x, y);
        const el = tile_dom.get(key);
        if (!el) {
          continue;
        }
        apply_cell_visual(el, x, y, grid, token_map2);
      }
    }
  }
  function stage_rect() {
    return stage_el.getBoundingClientRect();
  }
  function hit_test(client_x, client_y) {
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
  function set_selection(rect) {
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
  function set_move_preview(rect, source_rect, invalid = false) {
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
      for (let dy = 0;dy < rect.h; dy++) {
        for (let dx = 0;dx < rect.w; dx++) {
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
          const source_floor = source.querySelector(".tile-floor-img");
          const source_entity = source.querySelector(".tile-entity-img");
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
  function set_paint_preview(rect, token, invalid = false) {
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
    for (let iy = 0;iy < rect.h; iy++) {
      for (let ix = 0;ix < rect.w; ix++) {
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
          apply_image(entity, entity_asset2(token.sprite), "hide");
          tile.appendChild(entity);
        } else if (token.kind === "bigimg") {
          const floor = document.createElement("img");
          floor.className = "move-preview-floor";
          floor.alt = "";
          apply_image(floor, token.width > 1 || token.height > 1 ? bigimg_asset2(token, ix, iy) : bigimg_asset2(token, 0, 0), "fallback-floor");
          tile.appendChild(floor);
        } else if (token.kind === "borded") {
          const floor = document.createElement("img");
          floor.className = "move-preview-floor";
          floor.alt = "";
          apply_image(floor, `${VIBIMON_ASSET_ROOT}/${token.name}_center.png`, "fallback-floor");
          tile.appendChild(floor);
        }
        preview.appendChild(tile);
      }
    }
    preview_layer.appendChild(preview);
  }
  function zoom_to_point(next_zoom, client_x, client_y) {
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

// src/main.ts
var raw_debounce_ms = 180;
var raw_font_min_px = 8;
var raw_font_max_px = 96;
var raw_font_default_px = 13;
var preview_tile_size = 12;
var preview_frame_width = 300;
var preview_frame_height = 144;
var date_formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});
var root = document.querySelector("#app");
if (!root) {
  throw new Error("App root not found.");
}
var refs = mount_app(root);
var visual = create_visual_renderer(refs.visual_stage, refs.visual_grid, refs.visual_overlay);
var state = create_initial_state();
var tokens = [];
var token_by_key = new Map;
var token_filter = "";
var raw_timer = null;
var is_space_down = false;
var highlighted_glyph_index = -1;
var filtered_tokens = [];
var level_search_query = "";
var load_selected_level_id = null;
var modal_error_text = "";
var status_flash_text = null;
var status_flash_timer = null;
var pointer_drag = null;
function in_rect(x, y, rect) {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}
function clamp_delta_for_rect(rect, dx, dy) {
  const min_dx = -rect.x;
  const min_dy = -rect.y;
  const max_dx = state.grid.width - (rect.x + rect.w);
  const max_dy = state.grid.height - (rect.y + rect.h);
  const ndx = Math.max(min_dx, Math.min(max_dx, dx));
  const ndy = Math.max(min_dy, Math.min(max_dy, dy));
  return [ndx, ndy];
}
function sprite_id3(name, ix, iy) {
  const pad_x = String(ix).padStart(2, "0");
  const pad_y = String(iy).padStart(2, "0");
  return `${name}_${pad_x}_${pad_y}`;
}
function bigimg_preview_asset(token) {
  if (token.single) {
    return `${VIBIMON_ASSET_ROOT}/${token.name}.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite_id3(token.name, 0, 0)}.png`;
}
function entity_preview_asset(sprite) {
  if (sprite.startsWith("ent_")) {
    return `${VIBIMON_ASSET_ROOT}/${sprite}_front_stand.png`;
  }
  return `${VIBIMON_ASSET_ROOT}/${sprite}.png`;
}
function preview_asset(token) {
  if (token.token === EMPTY_FLOOR) {
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
function refresh_status() {
  if (status_flash_text) {
    set_status_html(refs, `<span class="status-success">${escape_html(status_flash_text)}</span>`);
    return;
  }
  let level_html = `<span class="status-unsaved">(unsaved)</span>`;
  if (state.current_level_name) {
    level_html = state.is_dirty ? `${escape_html(state.current_level_name)} <span class="status-unsaved">(unsaved)</span>` : escape_html(state.current_level_name);
  }
  const segments = [
    `Level: ${level_html}`,
    `Mode: ${state.mode.toUpperCase()}`,
    `Sync: ${state.sync_view.enabled ? "ON" : "OFF"}`,
    `Tool: ${state.tool}`,
    `Grid: ${state.grid.width}x${state.grid.height}`
  ];
  const html = segments.map((segment, idx) => idx === 0 ? segment : escape_html(segment)).join(' <span class="status-sep">|</span> ');
  set_status_html(refs, html);
}
function flash_status(text, duration_ms = 2000) {
  status_flash_text = text;
  if (status_flash_timer !== null) {
    window.clearTimeout(status_flash_timer);
  }
  set_status_html(refs, `<span class="status-success">${escape_html(text)}</span>`);
  status_flash_timer = window.setTimeout(() => {
    status_flash_text = null;
    status_flash_timer = null;
    refresh_status();
  }, duration_ms);
}
function refresh_map_name() {
  set_map_name(refs, state.current_level_name);
}
function update_dirty_flag() {
  state.is_dirty = state.raw_text !== state.last_persisted_raw;
}
function escape_raw_for_typescript(raw) {
  return raw.replace(/\\/g, "\\\\");
}
function unescape_raw_from_typescript(raw) {
  return raw.replace(/\\\\/g, "\\");
}
function raw_for_textarea(raw) {
  if (!state.add_escape_char.enabled) {
    return raw;
  }
  return escape_raw_for_typescript(raw);
}
function raw_from_textarea(raw) {
  if (!state.add_escape_char.enabled) {
    return raw;
  }
  return unescape_raw_from_typescript(raw);
}
function sync_raw_textarea_with_state() {
  refs.raw_textarea.value = raw_for_textarea(state.raw_text);
}
function refresh_interaction_ui() {
  refs.visual_stage.dataset.tool = state.tool;
  const blocked = state.mode === "visual" && state.tool === "paint" && !state.selected_token;
  refs.visual_stage.classList.toggle("is-action-blocked", blocked);
  refs.visual_stage.classList.toggle("is-panning", is_space_down);
}
function clear_move_preview() {
  visual.set_move_preview(null);
}
function paint_preview_for_cell(cell) {
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
function rebuild_visual() {
  visual.rebuild_grid(state.grid, token_by_key);
  visual.set_transform(state.viewport);
  visual.set_selection(state.move_selection);
  clear_move_preview();
  visual.set_paint_preview(null);
}
function sync_grid_and_views() {
  visual.refresh_grid(state.grid, token_by_key);
  sync_raw_from_grid(state);
  update_dirty_flag();
  if (state.mode === "raw") {
    sync_raw_textarea_with_state();
  }
  set_raw_error(refs, state.raw_error);
  refresh_status();
}
function clamp_camera_to_grid(camera) {
  const max_x = Math.max(0, state.grid.width - 1);
  const max_y = Math.max(0, state.grid.height - 1);
  return {
    center_tile_x: Math.max(0, Math.min(max_x, camera.center_tile_x)),
    center_tile_y: Math.max(0, Math.min(max_y, camera.center_tile_y)),
    visual_zoom: camera.visual_zoom
  };
}
function capture_camera_from_visual() {
  const stage = visual.stage_rect();
  state.shared_camera = clamp_camera_to_grid(visual_to_camera(state.viewport, { width: stage.width, height: stage.height }));
}
function capture_camera_from_raw() {
  const metrics = measure_raw_metrics(refs.raw_textarea);
  state.raw_viewport = metrics;
  const viewport = read_raw_viewport_size(refs.raw_textarea);
  const visual_zoom = raw_font_px_to_visual_zoom(metrics.font_size_px, metrics);
  state.shared_camera = clamp_camera_to_grid(raw_scroll_to_camera(metrics, viewport, visual_zoom));
}
function apply_camera_to_visual() {
  const stage = visual.stage_rect();
  state.viewport = camera_to_visual(state.shared_camera, { width: stage.width, height: stage.height });
}
function raw_selection_range_for_tile(tile_x, tile_y) {
  if (tile_x < 0 || tile_y < 0) {
    return null;
  }
  const raw_lines = state.raw_text.split(`
`);
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
  for (let x = 0;x < target_tile; x++) {
    const token = line.slice(x * 4, x * 4 + 3);
    start_col += raw_for_textarea(token).length + 1;
  }
  const target_token = line.slice(target_tile * 4, target_tile * 4 + 3);
  const cell_width = raw_for_textarea(target_token).length + 1;
  let offset = 0;
  for (let i = 0;i < line_index; i++) {
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
function focus_raw_tile_from_camera() {
  const tile_x = Math.max(0, Math.min(state.grid.width - 1, Math.floor(state.shared_camera.center_tile_x)));
  const tile_y = Math.max(0, Math.min(state.grid.height - 1, Math.floor(state.shared_camera.center_tile_y)));
  const range = raw_selection_range_for_tile(tile_x, tile_y);
  if (!range) {
    return;
  }
  refs.raw_textarea.setSelectionRange(range.start, range.end);
}
function apply_camera_to_raw() {
  const base_metrics = measure_raw_metrics(refs.raw_textarea);
  const target_font = visual_zoom_to_raw_font_px(state.shared_camera.visual_zoom, base_metrics);
  const clamped_font = Math.max(raw_font_min_px, Math.min(raw_font_max_px, target_font));
  refs.raw_textarea.style.fontSize = `${clamped_font}px`;
  const next_metrics = measure_raw_metrics(refs.raw_textarea);
  const viewport = read_raw_viewport_size(refs.raw_textarea);
  const scroll = camera_to_raw_scroll(state.shared_camera, next_metrics, viewport);
  refs.raw_textarea.scrollLeft = scroll.left;
  refs.raw_textarea.scrollTop = scroll.top;
  state.raw_viewport = measure_raw_metrics(refs.raw_textarea);
  focus_raw_tile_from_camera();
}
function reset_raw_zoom_to_default() {
  refs.raw_textarea.style.fontSize = `${raw_font_default_px}px`;
  state.raw_viewport = measure_raw_metrics(refs.raw_textarea);
}
function escape_html(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function sorted_levels(levels) {
  if (state.level_sort_mode === "name") {
    return [...levels].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  return [...levels].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}
function set_modal_state(next) {
  state.modal_state = next;
  render_modal();
}
function close_modal() {
  modal_error_text = "";
  set_modal_state({ kind: "none" });
}
function open_save_modal(mode, error_text = "") {
  modal_error_text = error_text;
  set_modal_state({ kind: "save", mode });
}
function open_load_modal(reset_search = true) {
  if (reset_search) {
    level_search_query = "";
  }
  if (state.modal_state.kind !== "load") {
    load_selected_level_id = state.current_level_id;
  }
  modal_error_text = "";
  set_modal_state({ kind: "load" });
}
function set_saved_level_state(level) {
  state.current_level_id = level.id;
  state.current_level_name = level.name;
  state.last_persisted_raw = state.raw_text;
  update_dirty_flag();
  refresh_map_name();
  refresh_status();
}
function persist_level(name, id) {
  const parsed = parse_raw(state.raw_text);
  const width = parsed.ok ? parsed.grid.width : state.grid.width;
  const height = parsed.ok ? parsed.grid.height : state.grid.height;
  return save_level({
    id,
    name,
    raw_text: state.raw_text,
    grid_width: width,
    grid_height: height
  });
}
function save_current_level(name, mode) {
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
function quick_save_current_level() {
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
function request_save_action() {
  if (state.current_level_id) {
    quick_save_current_level();
    return;
  }
  open_save_modal("regular");
}
function request_save_as_action() {
  open_save_modal("save-as");
}
function find_level(level_id) {
  try {
    return get_level(level_id);
  } catch {
    return null;
  }
}
function apply_level_from_library(level_id) {
  const level = find_level(level_id);
  if (!level) {
    modal_error_text = "Level not found in local storage.";
    render_modal();
    return;
  }
  const parsed = parse_raw(level.raw_text);
  if (!parsed.ok) {
    modal_error_text = `Could not load this level: ${parsed.error}`;
    render_modal();
    return;
  }
  state.raw_text = level.raw_text;
  state.grid = parsed.grid;
  state.last_valid_grid = clone_grid(parsed.grid);
  state.raw_error = null;
  state.move_selection = null;
  sync_raw_textarea_with_state();
  set_raw_error(refs, null);
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
function request_level_load(level_id) {
  if (state.is_dirty && state.current_level_id !== level_id) {
    modal_error_text = "";
    set_modal_state({ kind: "confirm-discard", level_id });
    return;
  }
  apply_level_from_library(level_id);
}
function preview_img(src, fallback_to_floor) {
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
function create_level_preview(level) {
  const frame = document.createElement("div");
  frame.className = "level-preview-frame";
  const parsed = parse_raw(level.raw_text);
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
  for (let y = 0;y < grid.height; y++) {
    for (let x = 0;x < grid.width; x++) {
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
function level_meta(level) {
  const updated = Date.parse(level.updated_at);
  const when = Number.isFinite(updated) ? date_formatter.format(new Date(updated)) : level.updated_at;
  return `${level.grid_width}x${level.grid_height} • ${when}`;
}
function get_load_cards() {
  if (state.modal_state.kind !== "load") {
    return [];
  }
  return Array.from(refs.modal_body.querySelectorAll(".level-card[data-level-id]"));
}
function refresh_load_selection_ui(scroll = false) {
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
function ensure_load_selection(levels) {
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
function create_level_card(level) {
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
    const target = ev.target;
    if (target?.closest(".modal-btn")) {
      return;
    }
    load_selected_level_id = level.id;
    refresh_load_selection_ui();
  });
  return card;
}
function render_save_modal() {
  if (state.modal_state.kind !== "save") {
    return;
  }
  const save_mode = state.modal_state.mode;
  const is_save_as = save_mode === "save-as";
  set_modal_title(refs, is_save_as ? "Save As New" : "Save Level");
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
  const form = refs.modal_body.querySelector("#save-form");
  const name_input = refs.modal_body.querySelector("#save-level-name");
  const help_el = refs.modal_body.querySelector("#save-help");
  const cancel_btn = refs.modal_body.querySelector("#save-cancel");
  const existing_list = refs.modal_body.querySelector("#save-existing-list");
  const base_help = is_save_as ? "Save As creates a new local level, keeping the current one." : "Save will update the current level when it already exists.";
  let help_text = modal_error_text || base_help;
  let help_is_error = !!modal_error_text;
  let existing_levels = [];
  try {
    existing_levels = sorted_levels(list_levels());
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
  let selected_existing_id = state.current_level_id;
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
function render_load_modal() {
  set_modal_title(refs, "Load Level");
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
  const search = refs.modal_body.querySelector("#library-search");
  const sort_recent2 = refs.modal_body.querySelector("#sort-recent");
  const sort_name = refs.modal_body.querySelector("#sort-name");
  const error_el = refs.modal_body.querySelector("#load-error");
  const grid = refs.modal_body.querySelector("#level-grid");
  search.value = level_search_query;
  error_el.textContent = modal_error_text;
  sort_recent2.classList.toggle("active", state.level_sort_mode === "recent");
  sort_name.classList.toggle("active", state.level_sort_mode === "name");
  let levels = [];
  try {
    levels = search_levels(level_search_query);
  } catch (err) {
    error_el.textContent = `Storage error: ${String(err)}`;
  }
  levels = sorted_levels(levels);
  ensure_load_selection(levels);
  grid.innerHTML = "";
  if (levels.length === 0) {
    const empty = document.createElement("div");
    empty.className = "level-empty";
    empty.textContent = level_search_query ? "No saved levels match this search." : "No saved levels yet.";
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
  sort_recent2.addEventListener("click", () => {
    state.level_sort_mode = "recent";
    render_load_modal();
  });
  sort_name.addEventListener("click", () => {
    state.level_sort_mode = "name";
    render_load_modal();
  });
}
function toggle_load_sort(direction) {
  const order = ["recent", "name"];
  const current_index = order.indexOf(state.level_sort_mode);
  const delta = direction === "forward" ? 1 : -1;
  const next_index = (current_index + delta + order.length) % order.length;
  state.level_sort_mode = order[next_index];
  render_load_modal();
}
function load_search_is_focused() {
  if (state.modal_state.kind !== "load") {
    return false;
  }
  const search = refs.modal_body.querySelector("#library-search");
  return document.activeElement === search;
}
function move_load_selection(direction) {
  if (state.modal_state.kind !== "load") {
    return;
  }
  const cards = get_load_cards();
  if (cards.length === 0) {
    load_selected_level_id = null;
    return;
  }
  const rows = [];
  const row_tops = [];
  const tolerance_px = 4;
  for (const card of cards) {
    const id = card.dataset.levelId;
    if (!id)
      continue;
    const top = card.offsetTop;
    const left = card.offsetLeft;
    let row_index = -1;
    for (let i = 0;i < row_tops.length; i++) {
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
    for (let r = 0;r < rows.length; r++) {
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
    const target_row_index = direction === "up" ? Math.max(0, current_row_index - 1) : Math.min(rows.length - 1, current_row_index + 1);
    const current_left = rows[current_row_index][current_col_index].left;
    let best_col_index = 0;
    let best_distance = Number.POSITIVE_INFINITY;
    for (let i = 0;i < rows[target_row_index].length; i++) {
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
function activate_selected_load_level() {
  if (state.modal_state.kind !== "load" || !load_selected_level_id) {
    return;
  }
  request_level_load(load_selected_level_id);
}
function render_rename_modal(level_id) {
  const level = find_level(level_id);
  if (!level) {
    modal_error_text = "Level no longer exists.";
    set_modal_state({ kind: "load" });
    return;
  }
  set_modal_title(refs, "Rename Level");
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
  const form = refs.modal_body.querySelector("#rename-form");
  const name_input = refs.modal_body.querySelector("#rename-level-name");
  const error_el = refs.modal_body.querySelector("#rename-error");
  const cancel_btn = refs.modal_body.querySelector("#rename-cancel");
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
      const renamed = rename_level(level.id, name_input.value);
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
function render_confirm_discard_modal(level_id) {
  const level = find_level(level_id);
  const target_name = level ? level.name : "this level";
  set_modal_title(refs, "Discard Unsaved Changes?");
  refs.modal_body.innerHTML = `
    <p class="confirm-copy">
      You have unsaved changes. Loading <strong>${escape_html(target_name)}</strong> will replace the current level.
    </p>
    <div class="modal-actions">
      <button id="discard-cancel" class="modal-btn" type="button">Cancel</button>
      <button id="discard-confirm" class="modal-btn danger" type="button">Load Anyway</button>
    </div>
  `;
  const cancel_btn = refs.modal_body.querySelector("#discard-cancel");
  const confirm_btn = refs.modal_body.querySelector("#discard-confirm");
  cancel_btn.addEventListener("click", () => set_modal_state({ kind: "load" }));
  confirm_btn.addEventListener("click", () => apply_level_from_library(level_id));
}
function render_confirm_delete_modal(level_id) {
  const level = find_level(level_id);
  const target_name = level ? level.name : "this level";
  set_modal_title(refs, "Delete Level?");
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
  const cancel_btn = refs.modal_body.querySelector("#delete-cancel");
  const confirm_btn = refs.modal_body.querySelector("#delete-confirm");
  cancel_btn.addEventListener("click", () => set_modal_state({ kind: "load" }));
  confirm_btn.addEventListener("click", () => {
    try {
      const deleted = delete_level(level_id);
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
function render_modal() {
  const kind = state.modal_state.kind;
  if (kind === "none") {
    set_modal_open(refs, false);
    set_modal_close_visible(refs, true);
    refs.modal_body.innerHTML = "";
    refs.modal_title.textContent = "";
    refs.modal_window.className = "modal-window";
    return;
  }
  set_modal_open(refs, true);
  const hide_close = kind === "save";
  set_modal_close_visible(refs, !hide_close);
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
function set_sync_view_enabled(enabled) {
  state.sync_view.enabled = enabled;
  set_sync_view_ui(refs, enabled);
  if (!enabled) {
    reset_raw_zoom_to_default();
  }
  refresh_status();
}
function toggle_sync_view() {
  set_sync_view_enabled(!state.sync_view.enabled);
}
function set_add_escape_char_enabled(enabled) {
  if (state.add_escape_char.enabled === enabled) {
    set_add_escape_char_ui(refs, enabled);
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
  set_add_escape_char_ui(refs, enabled);
  if (state.mode === "raw") {
    sync_grid_from_raw(state, canonical_raw);
    set_raw_error(refs, state.raw_error);
    if (!state.raw_error) {
      rebuild_visual();
    }
    sync_raw_textarea_with_state();
    const max = refs.raw_textarea.value.length;
    refs.raw_textarea.setSelectionRange(Math.max(0, Math.min(max, selection_start)), Math.max(0, Math.min(max, selection_end)));
    refs.raw_textarea.focus();
  }
  update_dirty_flag();
  refresh_status();
}
function modal_is_open() {
  return state.modal_state.kind !== "none";
}
function is_text_entry_target(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
function set_mode(mode) {
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
  set_mode_ui(refs, mode);
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
function set_tool(tool) {
  state.tool = tool;
  set_tool_ui(refs, tool);
  clear_move_preview();
  visual.set_paint_preview(null);
  if (tool !== "move") {
    state.move_selection = null;
    visual.set_selection(null);
  }
  refresh_interaction_ui();
  refresh_status();
}
function select_token(token) {
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
function get_sprite_buttons() {
  const buttons = [];
  for (const child of refs.sprite_list.children) {
    if (child instanceof HTMLButtonElement) {
      buttons.push(child);
    }
  }
  return buttons;
}
function update_highlighted_ui() {
  const buttons = get_sprite_buttons();
  for (let i = 0;i < buttons.length; i++) {
    buttons[i].classList.toggle("highlighted", i === highlighted_glyph_index);
  }
  if (highlighted_glyph_index >= 0 && highlighted_glyph_index < buttons.length) {
    buttons[highlighted_glyph_index].scrollIntoView({ block: "nearest" });
  }
}
function navigate_glyphs(direction) {
  const buttons = get_sprite_buttons();
  if (buttons.length === 0)
    return;
  if (direction === "down") {
    highlighted_glyph_index = Math.min(highlighted_glyph_index + 1, buttons.length - 1);
  } else {
    highlighted_glyph_index = Math.max(highlighted_glyph_index - 1, 0);
  }
  update_highlighted_ui();
}
function select_highlighted_glyph() {
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
function dismiss_search() {
  refs.sprite_search.value = "";
  token_filter = "";
  refs.sprite_search.blur();
  highlighted_glyph_index = -1;
  render_token_list();
  set_tool("move");
}
function render_token_list() {
  refs.sprite_list.innerHTML = "";
  highlighted_glyph_index = -1;
  const q = token_filter.trim().toLowerCase();
  filtered_tokens = tokens.filter((entry) => {
    if (!q) {
      return true;
    }
    return entry.token.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q) || entry.label.toLowerCase().includes(q) || entry.kind.toLowerCase().includes(q);
  });
  let last_kind = null;
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
function cell_from_event(ev) {
  const cell = visual.hit_test(ev.clientX, ev.clientY);
  if (!cell) {
    return null;
  }
  if (cell.x < 0 || cell.y < 0 || cell.x >= state.grid.width || cell.y >= state.grid.height) {
    return null;
  }
  return cell;
}
function on_visual_pointer_down(ev) {
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
    const rect = normalize_rect(cell.x, cell.y, cell.x, cell.y);
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
    const rect = normalize_rect(cell.x, cell.y, cell.x, cell.y);
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
    const rect = normalize_rect(cell.x, cell.y, cell.x, cell.y);
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
  const source = grid_get(state.grid, cell.x, cell.y);
  if (source && !is_empty_cell(source)) {
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
  visual.set_selection(normalize_rect(cell.x, cell.y, cell.x, cell.y));
}
function on_visual_pointer_move(ev) {
  const cell = cell_from_event(ev);
  if (!pointer_drag) {
    paint_preview_for_cell(cell);
    return;
  }
  if (pointer_drag.kind === "pan") {
    const dx2 = ev.clientX - pointer_drag.start_x;
    const dy2 = ev.clientY - pointer_drag.start_y;
    state.viewport.offset_x = pointer_drag.base_offset_x + dx2;
    state.viewport.offset_y = pointer_drag.base_offset_y + dy2;
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
    const rect2 = normalize_rect(pointer_drag.start_x, pointer_drag.start_y, pointer_drag.end_x, pointer_drag.end_y);
    visual.set_selection(rect2);
    clear_move_preview();
    paint_preview_for_cell(null);
    return;
  }
  if (pointer_drag.kind === "collider_rect") {
    pointer_drag.end_x = cell.x;
    pointer_drag.end_y = cell.y;
    const rect2 = normalize_rect(pointer_drag.start_x, pointer_drag.start_y, pointer_drag.end_x, pointer_drag.end_y);
    visual.set_selection(rect2);
    clear_move_preview();
    visual.set_paint_preview(null);
    return;
  }
  if (pointer_drag.kind === "rubber_rect") {
    pointer_drag.end_x = cell.x;
    pointer_drag.end_y = cell.y;
    const rect2 = normalize_rect(pointer_drag.start_x, pointer_drag.start_y, pointer_drag.end_x, pointer_drag.end_y);
    visual.set_selection(rect2);
    clear_move_preview();
    visual.set_paint_preview(null);
    return;
  }
  if (pointer_drag.kind === "move_single") {
    pointer_drag.to_x = cell.x;
    pointer_drag.to_y = cell.y;
    const rect2 = { x: cell.x, y: cell.y, w: 1, h: 1 };
    visual.set_selection(rect2);
    visual.set_move_preview(rect2, {
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
    visual.set_selection(normalize_rect(pointer_drag.start_x, pointer_drag.start_y, pointer_drag.end_x, pointer_drag.end_y));
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
function on_visual_pointer_up(ev) {
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
      const rect = normalize_rect(pointer_drag.start_x, pointer_drag.start_y, pointer_drag.end_x, pointer_drag.end_y);
      apply_paint_rect(state.grid, rect, token);
      sync_grid_and_views();
    }
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    return;
  }
  if (pointer_drag.kind === "collider_rect") {
    const rect = normalize_rect(pointer_drag.start_x, pointer_drag.start_y, pointer_drag.end_x, pointer_drag.end_y);
    apply_collider_rect(state.grid, rect);
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    sync_grid_and_views();
    return;
  }
  if (pointer_drag.kind === "rubber_rect") {
    const rect = normalize_rect(pointer_drag.start_x, pointer_drag.start_y, pointer_drag.end_x, pointer_drag.end_y);
    apply_erase_rect(state.grid, rect);
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    sync_grid_and_views();
    return;
  }
  if (pointer_drag.kind === "move_single") {
    move_single_cell(state.grid, pointer_drag.from_x, pointer_drag.from_y, pointer_drag.to_x, pointer_drag.to_y);
    state.move_selection = null;
    visual.set_selection(null);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    sync_grid_and_views();
    return;
  }
  if (pointer_drag.kind === "move_select") {
    const rect = normalize_rect(pointer_drag.start_x, pointer_drag.start_y, pointer_drag.end_x, pointer_drag.end_y);
    state.move_selection = rect;
    visual.set_selection(rect);
    pointer_drag = null;
    clear_move_preview();
    visual.set_paint_preview(null);
    refresh_status();
    return;
  }
  const [dx, dy] = clamp_delta_for_rect(pointer_drag.origin, pointer_drag.delta_x, pointer_drag.delta_y);
  move_rect(state.grid, pointer_drag.origin, dx, dy);
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
function bind_events() {
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
      sync_grid_from_raw(state, canonical_raw);
      set_raw_error(refs, state.raw_error);
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
    const metrics = measure_raw_metrics(refs.raw_textarea);
    const factor = ev.deltaY < 0 ? 1.1 : 0.9;
    const next_font = Math.max(raw_font_min_px, Math.min(raw_font_max_px, metrics.font_size_px * factor));
    refs.raw_textarea.style.fontSize = `${next_font}px`;
    state.raw_viewport = measure_raw_metrics(refs.raw_textarea);
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
  bind_shortcuts({
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
async function init_tokens() {
  try {
    tokens = await load_glyph_catalog();
    token_by_key = token_map(tokens);
  } catch (err) {
    tokens = [];
    token_by_key = new Map;
    set_status(refs, `Failed to load glyph catalog: ${String(err)}`);
  }
  render_token_list();
  const preferred = tokens.find((entry) => entry.token === EMPTY_FLOOR);
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
function bootstrap() {
  sync_raw_textarea_with_state();
  set_mode_ui(refs, state.mode);
  set_sync_view_ui(refs, state.sync_view.enabled);
  set_add_escape_char_ui(refs, state.add_escape_char.enabled);
  set_tool_ui(refs, state.tool);
  set_modal_open(refs, false);
  set_modal_close_visible(refs, true);
  refresh_map_name();
  set_raw_error(refs, null);
  rebuild_visual();
  bind_events();
  refresh_interaction_ui();
  refresh_status();
  init_tokens();
}
bootstrap();
