import type { ModalState, Tool } from "./types";

type LoadMoveDirection = "left" | "right" | "up" | "down";
type SortDirection = "forward" | "backward";

export interface ShortcutContext {
  modal_kind: ModalState["kind"];
  in_text_entry: boolean;
  load_search_focused: boolean;
}

export interface ShortcutHandlers {
  get_context: () => ShortcutContext;
  system_save: () => void;
  system_save_as: () => void;
  system_load: () => void;
  system_undo: () => void;
  system_redo: () => void;
  set_tool: (tool: Tool) => void;
  navigate_glyphs: (direction: "up" | "down") => void;
  select_highlighted_glyph: () => void;
  dismiss: () => void;
  focus_glyph_search: () => void;
  toggle_viewport: () => void;
  toggle_sync_view: () => void;
  load_toggle_sort: (direction: SortDirection) => void;
  load_move_selection: (direction: LoadMoveDirection) => void;
  load_activate_selection: () => void;
}

function consume(ev: KeyboardEvent): void {
  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation();
}

function has_only_primary_modifier(ev: KeyboardEvent): boolean {
  const primary_count = Number(ev.metaKey) + Number(ev.ctrlKey);
  return primary_count === 1 && !ev.altKey;
}

function is_primary_combo(ev: KeyboardEvent, key: string, shift: boolean): boolean {
  return (
    has_only_primary_modifier(ev) &&
    ev.shiftKey === shift &&
    ev.key.toLowerCase() === key.toLowerCase()
  );
}

function is_unmodified(ev: KeyboardEvent, key: string): boolean {
  return (
    !ev.metaKey &&
    !ev.ctrlKey &&
    !ev.altKey &&
    !ev.shiftKey &&
    ev.key.toLowerCase() === key.toLowerCase()
  );
}

function is_unmodified_named(ev: KeyboardEvent, key: string): boolean {
  return !ev.metaKey && !ev.ctrlKey && !ev.altKey && !ev.shiftKey && ev.key === key;
}

function is_tab_without_system_modifiers(ev: KeyboardEvent): boolean {
  return ev.key === "Tab" && !ev.metaKey && !ev.ctrlKey && !ev.altKey;
}

function handle_editor_shortcuts(ev: KeyboardEvent, ctx: ShortcutContext, handlers: ShortcutHandlers): void {
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

function handle_load_modal_shortcuts(ev: KeyboardEvent, ctx: ShortcutContext, handlers: ShortcutHandlers): void {
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

function handle_non_load_modal_shortcuts(ev: KeyboardEvent, handlers: ShortcutHandlers): void {
  if (is_tab_without_system_modifiers(ev)) {
    consume(ev);
    return;
  }

  if (is_unmodified_named(ev, "Escape")) {
    consume(ev);
    handlers.dismiss();
  }
}

export function bind_shortcuts(handlers: ShortcutHandlers): () => void {
  const handle_keydown = (ev: KeyboardEvent) => {
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
    if (is_primary_combo(ev, "z", false)) {
      consume(ev);
      handlers.system_undo();
      return;
    }
    if (is_primary_combo(ev, "y", false)) {
      consume(ev);
      handlers.system_redo();
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
