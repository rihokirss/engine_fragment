class Material {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  r() {
    return this.bb.readUint8(this.bb_pos);
  }
  mutate_r(value) {
    this.bb.writeUint8(this.bb_pos + 0, value);
    return true;
  }
  g() {
    return this.bb.readUint8(this.bb_pos + 1);
  }
  mutate_g(value) {
    this.bb.writeUint8(this.bb_pos + 1, value);
    return true;
  }
  b() {
    return this.bb.readUint8(this.bb_pos + 2);
  }
  mutate_b(value) {
    this.bb.writeUint8(this.bb_pos + 2, value);
    return true;
  }
  a() {
    return this.bb.readUint8(this.bb_pos + 3);
  }
  mutate_a(value) {
    this.bb.writeUint8(this.bb_pos + 3, value);
    return true;
  }
  renderedFaces() {
    return this.bb.readInt8(this.bb_pos + 4);
  }
  mutate_rendered_faces(value) {
    this.bb.writeInt8(this.bb_pos + 4, value);
    return true;
  }
  stroke() {
    return this.bb.readInt8(this.bb_pos + 5);
  }
  mutate_stroke(value) {
    this.bb.writeInt8(this.bb_pos + 5, value);
    return true;
  }
  static sizeOf() {
    return 6;
  }
  static createMaterial(builder, r, g, b, a, rendered_faces, stroke) {
    builder.prep(1, 6);
    builder.writeInt8(stroke);
    builder.writeInt8(rendered_faces);
    builder.writeInt8(a);
    builder.writeInt8(b);
    builder.writeInt8(g);
    builder.writeInt8(r);
    return builder.offset();
  }
}
export {
  Material
};
//# sourceMappingURL=material.mjs.map
