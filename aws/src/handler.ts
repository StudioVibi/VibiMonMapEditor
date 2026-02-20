import { randomUUID } from "node:crypto";

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "vibimon_levels";
const UPDATED_INDEX_NAME = process.env.UPDATED_INDEX_NAME || "scope-updated-index";
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || "*";
const REQUIRED_GROUP = process.env.REQUIRED_GROUP || "map-admin";
const REQUIRE_AUTH = process.env.REQUIRE_AUTH !== "false";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;

type SortMode = "recent" | "name";

type LevelRecord = {
  id: string;
  scope: "global";
  name: string;
  name_lower: string;
  raw_text: string;
  grid_width: number;
  grid_height: number;
  created_at: string;
  updated_at: string;
  updated_sort: string;
  version: number;
};

type PersistedLevel = {
  id: string;
  name: string;
  raw_text: string;
  grid_width: number;
  grid_height: number;
  created_at: string;
  updated_at: string;
  version: number;
};

type SaveBody = {
  name: string;
  raw_text: string;
  grid_width: number;
  grid_height: number;
  version?: number;
  allow_create?: boolean;
  created_at?: string;
  updated_at?: string;
};

type RenameBody = {
  name: string;
};

type CursorPayload = {
  offset?: number;
  dynamo?: Record<string, unknown>;
};

type JwtClaims = Record<string, unknown>;

type EventWithAuthorizer = APIGatewayProxyEventV2 & {
  requestContext: APIGatewayProxyEventV2["requestContext"] & {
    authorizer?: {
      jwt?: {
        claims?: JwtClaims;
      };
    };
  };
};

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function now_iso(): string {
  return new Date().toISOString();
}

function normalize_name(name: string): string {
  return name.trim();
}

function clamp_limit(raw_limit: string | undefined): number {
  if (!raw_limit) {
    return DEFAULT_LIMIT;
  }
  const parsed = Number.parseInt(raw_limit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

function parse_sort_mode(raw: string | undefined): SortMode {
  if (raw === "name") {
    return "name";
  }
  return "recent";
}

function level_to_record(level: PersistedLevel): LevelRecord {
  return {
    id: level.id,
    scope: "global",
    name: level.name,
    name_lower: level.name.toLowerCase(),
    raw_text: level.raw_text,
    grid_width: level.grid_width,
    grid_height: level.grid_height,
    created_at: level.created_at,
    updated_at: level.updated_at,
    updated_sort: `${level.updated_at}#${level.id}`,
    version: level.version
  };
}

function record_to_level(raw: unknown): PersistedLevel {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid level payload from DynamoDB.");
  }
  const item = raw as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.raw_text !== "string" ||
    typeof item.grid_width !== "number" ||
    typeof item.grid_height !== "number" ||
    typeof item.created_at !== "string" ||
    typeof item.updated_at !== "string" ||
    typeof item.version !== "number"
  ) {
    throw new Error("Stored level has an invalid schema.");
  }

  return {
    id: item.id,
    name: item.name,
    raw_text: item.raw_text,
    grid_width: item.grid_width,
    grid_height: item.grid_height,
    created_at: item.created_at,
    updated_at: item.updated_at,
    version: item.version
  };
}

function is_iso_date(val: unknown): val is string {
  if (typeof val !== "string") {
    return false;
  }
  return Number.isFinite(Date.parse(val));
}

function parse_json_body<T>(event: APIGatewayProxyEventV2): T {
  if (!event.body) {
    throw api_error(400, "Body is required.", "INVALID_BODY");
  }
  try {
    return JSON.parse(event.body) as T;
  } catch {
    throw api_error(400, "Body must be valid JSON.", "INVALID_BODY");
  }
}

