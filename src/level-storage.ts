import type * as T from "./types";

export const STORAGE_KEY = "vibimon_map_editor_levels_v1";

interface PersistedCollection {
  levels: T.PersistedLevel[];
}

export interface SaveLevelInput {
  id?: string | null;
  name: string;
  raw_text: string;
  grid_width: number;
  grid_height: number;
}

function now_iso(): string {
  return new Date().toISOString();
}

function normalize_name(name: string): string {
  return name.trim();
}

function make_id(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lvl_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function safe_parse(raw: string | null): PersistedCollection {
  if (!raw) {
    return { levels: [] };
  }
  try {
    const parsed = JSON.parse(raw) as PersistedCollection;
    if (!parsed || !Array.isArray(parsed.levels)) {
      return { levels: [] };
    }
    const levels: T.PersistedLevel[] = [];
    for (const item of parsed.levels) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const level = item as T.PersistedLevel;
      if (
        typeof level.id !== "string" ||
        typeof level.name !== "string" ||
        typeof level.raw_text !== "string" ||
        typeof level.grid_width !== "number" ||
        typeof level.grid_height !== "number" ||
        typeof level.created_at !== "string" ||
        typeof level.updated_at !== "string"
      ) {
        continue;
      }
      levels.push(level);
    }
    return { levels };
  } catch {
    return { levels: [] };
  }
}

function read_collection(): PersistedCollection {
  const raw = localStorage.getItem(STORAGE_KEY);
  return safe_parse(raw);
}

function write_collection(data: PersistedCollection): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function sort_recent(levels: T.PersistedLevel[]): T.PersistedLevel[] {
  return [...levels].sort((a, b) => {
    const at = Date.parse(a.updated_at);
    const bt = Date.parse(b.updated_at);
    return bt - at;
  });
}

export function unique_name(
  base_name: string,
  existing_levels: T.PersistedLevel[],
  exclude_id?: string | null
): string {
  const normalized = normalize_name(base_name);
  if (!normalized) {
    throw new Error("Level name is required.");
  }

  const exists = (candidate: string): boolean => {
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

export function list_levels(): T.PersistedLevel[] {
  return sort_recent(read_collection().levels);
}

export function get_level(id: string): T.PersistedLevel | null {
  for (const level of read_collection().levels) {
    if (level.id === id) {
      return level;
    }
  }
  return null;
}

export function search_levels(query: string): T.PersistedLevel[] {
  const q = query.trim().toLowerCase();
  const levels = list_levels();
  if (!q) {
    return levels;
  }
  return levels.filter((level) => level.name.toLowerCase().includes(q));
}

export function save_level(input: SaveLevelInput): T.PersistedLevel {
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
    const updated: T.PersistedLevel = {
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

  const created: T.PersistedLevel = {
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

export function rename_level(id: string, name: string): T.PersistedLevel | null {
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
  const updated: T.PersistedLevel = {
    ...current,
    name: next_name,
    updated_at: now_iso()
  };
  collection.levels[idx] = updated;
  write_collection(collection);
  return updated;
}

export function delete_level(id: string): boolean {
  const collection = read_collection();
  const before = collection.levels.length;
  collection.levels = collection.levels.filter((level) => level.id !== id);
  if (collection.levels.length === before) {
    return false;
  }
  write_collection(collection);
  return true;
}
