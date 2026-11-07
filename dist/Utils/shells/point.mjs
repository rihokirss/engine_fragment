import { GeomsFbUtils } from "./index.mjs";
class Point {
  x;
  y;
  z;
  hash;
  id;
  constructor(vertices, index, id, precision) {
    this.x = GeomsFbUtils.round(vertices[index * 3], precision);
    this.y = GeomsFbUtils.round(vertices[index * 3 + 1], precision);
    this.z = GeomsFbUtils.round(vertices[index * 3 + 2], precision);
    this.hash = `${this.x}/${this.y}/${this.z}`;
    this.id = id;
  }
}
export {
  Point
};
//# sourceMappingURL=point.mjs.map
