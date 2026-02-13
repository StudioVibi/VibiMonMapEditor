// src/dom.ts
function mount_app(root) {
  root.innerHTML = `
    <div class="editor-shell">
      <header class="topbar">
        <div class="topbar-col">
          <div class="project-title">Vibi Level Editor</div>
        </div>
        <div class="topbar-col topbar-col-main">
          <div class="map-name">MapNamePlaceholder</div>
        </div>
        <div class="mode-toggle" role="tablist" aria-label="Render mode">
          <button id="mode-raw" class="mode-btn" type="button">RAW</button>
          <button id="mode-visual" class="mode-btn active" type="button">VISUAL</button>
        </div>
      </header>
      <main class="main-layout">
        <aside class="sidebar">
          <section class="tool-section">
            <h2>Select/Move</h2>
            <button id="tool-move" class="tool-btn icon-only active" type="button" aria-label="Move tool" title="Move">
              <img src="/assets/move.svg" alt="" />
            </button>
          </section>
          <section class="tool-section">
            <h2>Sprites</h2>
            <div class="tool-row">
              <button id="tool-paint" class="tool-btn icon-only" type="button" aria-label="Paint tool" title="Paint">
                <img src="/assets/paint.svg" alt="" />
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
              <span>Pan: Space+Drag | Zoom: Ctrl/Cmd+Wheel | Reset: 0</span>
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
    </div>
  `;
  return {
    app: root,
    mode_raw_btn: root.querySelector("#mode-raw"),
    mode_visual_btn: root.querySelector("#mode-visual"),
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
    status_text: root.querySelector("#status-text")
  };
}
function set_mode_ui(refs, mode) {
  refs.mode_raw_btn.classList.toggle("active", mode === "raw");
  refs.mode_visual_btn.classList.toggle("active", mode === "visual");
  refs.raw_panel.classList.toggle("active", mode === "raw");
  refs.visual_panel.classList.toggle("active", mode === "visual");
}
function set_tool_ui(refs, tool) {
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

// src/glyph-catalog.ts
function label_from_name(name) {
  return name.replace(/^tile_/, "").replace(/^ent_/, "").replace(/^icon_/, "").replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}
function parse_bool(block, key) {
  const re = new RegExp(`${key}:\\s*(true|false)`);
  const m = block.match(re);
  if (!m) {
    return false;
  }
  return m[1] === "true";
}
function parse_num(block, key, fallback) {
  const re = new RegExp(`${key}:\\s*(\\d+)`);
  const m = block.match(re);
  if (!m) {
    return fallback;
  }
  return Number(m[1]);
}
function parse_str(block, key) {
  const re = new RegExp(`${key}:\\s*"([^"]+)"`);
  const m = block.match(re);
  if (!m) {
    return null;
  }
  return m[1];
}
function parse_glyph_entries(source) {
  const out = [];
  const token_re = /"([^"]{2})"\s*:\s*\{([\s\S]*?)\n\s*\},?/g;
  let m = token_re.exec(source);
  while (m) {
    const token = m[1];
    const block = m[2];
    const kind = parse_str(block, "kind");
    const name = parse_str(block, "name") || token;
    const width = parse_num(block, "width", 1);
    const height = parse_num(block, "height", 1);
    const wall = parse_bool(block, "wall");
    const sprite = parse_str(block, "sprite");
    if (kind) {
      out.push({
        token,
        kind,
        name,
        width,
        height,
        wall,
        sprite,
        label: label_from_name(name)
      });
    }
    m = token_re.exec(source);
  }
  out.push({
    token: "::",
    kind: "building",
    name: "tile_grass_00_00",
    width: 1,
    height: 1,
    wall: false,
    sprite: null,
    label: "Grass"
  });
  out.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind.localeCompare(b.kind);
    }
    return a.token.localeCompare(b.token);
  });
  return out;
}
async function load_glyph_catalog() {
  const res = await fetch("VibiMon/src/data/Glyph.ts");
  if (!res.ok) {
    throw new Error("Could not load Glyph.ts.");
  }
  const source = await res.text();
  return parse_glyph_entries(source);
}
function token_map(tokens) {
  const map = new Map;
  for (const tok of tokens) {
    map.set(tok.token, tok);
  }
  return map;
}

