class CRCData {
  int;
  float;
  buffer;
  s1 = 4;
  s2 = 8;
  constructor() {
    const { intBuffer, floatBuffer, buffer } = this.newBuffers();
    this.int = intBuffer;
    this.float = floatBuffer;
    this.buffer = buffer;
  }
  newBuffers() {
    const intBuffer = new Int32Array(1);
    const data = intBuffer.buffer;
    const floatBuffer = new Float32Array(data);
    const buffer = new Uint8Array(data);
    return { intBuffer, floatBuffer, buffer };
  }
}
export {
  CRCData
};
//# sourceMappingURL=crc-data.mjs.map
