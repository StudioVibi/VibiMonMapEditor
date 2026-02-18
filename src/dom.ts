import type * as T from "./types";

export interface DomRefs {
  app: HTMLDivElement;
  action_save_btn: HTMLButtonElement;
  action_save_as_btn: HTMLButtonElement;
  action_load_btn: HTMLButtonElement;
  map_name: HTMLDivElement;
  mode_raw_btn: HTMLButtonElement;
  mode_visual_btn: HTMLButtonElement;
  sync_view_toggle: HTMLInputElement;
  add_escape_char_toggle: HTMLInputElement;
  tool_move_btn: HTMLButtonElement;
  tool_paint_btn: HTMLButtonElement;
  tool_rubber_btn: HTMLButtonElement;
  raw_panel: HTMLDivElement;
  raw_textarea: HTMLTextAreaElement;
  raw_error: HTMLDivElement;
  visual_panel: HTMLDivElement;
  visual_stage: HTMLDivElement;
  visual_grid: HTMLDivElement;
  visual_overlay: HTMLDivElement;
  paint_panel: HTMLDivElement;
  sprite_search: HTMLInputElement;
  sprite_list: HTMLDivElement;
  sprite_meta: HTMLDivElement;
  status_text: HTMLDivElement;
  modal_root: HTMLDivElement;
  modal_backdrop: HTMLDivElement;
  modal_window: HTMLDivElement;
  modal_title: HTMLHeadingElement;
  modal_body: HTMLDivElement;
  modal_close_btn: HTMLButtonElement;
}

export function mount_app(root: HTMLElement): DomRefs {
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
    app: root as HTMLDivElement,
    action_save_btn: root.querySelector("#action-save") as HTMLButtonElement,
    action_save_as_btn: root.querySelector("#action-save-as") as HTMLButtonElement,
    action_load_btn: root.querySelector("#action-load") as HTMLButtonElement,
    map_name: root.querySelector("#map-name") as HTMLDivElement,
    mode_raw_btn: root.querySelector("#mode-raw") as HTMLButtonElement,
    mode_visual_btn: root.querySelector("#mode-visual") as HTMLButtonElement,
    sync_view_toggle: root.querySelector("#sync-view") as HTMLInputElement,
    add_escape_char_toggle: root.querySelector("#add-escape-char") as HTMLInputElement,
    tool_move_btn: root.querySelector("#tool-move") as HTMLButtonElement,
    tool_paint_btn: root.querySelector("#tool-paint") as HTMLButtonElement,
    tool_rubber_btn: root.querySelector("#tool-rubber") as HTMLButtonElement,
    raw_panel: root.querySelector("#raw-panel") as HTMLDivElement,
    raw_textarea: root.querySelector("#raw-text") as HTMLTextAreaElement,
    raw_error: root.querySelector("#raw-error") as HTMLDivElement,
    visual_panel: root.querySelector("#visual-panel") as HTMLDivElement,
    visual_stage: root.querySelector("#visual-stage") as HTMLDivElement,
    visual_grid: root.querySelector("#visual-grid") as HTMLDivElement,
    visual_overlay: root.querySelector("#visual-overlay") as HTMLDivElement,
    paint_panel: root.querySelector("#paint-panel") as HTMLDivElement,
    sprite_search: root.querySelector("#sprite-search") as HTMLInputElement,
    sprite_list: root.querySelector("#sprite-list") as HTMLDivElement,
    sprite_meta: root.querySelector("#sprite-meta") as HTMLDivElement,
    status_text: root.querySelector("#status-text") as HTMLDivElement,
    modal_root: root.querySelector("#modal-root") as HTMLDivElement,
    modal_backdrop: root.querySelector("#modal-backdrop") as HTMLDivElement,
    modal_window: root.querySelector("#modal-window") as HTMLDivElement,
    modal_title: root.querySelector("#modal-title") as HTMLHeadingElement,
    modal_body: root.querySelector("#modal-body") as HTMLDivElement,
    modal_close_btn: root.querySelector("#modal-close") as HTMLButtonElement
  };
}

export function set_mode_ui(refs: DomRefs, mode: T.ViewMode): void {
  refs.mode_raw_btn.classList.toggle("active", mode === "raw");
  refs.mode_visual_btn.classList.toggle("active", mode === "visual");
  refs.raw_panel.classList.toggle("active", mode === "raw");
  refs.visual_panel.classList.toggle("active", mode === "visual");
}

export function set_sync_view_ui(refs: DomRefs, enabled: boolean): void {
  refs.sync_view_toggle.checked = enabled;
}

export function set_add_escape_char_ui(refs: DomRefs, enabled: boolean): void {
  refs.add_escape_char_toggle.checked = enabled;
}

export function set_map_name(refs: DomRefs, name: string | null): void {
  refs.map_name.textContent = name || "";
}

export function set_modal_open(refs: DomRefs, open: boolean): void {
  refs.modal_root.classList.toggle("open", open);
  refs.modal_root.setAttribute("aria-hidden", open ? "false" : "true");
}

export function set_modal_title(refs: DomRefs, title: string): void {
  refs.modal_title.textContent = title;
}

export function set_modal_close_visible(refs: DomRefs, visible: boolean): void {
  refs.modal_close_btn.hidden = !visible;
}

export function set_tool_ui(refs: DomRefs, tool: T.Tool): void {
  refs.tool_move_btn.classList.toggle("active", tool === "move");
  refs.tool_paint_btn.classList.toggle("active", tool === "paint");
  refs.tool_rubber_btn.classList.toggle("active", tool === "rubber");
  refs.paint_panel.classList.toggle("hidden", tool !== "paint");
}

export function set_raw_error(refs: DomRefs, error: string | null): void {
  refs.raw_error.textContent = error || "";
  refs.raw_error.classList.toggle("visible", !!error);
}

export function set_status(refs: DomRefs, text: string): void {
  refs.status_text.textContent = text;
}

export function set_status_html(refs: DomRefs, html: string): void {
  refs.status_text.innerHTML = html;
}
