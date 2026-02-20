import type * as T from "./types";

export const STORAGE_KEY = "vibimon_map_editor_levels_v2";
export const STORAGE_MODE_KEY = "vibimon_map_editor_storage_mode";
export const CLOUD_API_BASE_URL_KEY = "vibimon_map_editor_cloud_api_base_url";
export const CLOUD_AUTH_TOKEN_KEY = "vibimon_map_editor_cloud_auth_token";
export const CLOUD_IMPORT_MARKER_KEY = "vibimon_map_editor_cloud_import_v1";

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 250;

export type StorageMode = "local" | "cloud" | "hybrid";

interface PersistedCollection {
  levels: T.PersistedLevel[];
}

export interface SaveLevelInput {
  id?: string | null;
  name: string;
  raw_text: string;
  grid_width: number;
  grid_height: number;
  version?: number | null;
}

interface EditorRuntimeConfig {
  storage_mode?: StorageMode;
  api_base_url?: string;
  auth_token?: string;
  request_timeout_ms?: number;
}

interface RuntimeConfig {
  mode: StorageMode;
  api_base_url: string | null;
  auth_token: string | null;
  request_timeout_ms: number;
}

interface CloudLevelListResponse {
  items: unknown[];
  next_cursor?: string | null;
}

interface CloudLevelItemResponse {
  item: unknown;
}

interface CloudLevelDeleteResponse {
  deleted: boolean;
}

interface CloudErrorBody {
  error?: string;
  code?: string;
}

interface LocalImportMarker {
  imported_at: string;
  imported_count: number;
}

export interface StorageRuntimeInfo {
  mode: StorageMode;
  cloud_configured: boolean;
  last_cloud_error: string | null;
  local_import_done: boolean;
  local_import_count: number;
}

class StorageHttpError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "StorageHttpError";
    this.status = status;
    this.code = code;
  }
}

declare global {
  interface Window {
    VIBIMON_EDITOR_CONFIG?: EditorRuntimeConfig;
  }
}

const runtime_info: StorageRuntimeInfo = {
  mode: "local",
  cloud_configured: false,
  last_cloud_error: null,
  local_import_done: false,
  local_import_count: 0
};

let init_promise: Promise<void> | null = null;

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

