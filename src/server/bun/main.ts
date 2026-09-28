import { mkdirSync } from "node:fs";
import { join, normalize } from "node:path";
import type { ClientMsg } from "../../shared/net/protocol";
import { GameServer, type Session } from "../core/GameServer";
import { SqliteStore } from "./sqliteStore";

/** The online host: WebSocket game server + static file server for the
 * built client (dist/). Run with `bun src/server/bun/main.ts`. */

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? "data";
const DIST = process.env.DIST ?? "dist";
mkdirSync(DATA_DIR, { recursive: true });

const store = new SqliteStore(join(DATA_DIR, "godwell.sqlite"));
const server = await GameServer.create(store, {
  online: true,
  log: (m) => console.log(`[godwell] ${m}`),
  forceEncounters: process.env.FORCE_ENCOUNTERS === "1",
});
server.start();

type WsData = { session: Session | null };

const MAX_MSG = 16 * 1024;

Bun.serve<WsData>({
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (srv.upgrade(req, { data: { session: null } })) return;
      return new Response("upgrade failed", { status: 400 });
    }
    if (url.pathname === "/health") return Response.json({ ok: true, players: server.sessions.size, instances: server.instances.size });
    // Static client (production build).
    const path = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
    const file = Bun.file(join(DIST, path));
    if (await file.exists()) return new Response(file);
    const index = Bun.file(join(DIST, "index.html"));
    if (await index.exists()) return new Response(index);
    return new Response("WebMagic server running. Build the client with `bun run build`.", { status: 200 });
  },
  websocket: {
    maxPayloadLength: MAX_MSG,
    open(ws) {
      ws.data.session = server.connect({
        send: (m) => ws.send(JSON.stringify(m)),
        sendBinary: (b) => ws.sendBinary(new Uint8Array(b)),
        close: () => ws.close(),
      });
    },
    message(ws, raw) {
      const s = ws.data.session;
      if (!s || typeof raw !== "string") return;
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw) as ClientMsg;
      } catch {
        return;
      }
      if (!msg || typeof msg.t !== "string") return;
      void server.handle(s, msg);
    },
    close(ws) {
      if (ws.data.session) server.disconnect(ws.data.session);
    },
  },
});

console.log(`[godwell] listening on :${PORT}`);
