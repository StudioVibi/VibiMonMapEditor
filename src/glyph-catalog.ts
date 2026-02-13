import type * as T from "./types";

function label_from_name(name: string): string {
  return name
    .replace(/^tile_/, "")
    .replace(/^ent_/, "")
    .replace(/^icon_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function parse_bool(block: string, key: string): boolean {
  const re = new RegExp(`${key}:\\s*(true|false)`);
  const m = block.match(re);
  if (!m) {
    return false;
  }
  return m[1] === "true";
}

function parse_num(block: string, key: string, fallback: number): number {
  const re = new RegExp(`${key}:\\s*(\\d+)`);
  const m = block.match(re);
  if (!m) {
    return fallback;
  }
  return Number(m[1]);
}

function parse_str(block: string, key: string): string | null {
  const re = new RegExp(`${key}:\\s*"([^"]+)"`);
  const m = block.match(re);
  if (!m) {
    return null;
  }
  return m[1];
}

function parse_glyph_entries(source: string): T.GlyphToken[] {
  const out: T.GlyphToken[] = [];
  const token_re = /"([^"]{2})"\s*:\s*\{([\s\S]*?)\n\s*\},?/g;
  let m: RegExpExecArray | null = token_re.exec(source);

  while (m) {
    const token = m[1];
    const block = m[2];
    const kind = parse_str(block, "kind") as T.GlyphKind | null;
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

export async function load_glyph_catalog(): Promise<T.GlyphToken[]> {
  const res = await fetch("VibiMon/src/data/Glyph.ts");
  if (!res.ok) {
    throw new Error("Não foi possível carregar Glyph.ts.");
  }
  const source = await res.text();
  return parse_glyph_entries(source);
}

export function token_map(tokens: T.GlyphToken[]): Map<string, T.GlyphToken> {
  const map = new Map<string, T.GlyphToken>();
  for (const tok of tokens) {
    map.set(tok.token, tok);
  }
  return map;
}
