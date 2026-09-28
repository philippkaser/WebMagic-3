import type { ClientMsg, InvLocation, ShopOp } from "../../shared/net/protocol";

/** What the UI may ask the game to do. The Game installs the real
 * implementation at startup; components import `actions` and call it. */
export interface UiActions {
  play(name: string): void;
  resume(): void;
  send(msg: ClientMsg): void;
  move(from: InvLocation, to: InvLocation): void;
  drop(from: InvLocation): void;
  shop(op: ShopOp): void;
  openPanel(panel: string | null): void;
  respawn(): void;
  setSetting(key: string, value: number | boolean): void;
}

export const actions: UiActions = {
  play() {},
  resume() {},
  send() {},
  move() {},
  drop() {},
  shop() {},
  openPanel() {},
  respawn() {},
  setSetting() {},
};

export function installActions(impl: UiActions): void {
  Object.assign(actions, impl);
}
