import { useEffect, useRef } from "react";
import { CellKind } from "../../../shared/world/layout";
import { mapData } from "../mapBridge";

/** The floor map: only what you've seen, drawn like a surveyor's sketch —
 * heights as ink density, water hatched, pits black, you as an arrow. */
export function MapPanel() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current;
      const d = mapData();
      if (c && d) paint(c, d);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div>
      <h2 style={{ margin: "0 0 8px", fontWeight: "normal", fontVariant: "small-caps", letterSpacing: ".06em" }}>Surveyor's sketch</h2>
      <canvas ref={ref} width={560} height={560} style={{ width: 560, height: 560, imageRendering: "pixelated", background: "#1a140e", border: "1px solid #5a4a3a" }} />
      <div className="hint">▲ you · ◆ Descent · ○ where you woke · ✚ allies · ☗ reliquary</div>
    </div>
  );
}

function paint(c: HTMLCanvasElement, d: ReturnType<typeof mapData> & object): void {
  const g = d.layout.grid;
  const ctx = c.getContext("2d")!;
  const s = Math.floor(Math.min(c.width / g.w, c.height / g.h));
  const ox = Math.floor((c.width - g.w * s) / 2);
  const oz = Math.floor((c.height - g.h * s) / 2);
  ctx.fillStyle = "#1a140e";
  ctx.fillRect(0, 0, c.width, c.height);
  for (let z = 0; z < g.h; z++) {
    for (let x = 0; x < g.w; x++) {
      const i = z * g.w + x;
      if (!d.seen[i]) continue;
      const k = g.kind[i];
      let col: string;
      if (k === CellKind.Solid) col = "#4a3b2c";
      else if (k === CellKind.Pit) col = "#050404";
      else if (g.liquid[i]) col = (x + z) % 2 ? "#2c4a52" : "#35565e";
      else {
        const h = Math.max(-2, Math.min(2, g.floor[i]));
        const v = Math.round(178 + h * 18);
        col = `rgb(${v},${Math.round(v * 0.9)},${Math.round(v * 0.72)})`;
      }
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * s, oz + z * s, s, s);
    }
  }
  for (const m of d.markers) {
    const i = Math.floor(m.z) * g.w + Math.floor(m.x);
    if (!d.seen[i] && m.kind !== "ally") continue;
    const px = ox + m.x * s;
    const pz = oz + m.z * s;
    ctx.fillStyle = m.kind === "descent" ? "#8a5cff" : m.kind === "ally" ? "#6ad06a" : m.kind === "reliquary" ? "#e8c060" : "#6a5a4a";
    ctx.font = `${Math.max(10, s * 2)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(m.kind === "descent" ? "◆" : m.kind === "arrival" ? "○" : m.kind === "ally" ? "✚" : m.kind === "reliquary" ? "☗" : "▣", px, pz);
  }
  const px = ox + d.player.x * s;
  const pz = oz + d.player.z * s;
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-d.player.yaw);
  ctx.fillStyle = "#d0343c";
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.6);
  ctx.lineTo(s * 0.9, s);
  ctx.lineTo(-s * 0.9, s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