function parse_save_body(event: APIGatewayProxyEventV2): SaveBody {
  const payload = parse_json_body<Partial<SaveBody>>(event);
  if (!payload || typeof payload !== "object") {
    throw api_error(400, "Invalid payload.", "INVALID_BODY");
  }

  if (typeof payload.name !== "string" || !normalize_name(payload.name)) {
    throw api_error(400, "Level name is required.", "INVALID_NAME");
  }
  if (typeof payload.raw_text !== "string") {
    throw api_error(400, "raw_text is required.", "INVALID_RAW");
  }
  if (typeof payload.grid_width !== "number" || payload.grid_width < 1) {
    throw api_error(400, "grid_width must be a positive number.", "INVALID_SIZE");
  }
  if (typeof payload.grid_height !== "number" || payload.grid_height < 1) {
    throw api_error(400, "grid_height must be a positive number.", "INVALID_SIZE");
  }

  if (
    payload.version !== undefined &&
    (typeof payload.version !== "number" || !Number.isFinite(payload.version) || payload.version < 1)
  ) {
    throw api_error(400, "version must be a positive integer.", "INVALID_VERSION");
  }

  if (payload.allow_create !== undefined && typeof payload.allow_create !== "boolean") {
    throw api_error(400, "allow_create must be boolean.", "INVALID_ALLOW_CREATE");
  }

  if (payload.created_at !== undefined && !is_iso_date(payload.created_at)) {
    throw api_error(400, "created_at must be a valid ISO datetime.", "INVALID_CREATED_AT");
  }

  if (payload.updated_at !== undefined && !is_iso_date(payload.updated_at)) {
    throw api_error(400, "updated_at must be a valid ISO datetime.", "INVALID_UPDATED_AT");
  }

  return {
    name: normalize_name(payload.name),
    raw_text: payload.raw_text,
    grid_width: Math.floor(payload.grid_width),
    grid_height: Math.floor(payload.grid_height),
    version: payload.version !== undefined ? Math.floor(payload.version) : undefined,
    allow_create: payload.allow_create,
    created_at: payload.created_at,
    updated_at: payload.updated_at
  };
}

function parse_rename_body(event: APIGatewayProxyEventV2): RenameBody {
  const payload = parse_json_body<Partial<RenameBody>>(event);
  if (!payload || typeof payload !== "object") {
    throw api_error(400, "Invalid payload.", "INVALID_BODY");
  }
  if (typeof payload.name !== "string" || !normalize_name(payload.name)) {
    throw api_error(400, "Level name is required.", "INVALID_NAME");
  }
  return { name: normalize_name(payload.name) };
}

function encode_cursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decode_cursor(raw_cursor: string | null | undefined): CursorPayload | null {
  if (!raw_cursor) {
    return null;
  }
  try {
    const decoded = Buffer.from(raw_cursor, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as CursorPayload;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalized_segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function normalize_event_path(raw_path: string, stage: string | undefined): string {
  if (!stage) {
    return raw_path || "/";
  }
  const prefix = `/${stage}`;
  if (raw_path === prefix) {
    return "/";
  }
  if (raw_path.startsWith(`${prefix}/`)) {
    return raw_path.slice(prefix.length);
  }
  return raw_path || "/";
}

function path_level_id(path: string): string | null {
  const parts = normalized_segments(path);
  if (parts.length === 2 && parts[0] === "levels") {
    return decodeURIComponent(parts[1]);
  }
  return null;
}

function path_level_id_for_rename(path: string): string | null {
  const parts = normalized_segments(path);
  if (parts.length === 3 && parts[0] === "levels" && parts[2] === "name") {
    return decodeURIComponent(parts[1]);
  }
  return null;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": CORS_ALLOW_ORIGIN,
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    ...extra
  };
}

function json_response(
  status: number,
  body: unknown
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: headers(),
    body: JSON.stringify(body)
  };
}

function empty_response(status: number): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: headers(),
    body: ""
  };
}

type ApiError = {
  status: number;
  message: string;
  code: string;
  details?: unknown;
};

function api_error(status: number, message: string, code: string, details?: unknown): ApiError {
  return { status, message, code, details };
}

