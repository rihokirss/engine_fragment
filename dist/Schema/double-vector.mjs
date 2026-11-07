class DoubleVector {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  x() {
    return this.bb.readFloat64(this.bb_pos);
  }
  mutate_x(value) {
    this.bb.writeFloat64(this.bb_pos + 0, value);
    return true;
  }
  y() {
    return this.bb.readFloat64(this.bb_pos + 8);
  }
  mutate_y(value) {
    this.bb.writeFloat64(this.bb_pos + 8, value);
    return true;
  }
  z() {
    return this.bb.readFloat64(this.bb_pos + 16);
  }
  mutate_z(value) {
    this.bb.writeFloat64(this.bb_pos + 16, value);
    return true;
  }
  static sizeOf() {
    return 24;
  }
  static createDoubleVector(builder, x, y, z) {
    builder.prep(8, 24);
    builder.writeFloat64(z);
    builder.writeFloat64(y);
    builder.writeFloat64(x);
    return builder.offset();
  }
}
export {
  DoubleVector
};
//# sourceMappingURL=double-vector.mjs.map
