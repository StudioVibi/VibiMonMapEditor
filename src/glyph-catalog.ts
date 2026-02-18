import * as Raw from "./raw-format";
import type * as T from "./types";

function label_from_name(name: string): string {
  return name
    .replace(/^tile_/, "")
    .replace(/^ent_/, "")
    .replace(/^icon_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function normalize_token(token: string): string {
  if (token.length === 3) {
    return token;
  }
  if (token.length < 3) {
    return token.padEnd(3, " ");
  }
  return token.slice(0, 3);
}

function parse_num(str: string, fallback = 1): number {
  const n = Number(str.trim());
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}

function parse_bool(str: string, fallback = false): boolean {
  const v = str.trim();
  if (v === "true") {
    return true;
  }
  if (v === "false") {
    return false;
  }
  return fallback;
}

function split_call_args(text: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let in_string = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
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

    if (ch === "\"") {
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

function strip_quotes(value: string): string | null {
  const v = value.trim();
  if (v.length < 2 || v[0] !== "\"" || v[v.length - 1] !== "\"") {
    return null;
  }
  return v.slice(1, -1);
}

function decode_escaped_literal(value: string): string {
  const safe = value.replace(/"/g, "\\\"");
  try {
    return JSON.parse(`"${safe}"`) as string;
  } catch {
    return value;
  }
}

function push_unique(tokens: T.GlyphToken[], next: T.GlyphToken): void {
  for (const tok of tokens) {
    if (tok.token === next.token) {
      return;
    }
  }
  tokens.push(next);
}

function parse_new_entries(source: string): T.GlyphToken[] {
  const out: T.GlyphToken[] = [];
  const entry_re =
    /"((?:\\.|[^"])*)"\s*:\s*Glyph\.(none|bigimg|borded|entity|player)(?:\(([\s\S]*?)\))?\s*,?/g;

  let m: RegExpExecArray | null = entry_re.exec(source);
  while (m) {
    const token = normalize_token(decode_escaped_literal(m[1]));
    const kind = m[2] as T.GlyphKind;
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

function parse_str(block: string, key: string): string | null {
  const re = new RegExp(`${key}:\\s*"([^"]+)"`);
  const m = block.match(re);
  if (!m) {
    return null;
  }
  return m[1];
}

function parse_num_field(block: string, key: string, fallback: number): number {
  const re = new RegExp(`${key}:\\s*(\\d+)`);
  const m = block.match(re);
  if (!m) {
    return fallback;
  }
  return Number(m[1]);
}

function parse_legacy_entries(source: string): T.GlyphToken[] {
  const out: T.GlyphToken[] = [];
  const token_re = /"([^"]{2})"\s*:\s*\{([\s\S]*?)\n\s*\},?/g;
  let m: RegExpExecArray | null = token_re.exec(source);

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

function ensure_defaults(tokens: T.GlyphToken[]): T.GlyphToken[] {
  const out = [...tokens];

  push_unique(out, {
    token: Raw.EMPTY_ENTITY,
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
    token: Raw.EMPTY_FLOOR,
    kind: "bigimg",
    layer: "floor",
    name: "tile_grass",
    width: 1,
    height: 1,
    single: false,
    sprite: null,
    label: "Grass"
  });

  const rank: Record<T.GlyphKind, number> = {
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

function parse_glyph_entries(source: string): T.GlyphToken[] {
  const modern = parse_new_entries(source);
  if (modern.length > 0) {
    return ensure_defaults(modern);
  }
  const legacy = parse_legacy_entries(source);
  return ensure_defaults(legacy);
}

export async function load_glyph_catalog(): Promise<T.GlyphToken[]> {
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

export function token_map(tokens: T.GlyphToken[]): Map<string, T.GlyphToken> {
  const map = new Map<string, T.GlyphToken>();
  for (const tok of tokens) {
    map.set(tok.token, tok);
  }
  return map;
}