function parse_json<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function base64_encode(raw: string): string {
  if (typeof btoa === "function") {
    return btoa(raw);
  }
  const maybe_buffer = (globalThis as { Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (maybe_buffer) {
    return maybe_buffer.from(raw, "utf8").toString("base64");
  }
  throw new Error("No base64 encoder available.");
}

function base64_decode(raw: string): string {
  if (typeof atob === "function") {
    return atob(raw);
  }
  const maybe_buffer = (globalThis as { Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (maybe_buffer) {
    return maybe_buffer.from(raw, "base64").toString("utf8");
  }
  throw new Error("No base64 decoder available.");
}

function is_storage_mode(value: string | undefined | null): value is StorageMode {
  return value === "local" || value === "cloud" || value === "hybrid";
}

function safe_window_config(): EditorRuntimeConfig {
  if (typeof window === "undefined") {
    return {};
  }
  const cfg = window.VIBIMON_EDITOR_CONFIG;
  if (!cfg || typeof cfg !== "object") {
    return {};
  }
  return cfg;
}

function safe_local_storage_get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safe_local_storage_set(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Keep storage operations best-effort to avoid blocking the editor.
  }
}

function read_runtime_config(): RuntimeConfig {
  const cfg = safe_window_config();

  const configured_mode = cfg.storage_mode;
  const stored_mode = safe_local_storage_get(STORAGE_MODE_KEY);
  const mode = is_storage_mode(configured_mode)
    ? configured_mode
    : is_storage_mode(stored_mode)
      ? stored_mode
      : "local";

  const api_base_raw = cfg.api_base_url ?? safe_local_storage_get(CLOUD_API_BASE_URL_KEY);
  const api_base_url = typeof api_base_raw === "string" && api_base_raw.trim()
    ? api_base_raw.trim().replace(/\/+$/, "")
    : null;

  const auth_token_raw = cfg.auth_token ?? safe_local_storage_get(CLOUD_AUTH_TOKEN_KEY);
  const auth_token = typeof auth_token_raw === "string" && auth_token_raw.trim()
    ? auth_token_raw.trim()
    : null;

  const cfg_timeout = cfg.request_timeout_ms;
  const request_timeout_ms =
    typeof cfg_timeout === "number" && Number.isFinite(cfg_timeout) && cfg_timeout > 0
      ? Math.round(cfg_timeout)
      : DEFAULT_TIMEOUT_MS;

  return {
    mode,
    api_base_url,
    auth_token,
    request_timeout_ms
  };
}

function strip_source(level: T.PersistedLevel): T.PersistedLevel {
  const { source: _source, ...rest } = level;
  return rest;
}

function normalize_level(raw: unknown, source: "local" | "cloud"): T.PersistedLevel | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.raw_text !== "string" ||
    typeof item.grid_width !== "number" ||
    typeof item.grid_height !== "number" ||
    typeof item.created_at !== "string" ||
    typeof item.updated_at !== "string"
  ) {
    return null;
  }

  const raw_version = item.version;
  const version =
    typeof raw_version === "number" && Number.isFinite(raw_version) && raw_version >= 1
      ? Math.floor(raw_version)
      : 1;

  return {
    id: item.id,
    name: item.name,
    raw_text: item.raw_text,
    grid_width: item.grid_width,
    grid_height: item.grid_height,
    created_at: item.created_at,
    updated_at: item.updated_at,
    version,
    source
  };
}

function safe_parse(raw: string | null): PersistedCollection {
  if (!raw) {
    return { levels: [] };
  }

  const parsed = parse_json<{ levels?: unknown[] }>(raw);
  if (!parsed || !Array.isArray(parsed.levels)) {
    return { levels: [] };
  }

  const levels: T.PersistedLevel[] = [];
  for (const candidate of parsed.levels) {
    const normalized = normalize_level(candidate, "local");
    if (normalized) {
      levels.push(normalized);
    }
  }
  return { levels };
}

function read_collection(): PersistedCollection {
  const raw = safe_local_storage_get(STORAGE_KEY);
  return safe_parse(raw);
}

function write_collection(data: PersistedCollection): void {
  const levels = data.levels.map((level) => strip_source(level));
  safe_local_storage_set(STORAGE_KEY, JSON.stringify({ levels }));
}

function sort_recent(levels: T.PersistedLevel[]): T.PersistedLevel[] {
  return [...levels].sort((a, b) => {
    const at = Date.parse(a.updated_at);
    const bt = Date.parse(b.updated_at);
    return bt - at;
  });
}

function with_source(level: T.PersistedLevel, source: "local" | "cloud"): T.PersistedLevel {
  return { ...level, source };
}

function with_source_list(
  levels: T.PersistedLevel[],
  source: "local" | "cloud"
): T.PersistedLevel[] {
  return levels.map((level) => with_source(level, source));
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

function list_levels_local_internal(): T.PersistedLevel[] {
  return sort_recent(read_collection().levels);
}

function get_level_local_internal(id: string): T.PersistedLevel | null {
  for (const level of read_collection().levels) {
    if (level.id === id) {
      return level;
    }
  }
  return null;
}

function search_levels_local_internal(query: string): T.PersistedLevel[] {
  const q = query.trim().toLowerCase();
  const levels = list_levels_local_internal();
  if (!q) {
    return levels;
  }
  return levels.filter((level) => level.name.toLowerCase().includes(q));
}

function save_level_local_internal(input: SaveLevelInput): T.PersistedLevel {
  const normalized_name = normalize_name(input.name);
  if (!normalized_name) {
    throw new Error("Level name is required.");
  }

  const collection = read_collection();
  const idx = input.id ? collection.levels.findIndex((level) => level.id === input.id) : -1;
  const now = now_iso();

  if (idx >= 0) {
    const current = collection.levels[idx];
    if (
      typeof input.version === "number" &&
      Number.isFinite(input.version) &&
      Math.floor(input.version) !== current.version
    ) {
      throw new Error("Version conflict. Reload the level and try again.");
    }

    const next_name = unique_name(normalized_name, collection.levels, current.id);
    const updated: T.PersistedLevel = {
      ...current,
      name: next_name,
      raw_text: input.raw_text,
      grid_width: input.grid_width,
      grid_height: input.grid_height,
      updated_at: now,
      version: current.version + 1,
      source: "local"
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
    updated_at: now,
    version: 1,
    source: "local"
  };
  collection.levels.push(created);
  write_collection(collection);
  return created;
}

function rename_level_local_internal(id: string, name: string): T.PersistedLevel | null {
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
    updated_at: now_iso(),
    version: current.version + 1,
    source: "local"
  };
  collection.levels[idx] = updated;
  write_collection(collection);
  return updated;
}

function delete_level_local_internal(id: string): boolean {
  const collection = read_collection();
  const before = collection.levels.length;
  collection.levels = collection.levels.filter((level) => level.id !== id);
  if (collection.levels.length === before) {
    return false;
  }
  write_collection(collection);
  return true;
}

function upsert_local_exact(level: T.PersistedLevel): void {
  const collection = read_collection();
  const normalized = with_source(strip_source(level), "local");
  const idx = collection.levels.findIndex((entry) => entry.id === normalized.id);
  if (idx >= 0) {
    collection.levels[idx] = normalized;
  } else {
    collection.levels.push(normalized);
  }
  write_collection(collection);
}

function upsert_local_exact_batch(levels: T.PersistedLevel[]): void {
  if (levels.length === 0) {
    return;
  }
  const collection = read_collection();
  const by_id = new Map(collection.levels.map((level) => [level.id, level]));
  for (const level of levels) {
    by_id.set(level.id, with_source(strip_source(level), "local"));
  }
  collection.levels = Array.from(by_id.values());
  write_collection(collection);
}

function import_marker_key(base_url: string): string {
  return `${CLOUD_IMPORT_MARKER_KEY}:${base_url}`;
}

function parse_import_marker(raw: string | null): LocalImportMarker | null {
  if (!raw) {
    return null;
  }
  const parsed = parse_json<LocalImportMarker>(raw);
  if (!parsed) {
    return null;
  }
  if (typeof parsed.imported_at !== "string" || typeof parsed.imported_count !== "number") {
    return null;
  }
  return parsed;
}

function set_import_marker(base_url: string, count: number): void {
  safe_local_storage_set(
    import_marker_key(base_url),
    JSON.stringify({ imported_at: now_iso(), imported_count: count })
  );
  runtime_info.local_import_done = true;
  runtime_info.local_import_count = count;
}

function sync_runtime_info(): RuntimeConfig {
  const cfg = read_runtime_config();
  runtime_info.mode = cfg.mode;
  runtime_info.cloud_configured = !!cfg.api_base_url;

  if (cfg.api_base_url) {
    const marker = parse_import_marker(safe_local_storage_get(import_marker_key(cfg.api_base_url)));
    runtime_info.local_import_done = !!marker;
    runtime_info.local_import_count = marker ? marker.imported_count : 0;
  } else {
    runtime_info.local_import_done = false;
    runtime_info.local_import_count = 0;
  }

  return cfg;
}

function describe_error(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return String(err);
}

function should_hybrid_fallback(err: unknown): boolean {
  if (!(err instanceof StorageHttpError)) {
    return true;
  }

  // Data integrity issues should be surfaced instead of silently falling back.
  if (err.status === 400 || err.status === 409) {
    return false;
  }
  return true;
}

async function request_json(path: string, init: RequestInit, cfg: RuntimeConfig): Promise<unknown> {
  if (!cfg.api_base_url) {
    throw new Error("Cloud API base URL is not configured.");
  }

  const base = cfg.api_base_url.endsWith("/") ? cfg.api_base_url : `${cfg.api_base_url}/`;
  const url = new URL(path.replace(/^\//, ""), base).toString();
  const headers = new Headers(init.headers || {});
  headers.set("accept", "application/json");
  if (cfg.auth_token) {
    headers.set("authorization", `Bearer ${cfg.auth_token}`);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), cfg.request_timeout_ms);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Cloud request timed out after ${cfg.request_timeout_ms}ms.`);
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timer);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const parsed = text ? parse_json<CloudErrorBody>(text) : null;

  if (!response.ok) {
    const message = parsed?.error && typeof parsed.error === "string"
      ? parsed.error
      : text || `Cloud request failed (${response.status}).`;
    const code = parsed?.code && typeof parsed.code === "string" ? parsed.code : null;
    throw new StorageHttpError(response.status, message, code);
  }

  if (!text) {
    return null;
  }

  const data = parse_json<unknown>(text);
  if (data === null) {
    throw new Error("Cloud response is not valid JSON.");
  }
  return data;
}

function normalize_cloud_level_item(raw: unknown): T.PersistedLevel {
  const level = normalize_level(raw, "cloud");
  if (!level) {
    throw new Error("Cloud response returned an invalid level payload.");
  }
  return level;
}

function clamp_limit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(limit)));
}

async function cloud_list_levels(query: string, cfg: RuntimeConfig): Promise<T.PersistedLevel[]> {
  const items: T.PersistedLevel[] = [];
  let cursor: string | null = null;
  let loops = 0;

  while (loops < 25) {
    loops += 1;

    const params = new URLSearchParams();
    const q = query.trim();
    if (q) {
      params.set("query", q);
    }
    params.set("sort", "recent");
    params.set("limit", String(DEFAULT_LIST_LIMIT));
    if (cursor) {
      params.set("cursor", cursor);
    }

    const raw = await request_json(`/levels?${params.toString()}`, { method: "GET" }, cfg);
    if (!raw || typeof raw !== "object") {
      throw new Error("Cloud list response payload is invalid.");
    }

    const body = raw as CloudLevelListResponse;
    if (!Array.isArray(body.items)) {
      throw new Error("Cloud list response is missing items.");
    }

    for (const item of body.items) {
      items.push(normalize_cloud_level_item(item));
    }

    cursor = typeof body.next_cursor === "string" && body.next_cursor ? body.next_cursor : null;
    if (!cursor) {
      break;
    }
  }

  return sort_recent(items);
}

async function cloud_get_level(id: string, cfg: RuntimeConfig): Promise<T.PersistedLevel | null> {
  try {
    const raw = await request_json(`/levels/${encodeURIComponent(id)}`, { method: "GET" }, cfg);
    if (!raw || typeof raw !== "object") {
      throw new Error("Cloud get response payload is invalid.");
    }
    const body = raw as CloudLevelItemResponse;
    return normalize_cloud_level_item(body.item);
  } catch (err) {
    if (err instanceof StorageHttpError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

async function cloud_save_level(input: SaveLevelInput, cfg: RuntimeConfig): Promise<T.PersistedLevel> {
  const normalized_name = normalize_name(input.name);
  if (!normalized_name) {
    throw new Error("Level name is required.");
  }

  if (!input.id) {
    const payload = {
      name: normalized_name,
      raw_text: input.raw_text,
      grid_width: input.grid_width,
      grid_height: input.grid_height
    };
    const raw = await request_json(
      "/levels",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      cfg
    );
    if (!raw || typeof raw !== "object") {
      throw new Error("Cloud create response payload is invalid.");
    }
    const body = raw as CloudLevelItemResponse;
    return normalize_cloud_level_item(body.item);
  }

  let version =
    typeof input.version === "number" && Number.isFinite(input.version)
      ? Math.floor(input.version)
      : null;

  if (version === null) {
    const current = await cloud_get_level(input.id, cfg);
    version = current ? current.version : 1;
  }

  const payload = {
    name: normalized_name,
    raw_text: input.raw_text,
    grid_width: input.grid_width,
    grid_height: input.grid_height,
    version,
    allow_create: true
  };

  const raw = await request_json(
    `/levels/${encodeURIComponent(input.id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    },
    cfg
  );
  if (!raw || typeof raw !== "object") {
    throw new Error("Cloud update response payload is invalid.");
  }
  const body = raw as CloudLevelItemResponse;
  return normalize_cloud_level_item(body.item);
}

async function cloud_rename_level(id: string, name: string, cfg: RuntimeConfig): Promise<T.PersistedLevel | null> {
  const normalized_name = normalize_name(name);
  if (!normalized_name) {
    throw new Error("Level name is required.");
  }

  try {
    const raw = await request_json(
      `/levels/${encodeURIComponent(id)}/name`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: normalized_name })
      },
      cfg
    );
    if (!raw || typeof raw !== "object") {
      throw new Error("Cloud rename response payload is invalid.");
    }
    const body = raw as CloudLevelItemResponse;
    return normalize_cloud_level_item(body.item);
  } catch (err) {
    if (err instanceof StorageHttpError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

async function cloud_delete_level(id: string, cfg: RuntimeConfig): Promise<boolean> {
  try {
    const raw = await request_json(
      `/levels/${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      },
      cfg
    );

    if (!raw || typeof raw !== "object") {
      return true;
    }

    const body = raw as CloudLevelDeleteResponse;
    if (typeof body.deleted === "boolean") {
      return body.deleted;
    }
    return true;
  } catch (err) {
    if (err instanceof StorageHttpError && err.status === 404) {
      return false;
    }
    throw err;
  }
}

async function import_local_levels_to_cloud_once(cfg: RuntimeConfig): Promise<void> {
  if (!cfg.api_base_url) {
    return;
  }

  const marker_key = import_marker_key(cfg.api_base_url);
  if (parse_import_marker(safe_local_storage_get(marker_key))) {
    runtime_info.local_import_done = true;
    return;
  }

  const local_levels = list_levels_local_internal();
  if (local_levels.length === 0) {
    set_import_marker(cfg.api_base_url, 0);
    return;
  }

  let imported = 0;
  for (const level of local_levels) {
    try {
      await request_json(
        `/levels/${encodeURIComponent(level.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: level.name,
            raw_text: level.raw_text,
            grid_width: level.grid_width,
            grid_height: level.grid_height,
            version: level.version,
            allow_create: true,
            created_at: level.created_at,
            updated_at: level.updated_at
          })
        },
        cfg
      );
      imported += 1;
    } catch (err) {
      if (err instanceof StorageHttpError && err.status === 409) {
        // Existing cloud item with divergent version/name. Keep cloud as source of truth.
        continue;
      }
      throw err;
    }
  }

  set_import_marker(cfg.api_base_url, imported);
}

function record_cloud_success(): void {
  runtime_info.last_cloud_error = null;
}

function record_cloud_error(err: unknown): void {
  runtime_info.last_cloud_error = describe_error(err);
}

async function run_with_mode<T>(
  cloud_op: (cfg: RuntimeConfig) => Promise<T>,
  local_op: () => T
): Promise<T> {
  const cfg = sync_runtime_info();

  if (cfg.mode === "local") {
    return local_op();
  }

  if (!cfg.api_base_url) {
    const missing = "Cloud API base URL is not configured.";
    runtime_info.last_cloud_error = missing;
    if (cfg.mode === "cloud") {
      throw new Error(missing);
    }
    return local_op();
  }

  if (cfg.mode === "cloud") {
    const result = await cloud_op(cfg);
    record_cloud_success();
    return result;
  }

  try {
    const result = await cloud_op(cfg);
    record_cloud_success();
    return result;
  } catch (err) {
    record_cloud_error(err);
    if (!should_hybrid_fallback(err)) {
      throw err;
    }
    return local_op();
  }
}

export async function initialize_storage(): Promise<void> {
  if (!init_promise) {
    init_promise = (async () => {
      const cfg = sync_runtime_info();
      if (!cfg.api_base_url) {
        return;
      }
      if (cfg.mode === "local") {
        return;
      }
      try {
        await import_local_levels_to_cloud_once(cfg);
        runtime_info.last_cloud_error = null;
      } catch (err) {
        record_cloud_error(err);
      }
    })();
  }
  await init_promise;
}

export function storage_runtime_info(): StorageRuntimeInfo {
  sync_runtime_info();
  return { ...runtime_info };
}

export async function list_levels(): Promise<T.PersistedLevel[]> {
  await initialize_storage();
  return run_with_mode(
    async (cfg) => {
      const levels = await cloud_list_levels("", cfg);
      upsert_local_exact_batch(levels);
      return with_source_list(levels, "cloud");
    },
    () => with_source_list(list_levels_local_internal(), "local")
  );
}

export async function get_level(id: string): Promise<T.PersistedLevel | null> {
  await initialize_storage();
  return run_with_mode(
    async (cfg) => {
      const level = await cloud_get_level(id, cfg);
      if (!level) {
        return null;
      }
      upsert_local_exact(level);
      return with_source(level, "cloud");
    },
    () => {
      const level = get_level_local_internal(id);
      return level ? with_source(level, "local") : null;
    }
  );
}

export async function search_levels(query: string): Promise<T.PersistedLevel[]> {
  await initialize_storage();
  return run_with_mode(
    async (cfg) => {
      const levels = await cloud_list_levels(query, cfg);
      upsert_local_exact_batch(levels);
      return with_source_list(levels, "cloud");
    },
    () => with_source_list(search_levels_local_internal(query), "local")
  );
}

export async function save_level(input: SaveLevelInput): Promise<T.PersistedLevel> {
  await initialize_storage();
  return run_with_mode(
    async (cfg) => {
      const saved = await cloud_save_level(input, cfg);
      upsert_local_exact(saved);
      return with_source(saved, "cloud");
    },
    () => with_source(save_level_local_internal(input), "local")
  );
}

export async function rename_level(id: string, name: string): Promise<T.PersistedLevel | null> {
  await initialize_storage();
  return run_with_mode(
    async (cfg) => {
      const renamed = await cloud_rename_level(id, name, cfg);
      if (!renamed) {
        return null;
      }
      upsert_local_exact(renamed);
      return with_source(renamed, "cloud");
    },
    () => {
      const renamed = rename_level_local_internal(id, name);
      return renamed ? with_source(renamed, "local") : null;
    }
  );
}

export async function delete_level(id: string): Promise<boolean> {
  await initialize_storage();
  return run_with_mode(
    async (cfg) => {
      const deleted = await cloud_delete_level(id, cfg);
      if (deleted) {
        delete_level_local_internal(id);
      }
      return deleted;
    },
    () => delete_level_local_internal(id)
  );
}

export async function list_levels_paginated(input: {
  query?: string;
  sort?: T.LevelSortMode;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: T.PersistedLevel[]; next_cursor: string | null }> {
  await initialize_storage();
  const query = typeof input.query === "string" ? input.query : "";
  const sort = input.sort === "name" ? "name" : "recent";
  const limit = clamp_limit(typeof input.limit === "number" ? input.limit : DEFAULT_LIST_LIMIT);

  return run_with_mode(
    async (cfg) => {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("query", query.trim());
      }
      params.set("sort", sort);
      params.set("limit", String(limit));
      if (input.cursor) {
        params.set("cursor", input.cursor);
      }

      const raw = await request_json(`/levels?${params.toString()}`, { method: "GET" }, cfg);
      if (!raw || typeof raw !== "object") {
        throw new Error("Cloud list response payload is invalid.");
      }

      const body = raw as CloudLevelListResponse;
      if (!Array.isArray(body.items)) {
        throw new Error("Cloud list response is missing items.");
      }

      const items = body.items.map((item) => normalize_cloud_level_item(item));
      upsert_local_exact_batch(items);
      return {
        items: with_source_list(items, "cloud"),
        next_cursor:
          typeof body.next_cursor === "string" && body.next_cursor.length > 0
            ? body.next_cursor
            : null
      };
    },
    () => {
      const all = sort === "name"
        ? [...search_levels_local_internal(query)].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          )
        : sort_recent(search_levels_local_internal(query));

      let offset = 0;
      if (typeof input.cursor === "string" && input.cursor) {
        const decoded = parse_json<{ offset?: number }>(base64_decode(input.cursor));
        if (decoded && typeof decoded.offset === "number" && Number.isFinite(decoded.offset)) {
          offset = Math.max(0, Math.floor(decoded.offset));
        }
      }

      const items = all.slice(offset, offset + limit);
      const next_offset = offset + items.length;
      const next_cursor = next_offset < all.length
        ? base64_encode(JSON.stringify({ offset: next_offset }))
        : null;
      return {
        items: with_source_list(items, "local"),
        next_cursor
      };
    }
  );
}