function is_api_error(err: unknown): err is ApiError {
  if (!err || typeof err !== "object") {
    return false;
  }
  const candidate = err as Partial<ApiError>;
  return (
    typeof candidate.status === "number" &&
    typeof candidate.message === "string" &&
    typeof candidate.code === "string"
  );
}

function is_conditional_check_failed(err: unknown): boolean {
  return err instanceof Error && err.name === "ConditionalCheckFailedException";
}

async function get_level_by_id(id: string): Promise<PersistedLevel | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { id }
    })
  );

  if (!res.Item) {
    return null;
  }
  return record_to_level(res.Item);
}

async function scan_level_summaries(): Promise<Array<{ id: string; name: string }>> {
  const items: Array<{ id: string; name: string }> = [];
  let last_key: Record<string, unknown> | undefined;

  do {
    const res = await dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ProjectionExpression: "id, #name",
        ExpressionAttributeNames: {
          "#name": "name"
        },
        ExclusiveStartKey: last_key
      })
    );

    for (const row of res.Items || []) {
      if (
        row &&
        typeof row === "object" &&
        typeof (row as Record<string, unknown>).id === "string" &&
        typeof (row as Record<string, unknown>).name === "string"
      ) {
        items.push({
          id: (row as Record<string, string>).id,
          name: (row as Record<string, string>).name
        });
      }
    }

    last_key = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (last_key);

  return items;
}

async function unique_name(base_name: string, exclude_id?: string | null): Promise<string> {
  const normalized = normalize_name(base_name);
  if (!normalized) {
    throw api_error(400, "Level name is required.", "INVALID_NAME");
  }

  const summaries = await scan_level_summaries();
  const existing = new Set<string>();
  for (const item of summaries) {
    if (exclude_id && item.id === exclude_id) {
      continue;
    }
    existing.add(item.name.toLowerCase());
  }

  if (!existing.has(normalized.toLowerCase())) {
    return normalized;
  }

  let idx = 1;
  while (idx < 50_000) {
    const candidate = `${normalized} ${idx}`;
    if (!existing.has(candidate.toLowerCase())) {
      return candidate;
    }
    idx += 1;
  }

  throw api_error(500, "Could not generate a unique level name.", "NAME_GENERATION_FAILED");
}

function parse_groups(claims: JwtClaims | undefined): string[] {
  const raw = claims?.["cognito:groups"];
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof raw === "string") {
    return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function ensure_authorized(event: EventWithAuthorizer): void {
  if (!REQUIRE_AUTH) {
    return;
  }

  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims) {
    throw api_error(401, "Missing JWT claims.", "UNAUTHORIZED");
  }

  const groups = parse_groups(claims);
  if (!groups.includes(REQUIRED_GROUP)) {
    throw api_error(403, `User is not in required group '${REQUIRED_GROUP}'.`, "FORBIDDEN");
  }
}

async function list_levels(event: EventWithAuthorizer): Promise<APIGatewayProxyStructuredResultV2> {
  const query = (event.queryStringParameters?.query || "").trim().toLowerCase();
  const sort = parse_sort_mode(event.queryStringParameters?.sort);
  const limit = clamp_limit(event.queryStringParameters?.limit);
  const cursor = decode_cursor(event.queryStringParameters?.cursor);

  if (!query && sort === "recent") {
    const dynamo_cursor =
      cursor && cursor.dynamo && typeof cursor.dynamo === "object"
        ? cursor.dynamo
        : undefined;

    const res = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: UPDATED_INDEX_NAME,
        KeyConditionExpression: "#scope = :scope",
        ExpressionAttributeNames: {
          "#scope": "scope"
        },
        ExpressionAttributeValues: {
          ":scope": "global"
        },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: dynamo_cursor
      })
    );

    const items = (res.Items || []).map((item) => record_to_level(item));
    return json_response(200, {
      items,
      next_cursor: res.LastEvaluatedKey
        ? encode_cursor({ dynamo: res.LastEvaluatedKey as Record<string, unknown> })
        : null
    });
  }

  const all: PersistedLevel[] = [];
  let last_key: Record<string, unknown> | undefined;

  do {
    const res = await dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ExclusiveStartKey: last_key
      })
    );

    for (const item of res.Items || []) {
      all.push(record_to_level(item));
    }

    last_key = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (last_key);

  let filtered = all;
  if (query) {
    filtered = filtered.filter((level) => level.name.toLowerCase().includes(query));
  }

  if (sort === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } else {
    filtered.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }

  const offset =
    cursor && typeof cursor.offset === "number" && Number.isFinite(cursor.offset)
      ? Math.max(0, Math.floor(cursor.offset))
      : 0;

  const items = filtered.slice(offset, offset + limit);
  const next_offset = offset + items.length;
  const next_cursor = next_offset < filtered.length ? encode_cursor({ offset: next_offset }) : null;

  return json_response(200, {
    items,
    next_cursor
  });
}

