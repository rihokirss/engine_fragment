import { VirtualBoxSorter } from "./virtual-box-sorter.mjs";
class VirtualBoxMaker {
  _data;
  _compressor;
  _boxes;
  _sorter;
  constructor(boxes, compressor, data) {
    this._data = data;
    this._compressor = compressor;
    this._boxes = boxes;
    this._sorter = new VirtualBoxSorter(boxes);
  }
  make(data, bounds, a = 0, b = 0, size = 0, result = 0) {
    const distance = a - b;
    if (distance === 1) {
      return this.makePoint(data, b, bounds, result);
    }
    if (distance === 2) {
      return this.makeGroup3(result, data, b, bounds);
    }
    return this.makeGroup(size, data, b, a, result, bounds);
  }
  makeGroup3(position, data, b, bounds) {
    const box1 = this.makeBox(position + 1, data, b);
    const box2 = this.makeBox(position + 2, data, b + 1);
    bounds.combine(box1, box2);
    this.newGroup(position, 3, bounds);
    return 3;
  }
  makeGroup(size, data, b, a, position, bounds) {
    const lim1 = this._data.limits.primary[size];
    const lim2 = this._data.limits.secondary[size];
    const frontier = this._sorter.sort(data, b, a);
    const size1 = this.make(data, lim1, frontier, b, size + 1, position + 1);
    const result2 = position + size1 + 1;
    const size2 = this.make(data, lim2, a, frontier, size + 1, result2);
    bounds.combine(lim1, lim2);
    const newSize = size1 + size2 + 1;
    this.newGroup(position, newSize, bounds);
    return newSize;
  }
  makeBox(position, data, b) {
    const box = this._data.points[position].box;
    const boxPosition = data[b];
    const boxData = this._boxes.get(boxPosition);
    this._compressor.deflate(boxData, box);
    this.set(position, boxPosition);
    return box;
  }
  makePoint(data, b, bounds, position) {
    const box = this._boxes.get(data[b]);
    this._compressor.deflate(box, bounds);
    this.newPoint(position, data[b], bounds);
    return 1;
  }
  newGroup(position, size, bounds) {
    const point = this.get(position);
    point.transform(size, bounds, false);
  }
  get(position) {
    return this._data.points[position];
  }
  newPoint(position, value, bounds) {
    const point = this.get(position);
    point.transform(value, bounds, true);
  }
  set(position, data) {
    const point = this.get(position);
    point.data = data;
  }
}
export {
  VirtualBoxMaker
};
//# sourceMappingURL=virtual-box-maker.mjs.map