// src/raw-format.ts
var EMPTY_FLOOR = "::";
var EMPTY_ENTITY = "  ";
function parse_line(line) {
  let text = line;
  if (text.length % 4 === 3) {
    text += " ";
  }
  const row = [];
  for (let i = 0;i < text.length; i += 4) {
    const cell = text.slice(i, i + 4);
    row.push(cell.slice(1, 3));
  }
  return row;
}
function ensure_glyph_2(token) {
  if (token.length === 2) {
    return token;
  }
  if (token.length < 2) {
    return token.padEnd(2, " ");
  }
  return token.slice(0, 2);
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
      entity_line += ` ${ensure_glyph_2(cell.entity)} `;
      floor_line += ` ${ensure_glyph_2(cell.floor)} `;
    }
    lines.push(entity_line);
    lines.push(floor_line);
  }
  return lines.join(`
`);
}
function parse_raw(text) {
  const lines = text.split(`
`);
  if (lines.length === 0) {
    return { ok: false, error: "RAW is empty." };
  }
  if (lines.length % 2 !== 0) {
    return { ok: false, error: "RAW must have an even number of lines." };
  }
  const entity_rows = [];
  const floor_rows = [];
  for (let i = 0;i < lines.length; i += 2) {
    const entity_row = parse_line(lines[i]);
    const floor_row = parse_line(lines[i + 1]);
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
        entity: ensure_glyph_2(entity_rows[y][x]),
        floor: ensure_glyph_2(floor_rows[y][x])
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

// src/state.ts
function create_initial_state() {
  const grid = make_empty_grid(20, 20);
  return {
    grid,
    mode: "visual",
    tool: "move",
    selected_token_key: null,
    selected_token: null,
    viewport: {
      zoom: 1,
      offset_x: 0,
      offset_y: 0
    },
    raw_text: serialize_raw(grid),
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
  grid.cells[y][x] = {
    floor: cell.floor.padEnd(2, " ").slice(0, 2),
    entity: cell.entity.padEnd(2, " ").slice(0, 2)
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
  if (token.kind === "building" && (token.width > 1 || token.height > 1)) {
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
  if (token.kind === "entity") {
    next.entity = token.token;
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
    entity: EMPTY_ENTITY
  });
}
function apply_erase_rect(grid, rect) {
  for (let y = rect.y;y < rect.y + rect.h; y++) {
    for (let x = rect.x;x < rect.x + rect.w; x++) {
      apply_erase_at(grid, x, y);
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
          entity: EMPTY_ENTITY
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
function sprite_id(name, ix, iy) {
  const pad_x = String(ix).padStart(2, "0");
  const pad_y = String(iy).padStart(2, "0");
  return `${name}_${pad_x}_${pad_y}`;
}
function building_asset(name, ix, iy) {
  if (name.startsWith("icon_") || name === "tile_mountain_door") {
    return `VibiMon/assets/${name}.png`;
  }
  return `VibiMon/assets/${sprite_id(name, ix, iy)}.png`;
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
    return "VibiMon/assets/tile_grass_00_00.png";
  }
  const tok = cell.floor;
  if (tok === EMPTY_FLOOR) {
    return "VibiMon/assets/tile_grass_00_00.png";
  }
  const def = token_map2.get(tok);
  if (!def) {
    return "";
  }
  if (def.kind === "bordered") {
    const up = same_floor(grid, x, y - 1, tok);
    const dw = same_floor(grid, x, y + 1, tok);
    const lf = same_floor(grid, x - 1, y, tok);
    const rg = same_floor(grid, x + 1, y, tok);
    const up_lf = same_floor(grid, x - 1, y - 1, tok);
    const up_rg = same_floor(grid, x + 1, y - 1, tok);
    const dw_lf = same_floor(grid, x - 1, y + 1, tok);
    const dw_rg = same_floor(grid, x + 1, y + 1, tok);
    const id = border_id(def.name, up, dw, lf, rg, up_lf, up_rg, dw_lf, dw_rg);
    return `VibiMon/assets/${id}.png`;
  }
  if (def.kind === "building") {
    if (def.width > 1 || def.height > 1) {
      const [ox, oy] = top_left_of_block(grid, x, y, tok);
      const ix = (x - ox) % def.width;
      const iy = (y - oy) % def.height;
      return building_asset(def.name, ix, iy);
    }
    return building_asset(def.name, 0, 0);
  }
  if (def.kind === "marker") {
    return "VibiMon/assets/tile_grass_00_00.png";
  }
  return "";
}
function entity_asset(grid, x, y, token_map2) {
  const cell = grid_get(grid, x, y);
  if (!cell) {
    return "";
  }
  const tok = cell.entity;
  if (tok === EMPTY_ENTITY) {
    return "";
  }
  const def = token_map2.get(tok);
  if (!def || def.kind !== "entity" || !def.sprite) {
    return "";
  }
  return `VibiMon/assets/${def.sprite}_front_stand.png`;
}
function resolve_cell_visual(grid, x, y, token_map2) {
  const cell = grid_get(grid, x, y);
  if (!cell) {
    return {
      floor_asset: "VibiMon/assets/tile_grass_00_00.png",
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
function apply_image(img, src) {
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
function apply_cell_visual(el, x, y, grid, token_map2) {
  const data = resolve_cell_visual(grid, x, y, token_map2);
  const floor_img = el.querySelector(".tile-floor-img");
  const ent_img = el.querySelector(".tile-entity-img");
  const floor_text = el.querySelector(".tile-floor-glyph");
  const ent_text = el.querySelector(".tile-entity-glyph");
  apply_image(floor_img, data.floor_asset);
  apply_image(ent_img, data.entity_asset);
  floor_text.textContent = data.floor_glyph;
  ent_text.textContent = data.entity_glyph.trim();
  ent_text.style.display = data.entity_glyph.trim() ? "inline-block" : "none";
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
function sprite_id2(name, ix, iy) {
  const pad_x = String(ix).padStart(2, "0");
  const pad_y = String(iy).padStart(2, "0");
  return `${name}_${pad_x}_${pad_y}`;
}
function building_asset2(name, ix, iy) {
  if (name.startsWith("icon_") || name === "tile_mountain_door") {
    return `VibiMon/assets/${name}.png`;
  }
  return `VibiMon/assets/${sprite_id2(name, ix, iy)}.png`;
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
        if (token.kind === "entity" && token.sprite) {
          const entity = document.createElement("img");
          entity.className = "move-preview-entity";
          entity.alt = "";
          entity.src = `VibiMon/assets/${token.sprite}_front_stand.png`;
          tile.appendChild(entity);
        } else if (token.kind === "building") {
          const floor = document.createElement("img");
          floor.className = "move-preview-floor";
          floor.alt = "";
          floor.src = token.width > 1 || token.height > 1 ? building_asset2(token.name, ix, iy) : building_asset2(token.name, 0, 0);
          tile.appendChild(floor);
        } else if (token.kind === "bordered") {
          const floor = document.createElement("img");
          floor.className = "move-preview-floor";
          floor.alt = "";
          floor.src = `VibiMon/assets/${token.name}_center.png`;
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
function building_preview_asset(name) {
  if (name.startsWith("icon_") || name === "tile_mountain_door") {
    return `VibiMon/assets/${name}.png`;
  }
  return `VibiMon/assets/${sprite_id3(name, 0, 0)}.png`;
}
function preview_asset(token) {
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
    return building_preview_asset(token.name);
  }
  return "VibiMon/assets/tile_grass_00_00.png";
}
function refresh_status() {
  const picked = state.selected_token ? `${state.selected_token.token} ${state.selected_token.name}` : "none";
  const text = [
    `Mode: ${state.mode.toUpperCase()}`,
    `Tool: ${state.tool}`,
    `Grid: ${state.grid.width}x${state.grid.height}`,
    `Glyph: ${picked}`
  ].join(" | ");
  set_status(refs, text);
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
  if (state.mode === "raw") {
    refs.raw_textarea.value = state.raw_text;
  }
  set_raw_error(refs, state.raw_error);
  refresh_status();
}
function set_mode(mode) {
  state.mode = mode;
  set_mode_ui(refs, mode);
  clear_move_preview();
  visual.set_paint_preview(null);
  if (mode === "raw") {
    refs.raw_textarea.value = state.raw_text;
    refs.raw_textarea.focus();
  } else {
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
function render_token_list() {
  refs.sprite_list.innerHTML = "";
  const q = token_filter.trim().toLowerCase();
  const filtered = tokens.filter((entry) => {
    if (!q) {
      return true;
    }
    return entry.token.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q) || entry.label.toLowerCase().includes(q) || entry.kind.toLowerCase().includes(q);
  });
  let last_kind = null;
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
      sync_grid_from_raw(state, val);
      set_raw_error(refs, state.raw_error);
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
  const preferred = tokens.find((entry) => entry.token === "TT");
  if (preferred) {
    select_token(preferred);
  } else if (tokens.length > 0) {
    select_token(tokens[0]);
  }
  rebuild_visual();
  refresh_interaction_ui();
}
function bootstrap() {
  refs.raw_textarea.value = state.raw_text;
  set_mode_ui(refs, state.mode);
  set_tool_ui(refs, state.tool);
  set_raw_error(refs, null);
  rebuild_visual();
  bind_events();
  refresh_interaction_ui();
  refresh_status();
  init_tokens();
}
bootstrap();
