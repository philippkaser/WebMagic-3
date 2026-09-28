/** Side-effect imports: every painter module registers its materials.
 * Generic materials first, then one module per stratum, then the village
 * and the floor-surface overlays. Import order is layer order. */
import "./common";
import "./undercroft";
import "./archive";
import "./choir";
import "./foundry";
import "./hive";
import "./liturgy";
import "./garden";
import "./orrery";
import "./unlit";
import "./village";
import "./threshold";
import "./surfaces";
