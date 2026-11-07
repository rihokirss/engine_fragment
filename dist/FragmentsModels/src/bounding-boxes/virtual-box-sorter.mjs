import * as THREE from "three";
class VirtualBoxSorter {
  _boxes;
  _total = new THREE.Vector3();
  _change = new THREE.Vector3();
  _average = new THREE.Vector3();
  _tempCenterVector = new THREE.Vector3();
  _tempVectors = {
    x: new THREE.Vector3(),
    y: new THREE.Vector3(),
    z: new THREE.Vector3()
  };
  constructor(boxes) {
    this._boxes = boxes;
  }
  sort(dataBuffer, a, b) {
    this.average(this._average, dataBuffer, a, b);
    this.getDataToTotal(a, b, dataBuffer);
    let result = this.anySort(a, b, dataBuffer);
    result = this.adjust(b, a, result);
    return Math.round(result);
  }
  anySort(a, b, dataBuffer) {
    if (this._total.x > this._total.y) {
      if (this._total.x > this._total.z) {
        return this.sortDim("x", this._average.x, a, b, dataBuffer);
      }
      return this.sortDim("z", this._average.z, a, b, dataBuffer);
    }
    if (this._total.y > this._total.z) {
      return this.sortDim("y", this._average.y, a, b, dataBuffer);
    }
    return this.sortDim("z", this._average.z, a, b, dataBuffer);
  }
  getDataToTotal(a, b, dataBuffer) {
    this._total.set(0, 0, 0);
    for (let i = a; i < b; i++) {
      const box = this._boxes.get(dataBuffer[i]);
      box.getCenter(this._change).sub(this._average);
      const deltaSquared = this._change.multiply(this._change);
      this._total.add(deltaSquared);
    }
  }
  sortDim(dimension, threshold, first, second, elements) {
    let position = first;
    for (let i = first; i < second; i++) {
      const value = this.getValue(elements, i, dimension);
      if (value > threshold) {
        this.exchange(i, position, elements);
        position++;
      }
    }
    return position;
  }
  exchange(first, second, elements) {
    const value = elements[first];
    elements[first] = elements[second];
    elements[second] = value;
  }
  getValue(elements, i, dimension) {
    const box = this.getBox(elements, i);
    const vector = this._tempVectors[dimension];
    const value = box.getCenter(vector)[dimension];
    return value;
  }
  average(result, elements, first, second) {
    const box = this.getBox(elements, first);
    box.getCenter(result);
    this.aggregate(first, second, elements, box, result);
    return result.divideScalar(second - first);
  }
  aggregate(first, second, elements, box, result) {
    for (let i = first + 1; i < second; i++) {
      const current = elements[i];
      box = this._boxes.get(current);
      const center = box.getCenter(this._tempCenterVector);
      result.add(center);
    }
  }
  adjust(b, a, result) {
    const correction = (a + b) / 2;
    const diff = b - a;
    const factor = diff / 3;
    if (result <= a + factor) {
      result = correction;
    } else if (result >= b - 1 - factor) {
      result = correction;
    }
    return result;
  }
  getBox(elements, index) {
    const selected = elements[index];
    return this._boxes.get(selected);
  }
}
export {
  VirtualBoxSorter
};
//# sourceMappingURL=virtual-box-sorter.mjs.map
