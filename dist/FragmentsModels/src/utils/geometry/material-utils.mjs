import { RenderedFaces } from "../../../../Schema/rendered-faces.mjs";
class MaterialUtils {
  static isSame(a, b) {
    return this.getKey(a) === this.getKey(b);
  }
  /** Returns a stable key including rendering and inheritance semantics. */
  static getKey(material) {
    const { color, _explicitProps, ...properties } = material;
    if (!material.preserveOriginalMaterial) {
      properties.opacity ??= 1;
      properties.renderedFaces ??= RenderedFaces.ONE;
    }
    return JSON.stringify([
      color && [color.r, color.g, color.b, color.isColor === true],
      [...new Set(_explicitProps ?? [])].sort(),
      Object.entries(properties).filter(([, value]) => value !== void 0).sort(([a], [b]) => a.localeCompare(b))
    ]);
  }
}
export {
  MaterialUtils
};
//# sourceMappingURL=material-utils.mjs.map
