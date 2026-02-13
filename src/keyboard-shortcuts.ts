import type { Tool } from "./types";

export type ShortcutAction =
  | { type: "tool"; tool: Tool }
  | { type: "navigate"; direction: "up" | "down" }
  | { type: "select-glyph" }
  | { type: "dismiss" }
  | { type: "toggle-viewport" };

export const SHORTCUTS: Record<string, ShortcutAction> = {
  m: { type: "tool", tool: "move" },
  p: { type: "tool", tool: "paint" },
  d: { type: "tool", tool: "rubber" },
  ArrowUp: { type: "navigate", direction: "up" },
  ArrowDown: { type: "navigate", direction: "down" },
  Enter: { type: "select-glyph" },
  Escape: { type: "dismiss" },
  Tab: { type: "toggle-viewport" },
};

export interface ShortcutHandlers {
  set_tool: (tool: Tool) => void;
  navigate_glyphs: (direction: "up" | "down") => void;
  select_highlighted_glyph: () => void;
  dismiss: () => void;
  focus_glyph_search: () => void;
  toggle_viewport: () => void;
}

export function bind_shortcuts(handlers: ShortcutHandlers): () => void {
  const handle_keydown = (ev: KeyboardEvent) => {
    const in_input = ev.target instanceof HTMLInputElement;
    const navigation_keys = ["ArrowUp", "ArrowDown", "Enter", "Escape"];

    if (in_input && !navigation_keys.includes(ev.key)) {
      return;
    }

    const action = SHORTCUTS[ev.key.toLowerCase()] || SHORTCUTS[ev.key];
    if (!action) return;

    ev.preventDefault();

    switch (action.type) {
      case "tool":
        handlers.set_tool(action.tool);
        if (action.tool === "paint") {
          handlers.focus_glyph_search();
        }
        break;
      case "navigate":
        handlers.navigate_glyphs(action.direction);
        break;
      case "select-glyph":
        handlers.select_highlighted_glyph();
        break;
      case "dismiss":
        handlers.dismiss();
        break;
      case "toggle-viewport":
        handlers.toggle_viewport();
        break;
    }
  };

  window.addEventListener("keydown", handle_keydown);
  return () => window.removeEventListener("keydown", handle_keydown);
}
