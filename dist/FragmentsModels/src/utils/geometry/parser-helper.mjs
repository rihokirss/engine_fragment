import * as THREE from "three";
import { DoubleVector } from "../../../../Schema/double-vector.mjs";
import { FloatVector } from "../../../../Schema/float-vector.mjs";
import { MiscHelper } from "../misc/misc-helper.mjs";
class ParserHelper {
  static _temp = {
    position: new THREE.Vector3(),
    xDirection: new THREE.Vector3(),
    yDirection: new THREE.Vector3(),
    zDirection: new THREE.Vector3()
  };
  static _doubleVector = new DoubleVector();
  static _floatVector = new FloatVector();
  static parseMaterial(material) {
    const r = material.r() / 255;
    const g = material.g() / 255;
    const b = material.b() / 255;
    const opacity = material.a() / 255;
    const transparent = material.a() < 255;
    const color = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    const renderedFaces = material.renderedFaces();
    return {
      color,
      renderedFaces,
      opacity,
      transparent,
      localId: void 0
    };
  }
  static parseBox(data, box) {
    this.getBox(data, box, "min");
    this.getBox(data, box, "max");
  }
  static parseTransform(transform, result) {
    this.getVector(transform, "position", this._doubleVector);
    this.getVector(transform, "xDirection", this._floatVector);
    this.getVector(transform, "yDirection", this._floatVector);
    this.computeZVector();
    this.setTransform(result);
    return result;
  }
  static setTransform(result) {
    const { x: xx, y: xy, z: xz } = this._temp.xDirection;
    const { x: yx, y: yy, z: yz } = this._temp.yDirection;
    const { x: zx, y: zy, z: zz } = this._temp.zDirection;
    const { x: ox, y: oy, z: oz } = this._temp.position;
    result.set(
      xx,
      yx,
      zx,
      ox,
      xy,
      yy,
      zy,
      oy,
      xz,
      yz,
      zz,
      oz,
      0,
      0,
      0,
      1
    );
  }
  static getBox(data, box, point) {
    data[point](this._floatVector);
    const x = this._floatVector.x();
    const y = this._floatVector.y();
    const z = this._floatVector.z();
    box[point].x = MiscHelper.fixNumber(x);
    box[point].y = MiscHelper.fixNumber(y);
    box[point].z = MiscHelper.fixNumber(z);
  }
  static getVector(transform, name, vector) {
    transform[name](vector);
    const parsed = this._temp[name];
    const x = vector.x();
    const y = vector.y();
    const z = vector.z();
    parsed.x = MiscHelper.fixNumber(x);
    parsed.y = MiscHelper.fixNumber(y);
    parsed.z = MiscHelper.fixNumber(z);
  }
  static computeZVector() {
    this._temp.zDirection.crossVectors(
      this._temp.xDirection,
      this._temp.yDirection
    );
  }
}
export {
  ParserHelper
};
//# sourceMappingURL=parser-helper.mjs.map
