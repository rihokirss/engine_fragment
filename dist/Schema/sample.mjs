class Sample {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  item() {
    return this.bb.readUint32(this.bb_pos);
  }
  mutate_item(value) {
    this.bb.writeUint32(this.bb_pos + 0, value);
    return true;
  }
  material() {
    return this.bb.readUint32(this.bb_pos + 4);
  }
  mutate_material(value) {
    this.bb.writeUint32(this.bb_pos + 4, value);
    return true;
  }
  representation() {
    return this.bb.readUint32(this.bb_pos + 8);
  }
  mutate_representation(value) {
    this.bb.writeUint32(this.bb_pos + 8, value);
    return true;
  }
  localTransform() {
    return this.bb.readUint32(this.bb_pos + 12);
  }
  mutate_local_transform(value) {
    this.bb.writeUint32(this.bb_pos + 12, value);
    return true;
  }
  static sizeOf() {
    return 16;
  }
  static createSample(builder, item, material, representation, local_transform) {
    builder.prep(4, 16);
    builder.writeInt32(local_transform);
    builder.writeInt32(representation);
    builder.writeInt32(material);
    builder.writeInt32(item);
    return builder.offset();
  }
}
export {
  Sample
};
//# sourceMappingURL=sample.mjs.map
