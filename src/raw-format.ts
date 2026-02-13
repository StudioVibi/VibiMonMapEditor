import type * as T from "./types";

export const EMPTY_FLOOR = "::";
export const EMPTY_ENTITY = "  ";

function parse_line(line: string): string[] {
  let text = line;
  if (text.length % 4 === 3) {
    text += " ";
  }
  const row: string[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const cell = text.slice(i, i + 4);
    row.push(cell.slice(1, 3));
  }
  return row;
}

function ensure_glyph_2(token: string): string {
  if (token.length === 2) {
    return token;
  }
  if (token.length < 2) {
    return token.padEnd(2, " ");
  }
  return token.slice(0, 2);
}

export function make_empty_grid(width: number, height: number): T.GridState {
  const cells: T.TileCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: T.TileCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ floor: EMPTY_FLOOR, entity: EMPTY_ENTITY });
    }
    cells.push(row);
  }
  return { width, height, cells };
}

export function clone_grid(grid: T.GridState): T.GridState {
  return {
    width: grid.width,
    height: grid.height,
    cells: grid.cells.map((row) => row.map((cell) => ({ ...cell })))
  };
}

export function serialize_raw(grid: T.GridState): string {
  const lines: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let entity_line = "";
    let floor_line = "";
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y][x];
      entity_line += ` ${ensure_glyph_2(cell.entity)} `;
      floor_line += ` ${ensure_glyph_2(cell.floor)} `;
    }
    lines.push(entity_line);
    lines.push(floor_line);
  }
  return lines.join("\n");
}

export function parse_raw(text: string):
  | { ok: true; grid: T.GridState }
  | { ok: false; error: string } {
  const lines = text.split("\n");

  if (lines.length === 0) {
    return { ok: false, error: "RAW is empty." };
  }

  if (lines.length % 2 !== 0) {
    return { ok: false, error: "RAW must have an even number of lines." };
  }

  const entity_rows: string[][] = [];
  const floor_rows: string[][] = [];

  for (let i = 0; i < lines.length; i += 2) {
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

  for (let y = 0; y < floor_rows.length; y++) {
    if (floor_rows[y].length !== width || entity_rows[y].length !== width) {
      return { ok: false, error: `Tile row ${y + 1} has inconsistent width.` };
    }
  }

  const cells: T.TileCell[][] = [];
  for (let y = 0; y < floor_rows.length; y++) {
    const row: T.TileCell[] = [];
    for (let x = 0; x < width; x++) {
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
