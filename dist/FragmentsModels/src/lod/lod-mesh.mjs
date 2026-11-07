import * as THREE from "three";
import { LodHelper } from "./lod-helper.mjs";
class LODMesh extends THREE.Mesh {
  constructor(geometry, material) {
    super(geometry, material);
    this.geometry = geometry;
    this.material = material;
    LodHelper.setupLodMeshResize(this);
  }
}
export {
  LODMesh
};
//# sourceMappingURL=lod-mesh.mjs.map
