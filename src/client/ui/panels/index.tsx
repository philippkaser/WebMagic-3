import { ITEMS } from "../../../shared/content";
import { APOTHECARY_STOCK, COSMETICS, GAMBLE_TIERS, KITS, RECIPES } from "../../../shared/content/shops";
import type { ItemInstance, Slot } from "../../../shared/content/types";
import { SLOTS } from "../../../shared/content/types";
import { itemName, RARITY_COLOR } from "../../../shared/game/items";
import type { InvLocation } from "../../../shared/net/protocol";
import { actions } from "../actions";
import { useUi } from "../store";

/** Panels opened over the game (inventory, shops, map). Basic version —
 * click an item to move it (equip ⇄ bag); shops list their stock. */
export function Panels() {
  const panel = useUi((s) => s.panel);
  if (!panel) return null;
  return (
    <div className="screen" onClick={(e) => e.target === e.currentTarget && actions.openPanel(null)}>
      <div className="card" style={{ minWidth: 640 }}>
        {panel === "inventory" && <Inventory />}
        {panel.startsWith("shop:") && <Shop id={panel.slice(5)} />}
        {panel === "map" && <div>The map is still being drawn.</div>}
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button className="small" onClick={() => actions.openPanel(null)}>
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

function Cell({ item, loc, onClick }: { item: ItemInstance | null; loc: InvLocation; onClick?: () => void }) {
  const base = item ? ITEMS.find(item.base) : null;
  return (
    <div
      className="slot interactive"
      title={item ? `${itemName(item)} (ilvl ${item.ilvl})${item.run ? " — run loot" : ""}${item.kit ? " — Hask's" : ""}` : loc.in}
      style={{ color: item ? RARITY_COLOR[item.rarity] : undefined, cursor: item ? "pointer" : "default", outline: item?.run ? "1px dashed #b3202a" : undefined }}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        if (item) actions.drop(loc);
      }}
    >
      {base?.glyph}
      {item && item.qty > 1 && <span className="qty">{item.qty}</span>}
    </div>
  );
}

function Inventory() {
  const acc = useUi((s) => s.account);
  const scene = useUi((s) => s.scene);
  if (!acc) return null;
  const toBag = (from: InvLocation) => {
    const free = acc.bag.indexOf(null);
    if (free >= 0) actions.move(from, { in: "bag", index: free });
  };
  const equipFromBag = (i: number) => {
    const it = acc.bag[i];
    const slot = it ? ITEMS.find(it.base)?.slot : undefined;
    if (slot) actions.move({ in: "bag", index: i }, { in: "equip", slot });
    else if (it && ITEMS.find(it.base)?.category === "consumable") {
      const free = acc.belt.indexOf(null);
      if (free >= 0) actions.move({ in: "bag", index: i }, { in: "belt", index: free });
    }
  };
  return (
    <div>
      <h2 style={{ margin: "0 0 8px", fontWeight: "normal" }}>
        {acc.name} — gear level {acc.gearLevel} · {acc.gold} gold
      </h2>
      <div className="hint">Click to equip / unequip. Right-click drops (on the floor in the dungeon; destroys in Kneel). Dashed = run loot.</div>
      <h3>Equipped</h3>
      <div style={{ display: "flex", gap: 6 }}>
        {SLOTS.map((s: Slot) => (
          <Cell key={s} item={acc.equipment[s]} loc={{ in: "equip", slot: s }} onClick={() => acc.equipment[s] && toBag({ in: "equip", slot: s })} />
        ))}
      </div>
      <h3>Pack</h3>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {acc.bag.map((it, i) => (
          <Cell key={i} item={it} loc={{ in: "bag", index: i }} onClick={() => equipFromBag(i)} />
        ))}
      </div>
      <h3>Belt</h3>
      <div style={{ display: "flex", gap: 6 }}>
        {acc.belt.map((it, i) => (
          <Cell key={i} item={it} loc={{ in: "belt", index: i }} onClick={() => it && toBag({ in: "belt", index: i })} />
        ))}
      </div>
      {scene === "village" && (
        <>
          <h3>Stash</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {acc.stash.map((it, i) => (
              <Cell key={i} item={it} loc={{ in: "stash", index: i }} onClick={() => it && toBag({ in: "stash", index: i })} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Shop({ id }: { id: string }) {
  const acc = useUi((s) => s.account);
  const offers = useUi((s) => s.gambleOffers);
  if (!acc) return null;
  const row = (label: string, price: number, onBuy: () => void, key: string) => (
    <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 16, margin: "4px 0" }}>
      <span>{label}</span>
      <button className="small interactive" disabled={acc.gold < price} onClick={onBuy}>
        {price}g
      </button>
    </div>
  );
  return (
    <div>
      <h2 style={{ margin: "0 0 8px", fontWeight: "normal" }}>
        {id} · {acc.gold} gold
      </h2>
      {id === "apprentice" || id === "apothecary"
        ? APOTHECARY_STOCK.filter((s) => (s.minDeepest ?? 0) <= acc.stats.deepest).map((s) => row(ITEMS.get(s.item).name, s.price, () => actions.shop({ op: "buy", shop: id, item: s.item }), s.item))
        : null}
      {id === "quartermaster" && (
        <>
          {KITS.map((k) => row(`${k.name} (GL ${k.gearLevel}) — ${k.desc}`, k.price, () => actions.shop({ op: "kit", kit: k.id }), k.id))}
          {acc.kitted && (
            <button className="small" onClick={() => actions.send({ t: "village", action: "unkit" })}>
              Return the kit
            </button>
          )}
        </>
      )}
      {id === "wagers" && (
        <>
          {GAMBLE_TIERS.map((t) => row(t.name, t.price, () => actions.shop({ op: "gamble", tier: t.tier }), String(t.tier)))}
          {offers && (
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              {offers.map((o, i) => (
                <button key={i} className="big interactive" onClick={() => actions.shop({ op: "gamble_pick", index: i })}>
                  {o.glyph} <small>{o.hint}</small>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {id === "tailor" && COSMETICS.filter((c) => !c.secret).map((c) => row(`${c.name}${acc.cosmetics.owned.includes(c.id) ? " (owned)" : ""}`, c.price, () => actions.shop(acc.cosmetics.owned.includes(c.id) ? { op: "cosmetic_equip", id: c.id, kind: c.kind } : { op: "cosmetic_buy", id: c.id }), c.id))}
      {id === "artificer" && RECIPES.filter((r) => r.kind === "craft").map((r) => row(`${r.name} — ${r.materials.map((m) => `${m.qty}× ${ITEMS.get(m.id).name}`).join(", ")}`, r.gold, () => actions.shop({ op: "craft", recipe: r.id }), r.id))}
    </div>
  );
}
