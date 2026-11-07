import * as THREE from "three";
class CylindricalRevolve {
  core;
  constructor(api) {
    this.core = api.CreateCylindricalRevolution();
  }
  get(api, data) {
    const transformation = new api.wasmModule.DoubleVector();
    const transform = data.transformation ?? new THREE.Matrix4().identity().elements;
    for (const element of transform) {
      transformation.push_back(element);
    }
    const startAngle = data.startAngle ?? 0;
    const endAngle = data.endAngle ?? 180;
    const minZ = data.minZ ?? -10;
    const maxZ = data.maxZ ?? 10;
    const numRots = data.segmentCount ?? 12;
    const radius = data.radius ?? 4;
    this.core.SetValues(
      transformation,
      startAngle,
      endAngle,
      minZ,
      maxZ,
      numRots,
      radius
    );
    return this.core.GetBuffers();
  }
}
export {
  CylindricalRevolve
};
//# sourceMappingURL=cylindrical-revolve.mjs.map
