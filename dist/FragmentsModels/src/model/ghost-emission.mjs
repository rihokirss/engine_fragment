import { shellLayerNodes, fanOutUniforms } from "./shell-layer-nodes.mjs";
import { trackGhostOpacity, classicGhostOpacity } from "./ghost-opacity.mjs";
const VERTEX_HEADER = (
  /* glsl */
  `
#ifdef GHOST
  // One shared declaration of the attribute for every per-item layer that
  // reads it: two layers each declaring it would not compile. The first
  // header to arrive declares it and the rest stay quiet.
  // (No backticks in this comment: it lives inside a template literal.)
  #ifndef ITEM_ID_ATTRIBUTE_DECLARED
  #define ITEM_ID_ATTRIBUTE_DECLARED
  attribute vec4 id; // 4 bytes of (internalItemId + 1), big-endian
  #endif
  uniform sampler2D uGhostState;
  uniform int uGhostStateWidth;
  uniform int uGhostCount;
  uniform bool uGhostInvert;
  flat varying float vGhostFlag;
#endif
`
);
const VERTEX_ANCHOR = "#include <begin_vertex>";
const VERTEX_INJECT = (
  /* glsl */
  `
#include <begin_vertex>
#ifdef GHOST
  uint gRaw =
      (uint(id.x + 0.5) << 24)
    | (uint(id.y + 0.5) << 16)
    | (uint(id.z + 0.5) << 8)
    |  uint(id.w + 0.5);
  bool gInSet = false;
  if (gRaw >= 1u) {
    int gItem = int(gRaw - 1u);
    if (gItem < uGhostCount) {
      int gw = max(uGhostStateWidth, 1);
      // R8 state texture: .r is 0 or 1 (255/255). Direct itemId index.
      gInSet = texelFetch(uGhostState, ivec2(gItem % gw, gItem / gw), 0).r > 0.5;
    }
  }
  vGhostFlag = (uGhostInvert ? !gInSet : gInSet) ? 1.0 : 0.0;
#endif
`
);
const FRAGMENT_HEADER = (
  /* glsl */
  `
#ifdef GHOST
  flat varying float vGhostFlag;
  uniform float uGhostOpacity; // fraction of pixels kept for ghosted surfaces

  // 4x4 Bayer ordered-dither threshold in [0,1) for screen-door transparency.
  float ghostBayer(vec2 fragCoord) {
    int x = int(mod(fragCoord.x, 4.0));
    int y = int(mod(fragCoord.y, 4.0));
    int i = y * 4 + x;
    int m =
      i == 0  ? 0  : i == 1  ? 8  : i == 2  ? 2  : i == 3  ? 10 :
      i == 4  ? 12 : i == 5  ? 4  : i == 6  ? 14 : i == 7  ? 6  :
      i == 8  ? 3  : i == 9  ? 11 : i == 10 ? 1  : i == 11 ? 9  :
      i == 12 ? 15 : i == 13 ? 7  : i == 14 ? 13 : 5;
    return (float(m) + 0.5) / 16.0;
  }
#endif
`
);
const FRAGMENT_DISCARD_ANCHOR = "#include <clipping_planes_fragment>";
const FRAGMENT_DISCARD_INJECT = (
  /* glsl */
  `
#include <clipping_planes_fragment>
#ifdef GHOST
  if (vGhostFlag > 0.5 && ghostBayer(gl_FragCoord.xy) >= uGhostOpacity) discard;
#endif
`
);
const FRAGMENT_COLOR_ANCHOR = "#include <color_fragment>";
const FRAGMENT_COLOR_INJECT = (
  /* glsl */
  `
#include <color_fragment>
#ifdef GHOST
  if (vGhostFlag > 0.5) {
    float ghostLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(ghostLuma), 0.7) * 0.9;
  }
#endif
`
);
const DEFINE = "GHOST";
function makeGhostUniforms() {
  return {
    uGhostState: { value: null },
    uGhostStateWidth: { value: 1 },
    uGhostCount: { value: 0 },
    uGhostInvert: { value: false },
    uGhostOpacity: trackGhostOpacity({ value: classicGhostOpacity() })
  };
}
function injectGhost(shader, u) {
  shader.uniforms.uGhostState = u.uGhostState;
  shader.uniforms.uGhostStateWidth = u.uGhostStateWidth;
  shader.uniforms.uGhostCount = u.uGhostCount;
  shader.uniforms.uGhostInvert = u.uGhostInvert;
  shader.uniforms.uGhostOpacity = u.uGhostOpacity;
  shader.vertexShader = VERTEX_HEADER + shader.vertexShader.replace(VERTEX_ANCHOR, VERTEX_INJECT);
  shader.fragmentShader = FRAGMENT_HEADER + shader.fragmentShader.replace(FRAGMENT_DISCARD_ANCHOR, FRAGMENT_DISCARD_INJECT).replace(FRAGMENT_COLOR_ANCHOR, FRAGMENT_COLOR_INJECT);
}
function installGhostEmission(material, enabled) {
  if (material.userData.hasGhost) {
    setGhost(material, enabled);
    return;
  }
  material.userData.hasGhost = true;
  material.defines ??= {};
  const uniforms = makeGhostUniforms();
  material.userData.ghostUniforms = uniforms;
  const node = shellLayerNodes(material)?.ghost;
  if (node) {
    material.userData.ghostNode = node;
    material.userData.ghostUniforms = fanOutUniforms(
      uniforms,
      node.uniforms
    );
  }
  const previousCompile = material.onBeforeCompile;
  material.onBeforeCompile = function(shader, renderer) {
    previousCompile.call(this, shader, renderer);
    injectGhost(shader, uniforms);
  };
  const previousKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = function() {
    const on = this.defines?.[DEFINE] !== void 0 ? "1" : "0";
    return `${previousKey()}|ghost:${on}`;
  };
  setGhost(material, enabled);
}
function setGhost(material, enabled) {
  material.userData.ghostNode?.setEnabled(
    enabled
  );
  const defines = material.defines ??= {};
  const enabledNow = defines[DEFINE] !== void 0;
  if (enabledNow === enabled) return;
  if (enabled) defines[DEFINE] = "";
  else delete defines[DEFINE];
  material.needsUpdate = true;
}
export {
  installGhostEmission,
  makeGhostUniforms,
  setGhost
};
//# sourceMappingURL=ghost-emission.mjs.map
