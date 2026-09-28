/** Keyboard + mouse state with pointer lock. Game code asks questions
 * ("is W down", "was E pressed this frame") instead of handling events. */

export type Action =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "jump"
  | "relic"
  | "interact"
  | "alt"
  | "belt1"
  | "belt2"
  | "belt3"
  | "belt4"
  | "sign"
  | "inventory"
  | "map"
  | "perf"
  | "escape"
  | "chat";

const DEFAULT_BINDINGS: Record<Action, string[]> = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  relic: ["ShiftLeft", "ShiftRight"],
  interact: ["KeyE"],
  alt: ["KeyR"],
  belt1: ["KeyQ", "Digit1"],
  belt2: ["Digit2"],
  belt3: ["Digit3"],
  belt4: ["Digit4"],
  sign: ["KeyF"],
  inventory: ["Tab", "KeyI"],
  map: ["KeyM"],
  perf: ["F3", "KeyP"],
  escape: ["Escape"],
  chat: ["Enter"],
};

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  private mouseButtons = new Set<number>();
  private mousePressed = new Set<number>();
  private mouseReleased = new Set<number>();
  mouseDX = 0;
  mouseDY = 0;
  sensitivity = 0.0022;
  bindings = DEFAULT_BINDINGS;
  /** When a text field / menu has focus, gameplay input is suspended. */
  suspended = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (this.suspended && e.code !== "Escape" && e.code !== "Tab" && e.code !== "KeyI") return;
      if (e.code === "Tab" || e.code === "F3" || e.code === "Space") e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener("blur", () => {
      this.down.clear();
      this.mouseButtons.clear();
    });
    canvas.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      this.mouseButtons.add(e.button);
      this.mousePressed.add(e.button);
    });
    window.addEventListener("mouseup", (e) => {
      this.mouseButtons.delete(e.button);
      this.mouseReleased.add(e.button);
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  lock(): void {
    if (!this.locked) void this.canvas.requestPointerLock?.();
  }

  unlock(): void {
    if (this.locked) document.exitPointerLock();
  }

  isDown(a: Action): boolean {
    return !this.suspended && this.bindings[a].some((k) => this.down.has(k));
  }

  wasPressed(a: Action): boolean {
    return this.bindings[a].some((k) => this.pressed.has(k));
  }

  wasReleased(a: Action): boolean {
    return this.bindings[a].some((k) => this.released.has(k));
  }

  mouse(button: 0 | 2): boolean {
    return !this.suspended && this.mouseButtons.has(button);
  }

  mouseWasPressed(button: 0 | 2): boolean {
    return this.mousePressed.has(button);
  }

  mouseWasReleased(button: 0 | 2): boolean {
    return this.mouseReleased.has(button);
  }

  /** Call once at the end of each frame. */
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.mousePressed.clear();
    this.mouseReleased.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
