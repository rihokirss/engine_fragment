import { VirtualBox } from "./virtual-box.mjs";
class VirtualSpatialPoint {
  box;
  data = 0;
  static _data = {
    threshold: 0,
    factor: -1
  };
  constructor(position, data) {
    this.box = new VirtualBox(position, data);
  }
  get size() {
    return this.data * VirtualSpatialPoint._data.factor;
  }
  get isPoint() {
    return this.data >= VirtualSpatialPoint._data.threshold;
  }
  transform(size, box, group) {
    if (!group) {
      size *= VirtualSpatialPoint._data.factor;
    }
    this.data = size;
    this.box.clone(box);
  }
}
export {
  VirtualSpatialPoint
};
//# sourceMappingURL=virtual-spatial-point.mjs.map
