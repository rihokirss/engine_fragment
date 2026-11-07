import { SIZE_PREFIX_LENGTH } from "../vendor/flatbuffers/mjs/constants.mjs";
import "../vendor/flatbuffers/mjs/utils.mjs";
import "../vendor/flatbuffers/mjs/encoding.mjs";
import { FloatVector } from "./float-vector.mjs";
class WireSet {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  static getRootAsWireSet(bb, obj) {
    return (obj || new WireSet()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  static getSizePrefixedRootAsWireSet(bb, obj) {
    bb.setPosition(bb.position() + SIZE_PREFIX_LENGTH);
    return (obj || new WireSet()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }
  ps(index, obj) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? (obj || new FloatVector()).__init(this.bb.__vector(this.bb_pos + offset) + index * 12, this.bb) : null;
  }
  psLength() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
  }
  static startWireSet(builder) {
    builder.startObject(1);
  }
  static addPs(builder, psOffset) {
    builder.addFieldOffset(0, psOffset, 0);
  }
  static startPsVector(builder, numElems) {
    builder.startVector(12, numElems, 4);
  }
  static endWireSet(builder) {
    const offset = builder.endObject();
    return offset;
  }
  static createWireSet(builder, psOffset) {
    WireSet.startWireSet(builder);
    WireSet.addPs(builder, psOffset);
    return WireSet.endWireSet(builder);
  }
}
export {
  WireSet
};
//# sourceMappingURL=wire-set.mjs.map
