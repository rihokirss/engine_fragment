import * as THREE from "three";
import { trackGhostOpacity, classicGhostOpacity } from "../model/ghost-opacity.mjs";
const NodeMaterialBase = THREE.NodeMaterial ?? class {
};
class LodNodeMaterial extends NodeMaterialBase {
  isLodMaterial = true;
  isLineMaterial = true;
  isLodNodeMaterial = true;
  get lodSize() {
    return this.uniforms.lodSize.value;
  }
  set lodSize(value) {
    this.uniforms.lodSize.value.copy(value);
  }
  get lodColor() {
    return this.uniforms.lodColor.value;
  }
  set lodColor(color) {
    this.uniforms.lodColor.value = color;
  }
  get lodOpacity() {
    return this.uniforms.lodOpacity.value;
  }
  set lodOpacity(value) {
    this.uniforms.lodOpacity.value = value;
  }
  get highlightColor() {
    return this.uniforms.highlightColor.value;
  }
  set highlightColor(color) {
    this.uniforms.highlightColor.value = color;
  }
  get highlightOpacity() {
    return this.uniforms.highlightOpacity.value;
  }
  set highlightOpacity(value) {
    this.uniforms.highlightOpacity.value = value;
  }
  /** The output without the ghost: the one every ribbon draws with by default. */
  _plainOutput = null;
  /** The output with the ghost, built the first time the ghost is turned on. */
  _ghostOutput = null;
  _buildGhostOutput = null;
  /**
   * The GHOST_LOD twin: the ghosted ribbon is faded with the same 4x4 Bayer
   * screen-door and desaturated. Swaps the output node (and recompiles once
   * per state) instead of carrying a uniform branch, so a ribbon that is never
   * ghosted compiles no discard and keeps early depth testing.
   */
  setGhost(enabled) {
    const self = this;
    if (enabled && !this._ghostOutput && this._buildGhostOutput) {
      this._ghostOutput = this._buildGhostOutput();
    }
    const next = enabled ? this._ghostOutput : this._plainOutput;
    if (!next || self.outputNode === next) return;
    self.outputNode = next;
    self.needsUpdate = true;
  }
  constructor(parameters) {
    super();
    const T = THREE.TSL;
    const {
      uniform,
      attribute,
      positionGeometry,
      modelViewMatrix,
      cameraProjectionMatrix,
      varying,
      float,
      vec2,
      vec4,
      select,
      mix,
      normalize,
      Fn,
      If
    } = T;
    const { color, opacity, transparent, ...rest } = parameters;
    this.transparent = transparent ?? false;
    Object.assign(this, rest);
    const uniforms = {
      lodColor: uniform(new THREE.Color(color)),
      lodSize: uniform(new THREE.Vector2(1, 1)),
      lodOpacity: uniform(opacity ?? 1),
      highlightColor: uniform(new THREE.Color(1, 1, 1)),
      highlightOpacity: uniform(1),
      // Only read by the ghost output (see setGhost).
      uLodGhostOpacity: trackGhostOpacity(uniform(classicGhostOpacity()))
    };
    this.uniforms = uniforms;
    const lodWidth = float(2);
    const itemFilter = attribute("itemFilter", "float");
    const itemFirst = attribute("itemFirst", "vec3");
    const itemLast = attribute("itemLast", "vec3");
    const highlightSource = Fn(
      (builder) => builder?.geometry?.hasAttribute?.("itemHighlightColor") ? attribute("itemHighlightColor", "vec3") : uniforms.highlightColor
    )();
    const vHighlight = varying(
      select(itemFilter.greaterThan(1.5), float(1), float(0))
    );
    const vHighlightColor = varying(highlightSource);
    this.vertexNode = Fn(() => {
      const result = vec4(0, 0, 0, 0).toVar();
      If(itemFilter.notEqual(0), () => {
        const first = modelViewMatrix.mul(vec4(itemFirst, 1)).toVar();
        const last = modelViewMatrix.mul(vec4(itemLast, 1)).toVar();
        const cut = (a, b) => {
          const p22 = cameraProjectionMatrix.element(2).element(2);
          const p32 = cameraProjectionMatrix.element(3).element(2);
          const approx = p32.div(p22).negate().div(2);
          const factor = approx.sub(a.z).div(b.z.sub(a.z));
          b.xyz.assign(mix(a.xyz, b.xyz, factor));
        };
        const perspective = cameraProjectionMatrix.element(2).element(3).equal(-1);
        const firstCut = perspective.and(first.z.lessThan(0)).and(last.z.greaterThanEqual(0));
        const lastCut = perspective.and(last.z.lessThan(0)).and(first.z.greaterThanEqual(0));
        If(firstCut, () => {
          cut(first, last);
        }).ElseIf(lastCut, () => {
          cut(last, first);
        });
        const firstClip = cameraProjectionMatrix.mul(first).toVar();
        const lastClip = cameraProjectionMatrix.mul(last).toVar();
        const firstNdc = firstClip.xyz.div(firstClip.w);
        const lastNdc = lastClip.xyz.div(lastClip.w);
        const lodRatio = uniforms.lodSize.x.div(uniforms.lodSize.y);
        const orientation = lastNdc.xy.sub(firstNdc.xy).toVar();
        orientation.x.mulAssign(lodRatio);
        orientation.assign(normalize(orientation));
        const distance = vec2(orientation.y, orientation.x.negate()).toVar();
        orientation.x.divAssign(lodRatio);
        distance.x.divAssign(lodRatio);
        If(positionGeometry.x.lessThan(0), () => {
          distance.assign(distance.negate());
        });
        If(positionGeometry.y.lessThan(0), () => {
          distance.addAssign(orientation.negate());
        }).ElseIf(positionGeometry.y.greaterThan(1), () => {
          distance.addAssign(orientation);
        });
        distance.mulAssign(lodWidth);
        distance.divAssign(uniforms.lodSize.y);
        const isFirst = positionGeometry.y.lessThan(0.5);
        const lodPosition = select(isFirst, firstClip, lastClip).toVar();
        lodPosition.xy.addAssign(distance.mul(lodPosition.w));
        result.assign(lodPosition);
      });
      return result;
    })();
    this.outputNode = Fn(() => {
      const base = mix(uniforms.lodColor, vHighlightColor, vHighlight);
      const alpha = mix(
        uniforms.lodOpacity,
        uniforms.highlightOpacity,
        vHighlight
      );
      return vec4(base, alpha);
    })();
    this._plainOutput = this.outputNode;
    const ghostOpacity = uniforms.uLodGhostOpacity;
    this._buildGhostOutput = () => {
      const { vec3, dot, screenCoordinate, Discard } = T;
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
      return Fn(() => {
        Discard(bayer().greaterThanEqual(ghostOpacity));
        const base = mix(
          uniforms.lodColor,
          vHighlightColor,
          vHighlight
        ).toVar();
        const luma = dot(base, vec3(0.299, 0.587, 0.114));
        base.assign(mix(base, vec3(luma, luma, luma), 0.7).mul(0.9));
        const alpha = mix(
          uniforms.lodOpacity,
          uniforms.highlightOpacity,
          vHighlight
        );
        return vec4(base, alpha);
      })();
    };
  }
}
export {
  LodNodeMaterial
};
//# sourceMappingURL=lod-node-material.mjs.map
