import type { GridState } from "./types";
import { clone_grid } from "./raw-format";

const MAX_STACK_SIZE = 50;

const undo_stack: GridState[] = [];
const redo_stack: GridState[] = [];

export function push_snapshot(grid: GridState): void {
  undo_stack.push(clone_grid(grid));
  if (undo_stack.length > MAX_STACK_SIZE) {
    undo_stack.shift();
  }
  redo_stack.length = 0;
}

export function undo(current_grid: GridState): GridState | null {
  const prev = undo_stack.pop();
  if (!prev) {
    return null;
  }
  redo_stack.push(clone_grid(current_grid));
  return prev;
}

export function redo(current_grid: GridState): GridState | null {
  const next = redo_stack.pop();
  if (!next) {
    return null;
  }
  undo_stack.push(clone_grid(current_grid));
  return next;
}

export function clear(): void {
  undo_stack.length = 0;
  redo_stack.length = 0;
}

export function can_undo(): boolean {
  return undo_stack.length > 0;
}

export function can_redo(): boolean {
  return redo_stack.length > 0;
}
