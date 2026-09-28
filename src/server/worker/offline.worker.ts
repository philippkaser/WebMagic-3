/// <reference lib="webworker" />
import type { ClientMsg } from "../../shared/net/protocol";
import { GameServer } from "../core/GameServer";
import { IdbStore } from "./idbStore";

/** Offline play: the full game server runs in a Web Worker and the page
 * talks to it exactly as it would to the online server. Physics and AI stay
 * off the render thread. */

declare const self: DedicatedWorkerGlobalScope;

const serverP = GameServer.create(new IdbStore(), { online: false });
const queue: ClientMsg[] = [];

serverP.then((server) => {
  const session = server.connect({
    send: (m) => self.postMessage(m),
    sendBinary: (b) => self.postMessage(b, [b]),
  });
  server.start();
  const handle = (m: ClientMsg) => void server.handle(session, m);
  for (const m of queue.splice(0)) handle(m);
  self.onmessage = (ev: MessageEvent<ClientMsg>) => handle(ev.data);
});

self.onmessage = (ev: MessageEvent<ClientMsg>) => {
  queue.push(ev.data);
};
