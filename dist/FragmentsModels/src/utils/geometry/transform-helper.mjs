import * as THREE from "three";
import { ParserHelper } from "./parser-helper.mjs";
import { Transform } from "../../../../Schema/transform.mjs";
import { BoundingBox } from "../../../../Schema/bounding-box.mjs";
class TransformHelper {
  static _transform = new Transform();
  static _min = new THREE.Vector3();
  static _max = new THREE.Vector3();
  static _center = new THREE.Vector3();
  static _distance = new THREE.Vector3();
  static _edge = new THREE.Line3();
  static _item = new THREE.Matrix4();
  static _sample = new THREE.Matrix4();
  static _box = new BoundingBox();
  static _transformers = {
    x: () => this.setBoxX(),
    y: () => this.setBoxY(),
    z: () => this.setBoxZ()
  };
  static get(sample, meshes, transform) {
    this.fetchSampleTransform(sample, meshes);
    this.fetchItemTransform(sample, meshes);
    transform.multiplyMatrices(this._item, this._sample);
  }
  static getBox(representation, bbox) {
    representation.bbox(this._box);
    ParserHelper.parseBox(this._box, bbox);
  }
  static getBoxData(bbox) {
    this._min.copy(bbox.min);
    this._max.copy(bbox.max);
    this._center.addVectors(this._min, this._max);
    this._center.divideScalar(2);
    bbox.getSize(this._distance);
  }
  static boxSize(bbox) {
    this.getBoxData(bbox);
    this.applyTransformer();
    this._edge.start = this._min.clone();
    this._edge.end = this._max.clone();
    return this._edge;
  }
  static applyTransformer() {
    const { x, y, z } = this._distance;
    const max = Math.max(x, y, z);
    if (x === max) {
      this._transformers.x();
    } else if (y === max) {
      this._transformers.y();
    } else {
      this._transformers.z();
    }
  }
  static fetchItemTransform(sample, meshes) {
    const itemId = sample.item();
    meshes.globalTransforms(itemId, this._transform);
    ParserHelper.parseTransform(this._transform, this._item);
  }
  static fetchSampleTransform(sample, meshes) {
    const localTransformId = sample.localTransform();
    meshes.localTransforms(localTransformId, this._transform);
    ParserHelper.parseTransform(this._transform, this._sample);
  }
  static setBoxZ() {
    this._min.set(this._center.x, this._center.y, this._min.z);
    this._max.set(this._center.x, this._center.y, this._max.z);
  }
  static setBoxY() {
    this._min.set(this._center.x, this._min.y, this._center.z);
    this._max.set(this._center.x, this._max.y, this._center.z);
  }
  static setBoxX() {
    this._min.set(this._min.x, this._center.y, this._center.z);
    this._max.set(this._max.x, this._center.y, this._center.z);
  }
}
export {
  TransformHelper
};
//# sourceMappingURL=transform-helper.mjs.map
