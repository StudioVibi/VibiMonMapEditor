import type * as T from "./types";

export interface DomRefs {
  app: HTMLDivElement;
  mode_raw_btn: HTMLButtonElement;
  mode_visual_btn: HTMLButtonElement;
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
}

export function mount_app(root: HTMLElement): DomRefs {
  root.innerHTML = `
    <div class="editor-shell">
      <header class="topbar">
        <div class="project-title">VibiMon Map Editor</div>
        <div class="mode-toggle" role="tablist" aria-label="Render mode">
          <button id="mode-raw" class="mode-btn" type="button">RAW</button>
          <span class="mode-sep">|</span>
          <button id="mode-visual" class="mode-btn active" type="button">VISUAL</button>
        </div>
      </header>
      <main class="main-layout">
        <aside class="sidebar">
          <section class="tool-section">
            <h2>Move Tool</h2>
            <button id="tool-move" class="tool-btn active" type="button">Move</button>
            <p class="tool-help">Arraste tile para mover. Arraste em área vazia para selecionar bloco.</p>
          </section>
          <section class="tool-section">
            <h2>Sprites Tool</h2>
            <button id="tool-paint" class="tool-btn" type="button">Paint</button>
            <button id="tool-rubber" class="tool-btn" type="button">Rubber</button>
          </section>
          <section id="paint-panel" class="paint-panel hidden">
            <h3>Glyph Tilesets</h3>
            <input id="sprite-search" type="text" placeholder="Buscar glifo/token..." />
            <div id="sprite-meta" class="sprite-meta">Nenhum glifo selecionado.</div>
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
    app: root as HTMLDivElement,
    mode_raw_btn: root.querySelector("#mode-raw") as HTMLButtonElement,
    mode_visual_btn: root.querySelector("#mode-visual") as HTMLButtonElement,
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
    status_text: root.querySelector("#status-text") as HTMLDivElement
  };
}

export function set_mode_ui(refs: DomRefs, mode: T.ViewMode): void {
  refs.mode_raw_btn.classList.toggle("active", mode === "raw");
  refs.mode_visual_btn.classList.toggle("active", mode === "visual");
  refs.raw_panel.classList.toggle("active", mode === "raw");
  refs.visual_panel.classList.toggle("active", mode === "visual");
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
