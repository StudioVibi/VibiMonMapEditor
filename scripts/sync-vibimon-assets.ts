import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type GlyphKind = "building" | "bordered" | "entity" | "marker";

interface GlyphToken {
  kind: GlyphKind;
  name: string;
  width: number;
  height: number;
  sprite: string | null;
}

const ROOT = process.cwd();
const SOURCE_ASSETS_DIR = join(ROOT, "VibiMon/assets");
const SOURCE_GLYPH_FILE = join(ROOT, "VibiMon/src/data/Glyph.ts");
const TARGET_ASSETS_DIR = join(ROOT, "public/vibimon-assets");
const TARGET_GLYPH_FILE = join(TARGET_ASSETS_DIR, "Glyph.ts");
const TARGET_MANIFEST_FILE = join(TARGET_ASSETS_DIR, "glyph-assets-manifest.json");
const FALLBACK_NAME = "tile_grass_00_00.png";
const PLACEHOLDER_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W0n8AAAAASUVORK5CYII=";

const BORDER_SUFFIXES = [
  "center",
  "outer_top_lft",
  "outer_top_rgt",
  "outer_bot_lft",
  "outer_bot_rgt",
  "edge_top",
  "edge_bot",
  "edge_lft",
  "edge_rgt",
  "inner_top_lft",
  "inner_top_rgt",
  "inner_bot_lft",
  "inner_bot_rgt"
] as const;

function ensure_dir(path: string): void {
  mkdirSync(path, { recursive: true });
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

function parse_glyph_entries(source: string): GlyphToken[] {
  const out: GlyphToken[] = [];
  const token_re = /"([^"]{2})"\s*:\s*\{([\s\S]*?)\n\s*\},?/g;
  let m: RegExpExecArray | null = token_re.exec(source);

  while (m) {
    const token = m[1];
    const block = m[2];
    const kind = parse_str(block, "kind") as GlyphKind | null;
    const name = parse_str(block, "name") || token;
    const width = parse_num(block, "width", 1);
    const height = parse_num(block, "height", 1);
    const sprite = parse_str(block, "sprite");

    if (kind) {
      out.push({
        kind,
        name,
        width: Math.max(1, width),
        height: Math.max(1, height),
        sprite
      });
    }

    m = token_re.exec(source);
  }

  return out;
}

function sprite_id(name: string, ix: number, iy: number): string {
  const pad_x = String(ix).padStart(2, "0");
  const pad_y = String(iy).padStart(2, "0");
  return `${name}_${pad_x}_${pad_y}.png`;
}

function collect_expected_files(tokens: GlyphToken[]): Set<string> {
  const expected = new Set<string>();
  expected.add(FALLBACK_NAME);

  for (const token of tokens) {
    if (token.kind === "building") {
      if (token.name.startsWith("icon_") || token.name === "tile_mountain_door") {
        expected.add(`${token.name}.png`);
      } else {
        for (let iy = 0; iy < token.height; iy++) {
          for (let ix = 0; ix < token.width; ix++) {
            expected.add(sprite_id(token.name, ix, iy));
          }
        }
      }
      continue;
    }

    if (token.kind === "bordered") {
      for (const suffix of BORDER_SUFFIXES) {
        expected.add(`${token.name}_${suffix}.png`);
      }
      continue;
    }

    if (token.kind === "entity" && token.sprite) {
      expected.add(`${token.sprite}_front_stand.png`);
    }
  }

  return expected;
}

function ensure_fallback_file(): string {
  ensure_dir(TARGET_ASSETS_DIR);
  const fallback_target = join(TARGET_ASSETS_DIR, FALLBACK_NAME);
  const fallback_source = join(SOURCE_ASSETS_DIR, FALLBACK_NAME);

  if (existsSync(fallback_source)) {
    copyFileSync(fallback_source, fallback_target);
    return fallback_target;
  }

  if (!existsSync(fallback_target)) {
    writeFileSync(fallback_target, Buffer.from(PLACEHOLDER_BASE64, "base64"));
  }

  return fallback_target;
}

function load_glyph_source(): string | null {
  if (existsSync(SOURCE_GLYPH_FILE)) {
    copyFileSync(SOURCE_GLYPH_FILE, TARGET_GLYPH_FILE);
    return readFileSync(SOURCE_GLYPH_FILE, "utf8");
  }

  if (existsSync(TARGET_GLYPH_FILE)) {
    return readFileSync(TARGET_GLYPH_FILE, "utf8");
  }

  return null;
}

function sync_expected_files(expected: Set<string>, fallback_path: string): void {
  let copied_from_source = 0;
  let created_with_fallback = 0;
  let kept_existing = 0;
  let missing_from_source = 0;

  for (const filename of expected) {
    const source = join(SOURCE_ASSETS_DIR, filename);
    const target = join(TARGET_ASSETS_DIR, filename);

    ensure_dir(dirname(target));

    if (existsSync(source)) {
      copyFileSync(source, target);
      copied_from_source += 1;
      continue;
    }

    missing_from_source += 1;
    if (existsSync(target)) {
      kept_existing += 1;
    } else {
      copyFileSync(fallback_path, target);
      created_with_fallback += 1;
    }
  }

  writeFileSync(TARGET_MANIFEST_FILE, `${JSON.stringify(Array.from(expected).sort(), null, 2)}\n`);

  console.log(
    [
      "sync:sprites",
      `expected=${expected.size}`,
      `copied=${copied_from_source}`,
      `fallback_created=${created_with_fallback}`,
      `kept_existing=${kept_existing}`,
      `missing_source=${missing_from_source}`
    ].join(" | ")
  );
}

function copy_all_source_assets(): number {
  if (!existsSync(SOURCE_ASSETS_DIR)) {
    return 0;
  }

  let copied = 0;
  for (const entry of readdirSync(SOURCE_ASSETS_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const source = join(SOURCE_ASSETS_DIR, entry.name);
    const target = join(TARGET_ASSETS_DIR, entry.name);
    copyFileSync(source, target);
    copied += 1;
  }

  return copied;
}

function main(): void {
  const fallback_path = ensure_fallback_file();
  const glyph_source = load_glyph_source();

  if (!glyph_source) {
    const copied = copy_all_source_assets();
    console.log(
      [
        "sync:sprites",
        "glyph_source=missing",
        `copied_all_source=${copied}`,
        "note=using existing vibimon-assets and fallback only"
      ].join(" | ")
    );
    return;
  }

  const tokens = parse_glyph_entries(glyph_source);
  const expected = collect_expected_files(tokens);
  sync_expected_files(expected, fallback_path);
}

main();
