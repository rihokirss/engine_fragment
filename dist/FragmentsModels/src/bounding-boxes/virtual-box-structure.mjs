import { VirtualSpatialPoint } from "./virtual-spatial-point.mjs";
import { VirtualBox } from "./virtual-box.mjs";
import { VirtualBoxCompressor } from "./virtual-box-compressor.mjs";
import { VirtualBoxCollider } from "./virtual-box-collider.mjs";
import { VirtualBoxMaker } from "./virtual-box-maker.mjs";
class VirtualBoxStructure {
  static _boxSize = 6;
  static _limitThreshold = 32;
  _compressor;
  _collider;
  _maker;
  _data;
  _boxes;
  constructor(boxes) {
    this._boxes = boxes;
    this._compressor = new VirtualBoxCompressor(boxes);
    this._data = this.getData();
    this._collider = new VirtualBoxCollider(this._compressor, this._data);
    this._maker = new VirtualBoxMaker(
      this._boxes,
      this._compressor,
      this._data
    );
    this.initData();
  }
  collideFrustum(bounds, frustum, fullyIncluded = false) {
    return this._collider.frustumCollide(bounds, frustum, fullyIncluded);
  }
  /**
   * Fills `mask` with 1 for every sample whose box is fully outside the
   * frustum (plus optional clipping planes) and 0 for every candidate.
   * Allocation-free variant of {@link collideFrustum} for the per-view
   * culling pass.
   */
  fillOutsideFrustumMask(bounds, frustum, mask) {
    this._collider.frustumFillOutsideMask(bounds, frustum, mask);
  }
  collideRay(bounds, beam) {
    return this._collider.rayCollide(bounds, beam);
  }
  setupLimits() {
    for (let i = 0; i < VirtualBoxStructure._limitThreshold; i++) {
      this._data.limits.primary.push(new VirtualBox());
      this._data.limits.secondary.push(new VirtualBox());
    }
  }
  getPointBuffer() {
    const count = this._boxes.getCount();
    const pointBuffer = new Uint32Array(count);
    for (let i = 0; i < pointBuffer.length; i++) {
      pointBuffer[i] = i;
    }
    return pointBuffer;
  }
  getPointsAmount(pointBuffer) {
    const result = pointBuffer.length * 2;
    return result - 1;
  }
  initData() {
    const pointBuffer = this.getPointBuffer();
    const pointsAmount = this.getPointsAmount(pointBuffer);
    const size = pointsAmount * VirtualBoxStructure._boxSize;
    const data = new Float64Array(size);
    for (let i = 0; i < pointsAmount; i++) {
      const position = i * VirtualBoxStructure._boxSize;
      const newPoint = new VirtualSpatialPoint(position, data);
      this._data.points.push(newPoint);
    }
    this.setupLimits();
    const root = new VirtualBox();
    this._maker.make(pointBuffer, root, pointBuffer.length);
  }
  getData() {
    return {
      points: [],
      limits: {
        primary: [],
        secondary: []
      }
    };
  }
}
export {
  VirtualBoxStructure
};
//# sourceMappingURL=virtual-box-structure.mjs.map
