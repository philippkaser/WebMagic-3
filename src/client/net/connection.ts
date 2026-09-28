import type { ClientMsg, ServerMsg } from "../../shared/net/protocol";

/** One interface, two transports: the online WebSocket server, or the
 * same game server running offline in a Web Worker. The game never knows
 * which one it is talking to. */
export interface Connection {
  readonly online: boolean;
  send(msg: ClientMsg): void;
  onMessage(fn: (msg: ServerMsg | ArrayBuffer) => void): void;
  onClose(fn: () => void): void;
  close(): void;
}

class WsConnection implements Connection {
  readonly online = true;
  private handlers: ((m: ServerMsg | ArrayBuffer) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  constructor(private ws: WebSocket) {
    ws.binaryType = "arraybuffer";
    ws.onmessage = (ev) => {
      const data = typeof ev.data === "string" ? (JSON.parse(ev.data) as ServerMsg) : (ev.data as ArrayBuffer);
      for (const h of this.handlers) h(data);
    };
    ws.onclose = () => {
      for (const h of this.closeHandlers) h();
    };
  }
  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
  onMessage(fn: (m: ServerMsg | ArrayBuffer) => void): void {
    this.handlers.push(fn);
  }
  onClose(fn: () => void): void {
    this.closeHandlers.push(fn);
  }
  close(): void {
    this.ws.close();
  }
}

class WorkerConnection implements Connection {
  readonly online = false;
  private handlers: ((m: ServerMsg | ArrayBuffer) => void)[] = [];
  constructor(private worker: Worker) {
    worker.onmessage = (ev: MessageEvent<ServerMsg | ArrayBuffer>) => {
      for (const h of this.handlers) h(ev.data);
    };
    worker.onerror = (e) => console.error("[offline server]", e.message);
  }
  send(msg: ClientMsg): void {
    this.worker.postMessage(msg);
  }
  onMessage(fn: (m: ServerMsg | ArrayBuffer) => void): void {
    this.handlers.push(fn);
  }
  onClose(): void {}
  close(): void {
    this.worker.terminate();
  }
}

function tryWebSocket(url: string, timeoutMs: number): Promise<WebSocket | null> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => {
      ws.close();
      resolve(null);
    }, timeoutMs);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve(ws);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
  });
}

/** Prefer the online server; fall back to the offline worker. `?offline`
 * in the URL forces offline play. */
export async function connect(): Promise<Connection> {
  const params = new URLSearchParams(location.search);
  if (!params.has("offline")) {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = params.get("server") ?? `${proto}//${location.host}/ws`;
    const ws = await tryWebSocket(url, 1500);
    if (ws) return new WsConnection(ws);
  }
  const worker = new Worker(new URL("../../server/worker/offline.worker.ts", import.meta.url), { type: "module" });
  return new WorkerConnection(worker);
}
