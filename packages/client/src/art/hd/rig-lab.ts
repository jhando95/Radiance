/** Dev page: bakes the reference mannequin in every pose to validate rig math and ink. */
import { buildMannequin } from "./mannequin";
import { bakeRig, HD_POSES } from "./rig";

const out = document.getElementById("out") as HTMLElement;
const def = buildMannequin();
for (const pose of HD_POSES) {
  const wrap = document.createElement("div");
  wrap.style.display = "inline-block";
  wrap.style.textAlign = "center";
  const c = bakeRig(def, pose, { scale: 1 });
  wrap.append(c, document.createElement("br"), pose);
  out.append(wrap);
}
const flipped = bakeRig(def, "attack", { flip: true });
out.append(flipped);
