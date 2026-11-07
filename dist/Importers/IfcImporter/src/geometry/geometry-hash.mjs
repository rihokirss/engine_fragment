import e from "../../../../vendor/xxhash-wasm/esm/xxhash-wasm.mjs";
class Hasher {
  static async init() {
    return new this(await e());
  }
  hasher;
  constructor(hasher) {
    this.hasher = hasher;
  }
  /**
   * Folds a buffer of coordinates into a single 64-bit key, so that geometry
   * differing only in where its vertices sit hashes differently.
   *
   * Values are quantized to `1 / precision` before hashing, which is what lets
   * float noise from the tessellator collapse while genuinely distinct positions
   * stay apart. They are then hashed as raw bytes rather than as numbers, so
   * neither sign nor magnitude needs any special handling.
   *
   * The fold is order-sensitive: `[1, 2, 3]` and `[3, 2, 1]` hash differently,
   * which is the point - summing could not tell them apart. The tradeoff is that
   * two buffers holding the same values in a different order are treated as
   * different geometry.
   *
   * @param coordinates The values to fold, e.g. a flat XYZ position buffer.
   * @param precision How finely to round before hashing, e.g. `10000` rounds
   * to the nearest 1/10000.
   * @returns An unsigned 64-bit integer.
   */
  hashCoordinates(coordinates, precision) {
    const quantized = new Int32Array(coordinates.length);
    for (let i = 0; i < coordinates.length; i++) {
      quantized[i] = Math.round(coordinates[i] * precision);
    }
    return this.hasher.h64Raw(new Uint8Array(quantized.buffer));
  }
}
export {
  Hasher
};
//# sourceMappingURL=geometry-hash.mjs.map
