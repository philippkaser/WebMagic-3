import { useSyncExternalStore } from "react";
import type { AccountView, NoteView, RunView, SelfState } from "../../shared/net/protocol";
import type { ItemInstance } from "../../shared/content/types";

/** UI state: a tiny external store the game writes and React reads. Game
 * code never touches React; components never touch the game — they call
 * `actions` (see ui/actions.ts). */

export interface Toast {
  id: number;
  text: string;
  kind: string;
  at: number;
}

export interface UiState {
  screen: "title" | "loading" | "play";
  connecting: boolean;
  online: boolean;
  account: AccountView | null;
  run: RunView | null;
  self: SelfState | null;
  scene: "village" | "floor" | null;
  floor: number;
  biome: string;
  toasts: Toast[];
  /** Interaction prompt under the crosshair. */
  prompt: { text: string; alt?: string } | null;
  banner: { title: string; sub: string; at: number } | null;
  died: { cause: string; killer: string; lost: ItemInstance[]; floor: number } | null;
  ascended: { floor: number; banked: ItemInstance[]; gold: number } | null;
  note: NoteView | null;
  /** Open panel ("inventory", "map", "shop:apothecary", …) — pauses input. */
  panel: string | null;
  perf: { fps: number; frame: number; p95: number; lights: number; particles: number; entities: number; drawCalls: number } | null;
  gambleOffers: { glyph: string; hint: string }[] | null;
  dialog: { npc: string; line: string } | null;
  /** Pointer lock lost while playing: show "click to resume". */
  paused: boolean;
  /** Presence: another delver shares this floor (heartbeat HUD cue). */
  presence: number;
  lowHealth: boolean;
  buildId: string;
}

const initial: UiState = {
  screen: "title",
  connecting: false,
  online: false,
  account: null,
  run: null,
  self: null,
  scene: null,
  floor: 0,
  biome: "",
  toasts: [],
  prompt: null,
  banner: null,
  died: null,
  ascended: null,
  note: null,
  panel: null,
  perf: null,
  gambleOffers: null,
  dialog: null,
  paused: false,
  presence: 0,
  lowHealth: false,
  buildId: typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev",
};

declare const __BUILD_ID__: string;

type Listener = () => void;

class Store {
  private state: UiState = initial;
  private listeners = new Set<Listener>();
  private toastId = 1;

  get(): UiState {
    return this.state;
  }

  set(patch: Partial<UiState>): void {
    let changed = false;
    for (const k in patch) {
      if ((this.state as unknown as Record<string, unknown>)[k] !== (patch as Record<string, unknown>)[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  toast(text: string, kind = "info"): void {
    const t: Toast = { id: this.toastId++, text, kind, at: performance.now() };
    this.set({ toasts: [...this.state.toasts.slice(-5), t] });
    setTimeout(() => this.set({ toasts: this.state.toasts.filter((x) => x.id !== t.id) }), kind === "lore" || kind === "presence" ? 6500 : 3800);
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export const ui = new Store();

/** React hook: subscribe to a slice of UI state. */
export function useUi<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(ui.subscribe, () => select(ui.get()), () => select(ui.get()));
}
