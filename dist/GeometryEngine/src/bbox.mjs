import * as THREE from "three";
class Bbox {
  core;
  constructor(api) {
    this.core = api.CreateAABB();
  }
  get(data) {
    const min = data.min ?? new THREE.Vector3(0, 0, 0);
    const max = data.max ?? new THREE.Vector3(1, 1, 1);
    const { x: minX, y: minY, z: minZ } = min;
    const { x: maxX, y: maxY, z: maxZ } = max;
    this.core.SetValues(minX, minY, minZ, maxX, maxY, maxZ);
    return this.core.GetBuffers();
  }
}
export {
  Bbox
};
//# sourceMappingURL=bbox.mjs.map
