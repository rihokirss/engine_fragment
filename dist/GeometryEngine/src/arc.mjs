import * as THREE from "three";
class Arc {
  core;
  constructor(api) {
    this.core = api.CreateArc();
  }
  get(api, data) {
    const placement = data.placement ?? new THREE.Matrix3();
    const placementValues = new api.wasmModule.DoubleVector();
    placement.elements.forEach((value) => {
      placementValues.push_back(value);
    });
    const radiusX = data.radiusX ?? 1;
    const radiusY = data.radiusY ?? 1;
    const numSegments = data.numSegments ?? 12;
    const startRad = data.start ?? 0;
    const endRad = data.end ?? Math.PI;
    const swap = data.swap ?? false;
    const normalToCenterEnding = data.endingNormalToCenter ?? false;
    this.core.SetValues(
      radiusX,
      radiusY,
      numSegments,
      placementValues,
      startRad,
      endRad,
      swap,
      normalToCenterEnding
    );
    return this.core.GetBuffers();
  }
}
export {
  Arc
};
//# sourceMappingURL=arc.mjs.map
