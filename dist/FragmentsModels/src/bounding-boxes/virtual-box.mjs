class VirtualBox {
  _dataBuffer;
  _dataPosition;
  static _data = {
    size: 6,
    defaultPosition: 0,
    min: {
      x: 0,
      y: 2,
      z: 4
    },
    max: {
      x: 1,
      y: 3,
      z: 5
    },
    coords: ["x", "y", "z"],
    points: ["min", "max"]
  };
  constructor(position, data) {
    this._dataBuffer = data || this.getDefaultData();
    this._dataPosition = position || VirtualBox._data.defaultPosition;
  }
  set(values) {
    let counter = 0;
    for (const point of VirtualBox._data.points) {
      for (const coord of VirtualBox._data.coords) {
        const position = this.getPosition(coord, point);
        const result = values[counter++];
        this.setValue(position, result);
      }
    }
  }
  get(coord, point) {
    const position = this.getPosition(coord, point);
    return this._dataBuffer[position];
  }
  clone(box) {
    for (const point of VirtualBox._data.points) {
      for (const coord of VirtualBox._data.coords) {
        const position = this.getPosition(coord, point);
        const result = box.get(coord, point);
        this.setValue(position, result);
      }
    }
  }
  combine(box1, box2) {
    for (const point of VirtualBox._data.points) {
      for (const coord of VirtualBox._data.coords) {
        this.save(coord, point, box1, box2);
      }
    }
  }
  setValue(position, value) {
    this._dataBuffer[position] = value;
  }
  getDefaultData() {
    return new Float64Array(VirtualBox._data.size);
  }
  getPosition(coord, point) {
    const coordPosition = VirtualBox._data[point][coord];
    return coordPosition + this._dataPosition;
  }
  save(coord, point, first, second) {
    const position = this.getPosition(coord, point);
    const data1 = first.get(coord, point);
    const data2 = second.get(coord, point);
    const result = Math[point](data1, data2);
    this.setValue(position, result);
  }
}
export {
  VirtualBox
};
//# sourceMappingURL=virtual-box.mjs.map