async function create_level(event: EventWithAuthorizer): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parse_save_body(event);
  const id = randomUUID();
  const now = now_iso();
  const name = await unique_name(body.name, null);

  const level: PersistedLevel = {
    id,
    name,
    raw_text: body.raw_text,
    grid_width: body.grid_width,
    grid_height: body.grid_height,
    created_at: now,
    updated_at: now,
    version: 1
  };

  try {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: level_to_record(level),
        ConditionExpression: "attribute_not_exists(id)"
      })
    );
  } catch (err) {
    if (is_conditional_check_failed(err)) {
      throw api_error(409, "Level id already exists.", "LEVEL_CONFLICT");
    }
    throw err;
  }

  return json_response(201, { item: level });
}

async function get_level(path: string): Promise<APIGatewayProxyStructuredResultV2> {
  const level_id = path_level_id(path);
  if (!level_id) {
    throw api_error(404, "Level route not found.", "NOT_FOUND");
  }

  const level = await get_level_by_id(level_id);
  if (!level) {
    throw api_error(404, "Level not found.", "LEVEL_NOT_FOUND");
  }

  return json_response(200, { item: level });
}

async function put_level(event: EventWithAuthorizer, path: string): Promise<APIGatewayProxyStructuredResultV2> {
  const level_id = path_level_id(path);
  if (!level_id) {
    throw api_error(404, "Level route not found.", "NOT_FOUND");
  }

  const body = parse_save_body(event);
  const existing = await get_level_by_id(level_id);

  if (!existing) {
    if (!body.allow_create) {
      throw api_error(404, "Level not found.", "LEVEL_NOT_FOUND");
    }

    const created_at = body.created_at || now_iso();
    const updated_at = body.updated_at || created_at;
    const version = body.version && body.version >= 1 ? Math.floor(body.version) : 1;
    const name = await unique_name(body.name, null);

    const created: PersistedLevel = {
      id: level_id,
      name,
      raw_text: body.raw_text,
      grid_width: body.grid_width,
      grid_height: body.grid_height,
      created_at,
      updated_at,
      version
    };

    try {
      await dynamo.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: level_to_record(created),
          ConditionExpression: "attribute_not_exists(id)"
        })
      );
    } catch (err) {
      if (is_conditional_check_failed(err)) {
        throw api_error(409, "Level already exists.", "LEVEL_CONFLICT");
      }
      throw err;
    }

    return json_response(200, { item: created });
  }

  if (body.version === undefined) {
    throw api_error(400, "version is required when updating an existing level.", "VERSION_REQUIRED");
  }

  if (Math.floor(body.version) !== existing.version) {
    throw api_error(409, "Version conflict. Reload and retry.", "VERSION_CONFLICT", {
      current_version: existing.version
    });
  }

  const name = await unique_name(body.name, existing.id);
  const updated_at = now_iso();
  const updated: PersistedLevel = {
    ...existing,
    name,
    raw_text: body.raw_text,
    grid_width: body.grid_width,
    grid_height: body.grid_height,
    updated_at,
    version: existing.version + 1
  };

  try {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: level_to_record(updated),
        ConditionExpression: "#version = :expected",
        ExpressionAttributeNames: {
          "#version": "version"
        },
        ExpressionAttributeValues: {
          ":expected": existing.version
        }
      })
    );
  } catch (err) {
    if (is_conditional_check_failed(err)) {
      throw api_error(409, "Version conflict. Reload and retry.", "VERSION_CONFLICT");
    }
    throw err;
  }

  return json_response(200, { item: updated });
}

