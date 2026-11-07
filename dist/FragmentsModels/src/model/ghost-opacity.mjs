const WeakRefCtor = globalThis.WeakRef;
const live = /* @__PURE__ */ new Set();
const CLASSIC_GHOST_OPACITY = 0.28;
let current = CLASSIC_GHOST_OPACITY;
function classicGhostOpacity() {
  return current;
}
function trackGhostOpacity(uniform) {
  uniform.value = current;
  live.add(WeakRefCtor ? new WeakRefCtor(uniform) : uniform);
  return uniform;
}
function setClassicGhostOpacity(alpha) {
  current = alpha;
  for (const held of live) {
    const uniform = "deref" in held ? held.deref() : held;
    if (uniform) uniform.value = alpha;
    else live.delete(held);
  }
}
export {
  CLASSIC_GHOST_OPACITY,
  classicGhostOpacity,
  setClassicGhostOpacity,
  trackGhostOpacity
};
//# sourceMappingURL=ghost-opacity.mjs.map
