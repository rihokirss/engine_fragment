class FloatVector {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  x() {
    return this.bb.readFloat32(this.bb_pos);
  }
  mutate_x(value) {
    this.bb.writeFloat32(this.bb_pos + 0, value);
    return true;
  }
  y() {
    return this.bb.readFloat32(this.bb_pos + 4);
  }
  mutate_y(value) {
    this.bb.writeFloat32(this.bb_pos + 4, value);
    return true;
  }
  z() {
    return this.bb.readFloat32(this.bb_pos + 8);
  }
  mutate_z(value) {
    this.bb.writeFloat32(this.bb_pos + 8, value);
    return true;
  }
  static sizeOf() {
    return 12;
  }
  static createFloatVector(builder, x, y, z) {
    builder.prep(4, 12);
    builder.writeFloat32(z);
    builder.writeFloat32(y);
    builder.writeFloat32(x);
    return builder.offset();
  }
}
export {
  FloatVector
};
//# sourceMappingURL=float-vector.mjs.map
