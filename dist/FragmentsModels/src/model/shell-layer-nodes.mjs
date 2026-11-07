import * as THREE from "three";
import { trackGhostOpacity, classicGhostOpacity } from "./ghost-opacity.mjs";
const layerTsl = () => {
  const tsl = THREE.TSL;
  const canRun = typeof THREE.WebGPURenderer === "function" && tsl && typeof tsl.Fn === "function" && typeof tsl.textureLoad === "function" && typeof tsl.vertexStage === "function";
  return canRun ? tsl : null;
};
const standIn = (format, bytes) => {
  const texture = new THREE.DataTexture(new Uint8Array(bytes), 1, 1, format);
  texture.needsUpdate = true;
  return texture;
};
function accessor(node, read = (v) => v, write = (v) => v) {
  return {
    get value() {
      return read(node.value);
    },
    set value(given) {
      node.value = write(given);
    }
  };
}
function shellLayerNodes(material) {
  const cached = material.userData.shellLayerNodes;
  if (cached) return cached;
  const tsl = layerTsl();
  if (!tsl) return null;
  const {
    Fn,
    If,
    bool,
    attribute,
    uniform,
    texture,
    textureLoad,
    ivec2,
    float,
    vec3,
    vec4,
    materialColor,
    screenCoordinate,
    mix,
    dot,
    select,
    vertexStage
  } = tsl;
  const itemOf = () => {
    const id = attribute("id", "vec4");
    const raw = id.x.mul(16777216).add(id.y.mul(65536)).add(id.z.mul(256)).add(id.w).add(0.5).floor();
    return { raw, item: raw.sub(1).toInt() };
  };
  const lookup = (table, width, count) => Fn(() => {
    const { raw, item } = itemOf();
    const texel = vec4(0, 0, 0, 0).toVar();
    If(raw.greaterThanEqual(1).and(item.lessThan(count.toInt())), () => {
      const columns = width.max(1).toInt();
      texel.assign(
        textureLoad(table, ivec2(item.mod(columns), item.div(columns)))
      );
    });
    return texel;
  })();
  const ghostBlank = standIn(THREE.RedFormat, [0]);
  const ghostState = texture(ghostBlank);
  const ghostWidth = uniform(1);
  const ghostCount = uniform(0);
  const ghostInvert = uniform(0);
  const ghostOpacity = trackGhostOpacity(uniform(classicGhostOpacity()));
  const ghostFlag = vertexStage(
    Fn(() => {
      const inSet = select(
        lookup(ghostState, ghostWidth, ghostCount).r.greaterThan(0.5),
        float(1),
        float(0)
      );
      return select(ghostInvert.greaterThan(0.5), float(1).sub(inSet), inSet);
    })()
  );
  const bayer = Fn(() => {
    const where = screenCoordinate.xy;
    const index = where.y.mod(4).toInt().mul(4).add(where.x.mod(4).toInt());
    const order = float(0).toVar();
    const table = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let slot = 0; slot < table.length; slot++) {
      order.assign(select(index.equal(slot), float(table[slot]), order));
    }
    return order.add(0.5).div(16);
  });
  const on = { ghost: false };
  const composed = /* @__PURE__ */ new Map();
  const keepAll = bool(true);
  const compose = () => {
    const key = `${on.ghost ? 1 : 0}`;
    let nodes = composed.get(key);
    if (!nodes) {
      const colour = on.ghost ? Fn(() => {
        const base = materialColor.toVar();
        If(ghostFlag.greaterThan(0.5), () => {
          const luma = dot(base, vec3(0.299, 0.587, 0.114));
          base.assign(mix(base, vec3(luma, luma, luma), 0.7).mul(0.9));
        });
        return base;
      })() : null;
      const mask = on.ghost ? Fn(
        () => ghostFlag.lessThan(0.5).or(bayer().lessThan(ghostOpacity))
      )() : null;
      nodes = { colour, mask, shadowMask: on.ghost ? keepAll : null };
      composed.set(key, nodes);
    }
    const m = material;
    if (m.colorNode === nodes.colour && m.maskNode === nodes.mask) return;
    m.colorNode = nodes.colour;
    m.maskNode = nodes.mask;
    m.maskShadowNode = nodes.shadowMask;
    material.needsUpdate = true;
  };
  const switcher = (layer) => (enabled) => {
    if (on[layer] === enabled) return;
    on[layer] = enabled;
    compose();
  };
  const layers = {
    ghost: {
      uniforms: {
        uGhostState: accessor(
          ghostState,
          void 0,
          (t) => t ?? ghostBlank
        ),
        uGhostStateWidth: accessor(ghostWidth),
        uGhostCount: accessor(ghostCount),
        // A float rather than a bool in the shader: a number is the one shape
        // every TSL release agrees on.
        uGhostInvert: accessor(
          ghostInvert,
          (v) => v > 0.5,
          (b) => b ? 1 : 0
        ),
        uGhostOpacity: accessor(ghostOpacity)
      },
      setEnabled: switcher("ghost")
    },
    refresh: compose
  };
  material.userData.shellLayerNodes = layers;
  return layers;
}
function fanOutUniforms(glsl, node) {
  const out = {};
  for (const key of Object.keys(glsl)) {
    Object.defineProperty(out, key, {
      enumerable: true,
      value: {
        get value() {
          return glsl[key].value;
        },
        set value(given) {
          glsl[key].value = given;
          node[key].value = given;
        }
      }
    });
  }
  return out;
}
export {
  fanOutUniforms,
  shellLayerNodes
};
//# sourceMappingURL=shell-layer-nodes.mjs.map
