import * as THREE from "three";
import { VirtualBoxStructure } from "./virtual-box-structure.mjs";
import { Representation } from "../../../Schema/representation.mjs";
import { Sample } from "../../../Schema/sample.mjs";
import { TransformHelper } from "../utils/geometry/transform-helper.mjs";
class VirtualBoxController {
  lookup = null;
  _boxSize = 6;
  _pointSize = 3;
  _temp;
  _dimensionsOfSamples;
  _samples = [];
  _boxes;
  _meshes;
  _box;
  get fullBox() {
    return this._box;
  }
  set fullBox(box) {
    this._box = box;
  }
  constructor(fragments) {
    this._temp = {
      box: new THREE.Box3(),
      vector: new THREE.Vector3(),
      transform: new THREE.Matrix4(),
      sample: new Sample(),
      representation: new Representation()
    };
    this._box = new THREE.Box3();
    const meshes = fragments.meshes();
    if (!meshes) {
      throw new Error("Fragments: Malformed fragments data!");
    }
    this._meshes = meshes;
    const sampleCount = meshes.samplesLength();
    this._dimensionsOfSamples = new Float32Array(sampleCount);
    const boxSize = sampleCount * this._boxSize;
    this._boxes = new Float64Array(boxSize);
    this.lookup = this.newLookup();
  }
  sampleOf(id) {
    return this._samples[id];
  }
  get(id) {
    const minPosition = this.getMinPosition(id);
    const maxPosition = this.getMaxPosition(id);
    this._temp.box.min.fromArray(this._boxes, minPosition);
    this._temp.box.max.fromArray(this._boxes, maxPosition);
    return this._temp.box;
  }
  process(id) {
    this.fetchSampleAndRepresentation(id);
    this.getBox();
    this.addToFullBox();
    const minPosition = this.getMinPosition(id);
    const maxPosition = this.getMaxPosition(id);
    this._temp.box.min.toArray(this._boxes, minPosition);
    this._temp.box.max.toArray(this._boxes, maxPosition);
  }
  getCount() {
    return this._boxes.length / this._boxSize;
  }
  dimensionOf(id) {
    const dimension = this._dimensionsOfSamples[id];
    if (!dimension) {
      throw new Error("Fragments: Dimension not found!");
    }
    return dimension;
  }
  newLookup() {
    const sampleCount = this._meshes.samplesLength();
    const itemsCount = this._meshes.globalTransformsLength();
    if (sampleCount === 0) {
      return null;
    }
    for (let i = 0; i < sampleCount; i++) {
      this.fetchSampleAndRepresentation(i);
      TransformHelper.getBox(this._temp.representation, this._temp.box);
      const dimension = this._temp.box.getSize(this._temp.vector);
      this._dimensionsOfSamples[i] = dimension.length();
      this.process(i);
    }
    this._samples = new Array(itemsCount);
    for (let i = 0; i < sampleCount; i++) {
      this.storeBox(i);
    }
    if (!this.getCount()) {
      throw new Error("Fragments: Malformed boxes!");
    }
    return new VirtualBoxStructure(this);
  }
  getBox() {
    TransformHelper.get(this._temp.sample, this._meshes, this._temp.transform);
    TransformHelper.getBox(this._temp.representation, this._temp.box);
    this._temp.box.applyMatrix4(this._temp.transform);
  }
  fetchSampleAndRepresentation(id) {
    this._meshes.samples(id, this._temp.sample);
    const representationId = this._temp.sample.representation();
    this._meshes.representations(representationId, this._temp.representation);
  }
  getMinPosition(id) {
    return id * this._boxSize;
  }
  storeBox(id) {
    this.fetchSampleAndRepresentation(id);
    const sampleId = this._temp.sample.item();
    if (this._samples[sampleId] === void 0) {
      this._samples[sampleId] = [];
    }
    this._samples[sampleId].push(id);
  }
  getMaxPosition(id) {
    return id * this._boxSize + this._pointSize;
  }
  addToFullBox() {
    this.fullBox.union(this._temp.box);
  }
}
export {
  VirtualBoxController
};
//# sourceMappingURL=virtual-box-controller.mjs.map
