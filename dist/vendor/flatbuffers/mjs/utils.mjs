const int32 = new Int32Array(2);
const float32 = new Float32Array(int32.buffer);
const float64 = new Float64Array(int32.buffer);
const isLittleEndian = new Uint16Array(new Uint8Array([1, 0]).buffer)[0] === 1;
export {
  float32,
  float64,
  int32,
  isLittleEndian
};
//# sourceMappingURL=utils.mjs.map
