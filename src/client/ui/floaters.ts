import { Vector3, type Camera } from "three";

/** Floating damage numbers as a small imperative DOM layer (no React
 * re-render per frame). Numbers rise, drift and fade in world space. */
interface Floater {
  el: HTMLDivElement;
  pos: Vector3;
  vel: Vector3;
  life: number;
  max: number;
}

export class Floaters {
  private layer: HTMLDivElement;
  private items: Floater[] = [];
  private tmp = new Vector3();

  constructor(
    root: HTMLElement,
    private camera: Camera,
  ) {
    this.layer = document.createElement("div");
    this.layer.className = "floaters";
    root.appendChild(this.layer);
  }

  damage(pos: Vector3, amount: number, color: string, crit: boolean, onSelf: boolean): void {
    if (onSelf || amount < 0.5) return;
    const el = document.createElement("div");
    el.className = crit ? "floater crit" : "floater";
    el.textContent = amount >= 10 ? Math.round(amount).toString() : amount.toFixed(1).replace(/\.0$/, "");
    el.style.color = color;
    this.layer.appendChild(el);
    this.items.push({ el, pos: pos.clone().add(new Vector3(0, 0.4, 0)), vel: new Vector3((Math.random() - 0.5) * 0.8, 1.6, (Math.random() - 0.5) * 0.8), life: 0.9, max: 0.9 });
    if (this.items.length > 40) this.items.shift()!.el.remove();
  }

  update(dt: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.items = this.items.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) {
        f.el.remove();
        return false;
      }
      f.vel.y -= 2.5 * dt;
      f.pos.addScaledVector(f.vel, dt);
      this.tmp.copy(f.pos).project(this.camera);
      if (this.tmp.z > 1) {
        f.el.style.display = "none";
        return true;
      }
      f.el.style.display = "";
      f.el.style.transform = `translate(${((this.tmp.x + 1) / 2) * w}px, ${((1 - this.tmp.y) / 2) * h}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(Math.min(1, f.life / (f.max * 0.4)));
      return true;
    });
  }
}