async function patch_level_name(
  event: EventWithAuthorizer,
  path: string
): Promise<APIGatewayProxyStructuredResultV2> {
  const level_id = path_level_id_for_rename(path);
  if (!level_id) {
    throw api_error(404, "Rename route not found.", "NOT_FOUND");
  }

  const body = parse_rename_body(event);
  const existing = await get_level_by_id(level_id);
  if (!existing) {
    throw api_error(404, "Level not found.", "LEVEL_NOT_FOUND");
  }

  const next_name = await unique_name(body.name, existing.id);
  const updated: PersistedLevel = {
    ...existing,
    name: next_name,
    updated_at: now_iso(),
    version: existing.version + 1
  };

  try {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: level_to_record(updated),
        ConditionExpression: "#version = :expected",
        ExpressionAttributeNames: {
          "#version": "version"
        },
        ExpressionAttributeValues: {
          ":expected": existing.version
        }
      })
    );
  } catch (err) {
    if (is_conditional_check_failed(err)) {
      throw api_error(409, "Version conflict. Reload and retry.", "VERSION_CONFLICT");
    }
    throw err;
  }

  return json_response(200, { item: updated });
}

async function delete_level(path: string): Promise<APIGatewayProxyStructuredResultV2> {
  const level_id = path_level_id(path);
  if (!level_id) {
    throw api_error(404, "Level route not found.", "NOT_FOUND");
  }

  const res = await dynamo.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id: level_id },
      ReturnValues: "ALL_OLD"
    })
  );

  if (!res.Attributes) {
    throw api_error(404, "Level not found.", "LEVEL_NOT_FOUND");
  }

  return json_response(200, { deleted: true });
}

function method_not_allowed(): APIGatewayProxyStructuredResultV2 {
  return json_response(405, {
    error: "Method not allowed.",
    code: "METHOD_NOT_ALLOWED"
  });
}

export async function handler(
  event: EventWithAuthorizer
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method;
  const path = normalize_event_path(event.rawPath || "/", event.requestContext.stage);

  if (method === "OPTIONS") {
    return empty_response(204);
  }

  try {
    if (method === "GET" && path === "/health") {
      return json_response(200, {
        ok: true,
        timestamp: now_iso(),
        table: TABLE_NAME
      });
    }

    ensure_authorized(event);

    if (path === "/levels") {
      if (method === "GET") {
        return await list_levels(event);
      }
      if (method === "POST") {
        return await create_level(event);
      }
      return method_not_allowed();
    }

    if (path_level_id_for_rename(path)) {
      if (method === "PATCH") {
        return await patch_level_name(event, path);
      }
      return method_not_allowed();
    }

    if (path_level_id(path)) {
      if (method === "GET") {
        return await get_level(path);
      }
      if (method === "PUT") {
        return await put_level(event, path);
      }
      if (method === "DELETE") {
        return await delete_level(path);
      }
      return method_not_allowed();
    }

    return json_response(404, {
      error: "Route not found.",
      code: "NOT_FOUND"
    });
  } catch (err) {
    if (is_api_error(err)) {
      return json_response(err.status, {
        error: err.message,
        code: err.code,
        details: err.details ?? null
      });
    }

    if (err instanceof Error) {
      return json_response(500, {
        error: err.message,
        code: "INTERNAL_ERROR"
      });
    }

    return json_response(500, {
      error: "Unexpected error.",
      code: "INTERNAL_ERROR"
    });
  }
}
