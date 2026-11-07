import * as THREE from "three";
class VirtualBoxCompressor {
  _boxes;
  _min = new THREE.Vector3();
  _max = new THREE.Vector3();
  constructor(boxes) {
    this._boxes = boxes;
  }
  inflate(bounds) {
    const offset = this._boxes.fullBox.min;
    const min = this.getVector(bounds, offset, "min");
    const max = this.getVector(bounds, offset, "max");
    return new THREE.Box3(min, max);
  }
  deflate(bounds, result) {
    this.read(bounds);
    const data = [];
    data.push(this._min.x, this._min.y, this._min.z);
    data.push(this._max.x, this._max.y, this._max.z);
    result.set(data);
  }
  getVector(bounds, offset, value) {
    const x = bounds.get("x", value) + offset.x;
    const y = bounds.get("y", value) + offset.y;
    const z = bounds.get("z", value) + offset.z;
    return new THREE.Vector3(x, y, z);
  }
  read(bounds) {
    const { min } = this._boxes.fullBox;
    this._min.subVectors(bounds.min, min);
    this._max.subVectors(bounds.max, min);
  }
}
export {
  VirtualBoxCompressor
};
//# sourceMappingURL=virtual-box-compressor.mjs.map
