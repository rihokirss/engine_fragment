import * as THREE from "three";
import { LodHelper } from "./lod-helper.mjs";
class LODGeometry extends THREE.InstancedBufferGeometry {
  isLODGeometry = true;
  isFiltered() {
    const filter = this.getItemFilter();
    return Boolean(filter);
  }
  constructor() {
    super();
    LodHelper.setupLodAttributes(this);
  }
  computeBoundingBox() {
    if (!this.boundingBox) {
      this.boundingBox = new THREE.Box3();
    }
    LodHelper.computeLodBox(this);
  }
  applyMatrix4(matrix) {
    this.applyTransformToBuffers(matrix);
    this.updateBounds();
    return this;
  }
  computeBoundingSphere() {
    if (!this.boundingSphere) {
      this.boundingSphere = new THREE.Sphere();
    }
    LodHelper.computeLodSphere(this);
  }
  getItemFilter() {
    return LodHelper.getInstancedAttribute(this, "itemFilter");
  }
  getItemLast() {
    return LodHelper.getInterAttribute(this, "itemLast");
  }
  getItemFirst() {
    return LodHelper.getInterAttribute(this, "itemFirst");
  }
  applyTransformToBuffers(matrix) {
    const first = this.getItemFirst();
    first.applyMatrix4(matrix);
    const last = this.getItemLast();
    last.applyMatrix4(matrix);
  }
  updateBounds() {
    if (this.boundingBox) {
      this.computeBoundingBox();
    }
    if (this.boundingSphere) {
      this.computeBoundingSphere();
    }
  }
}
export {
  LODGeometry
};
//# sourceMappingURL=lod-geometry.mjs.map
