function isRawBuffer(bytes) {
  if (bytes.length < 2) return true;
  const isDeflateMethod = (bytes[0] & 15) === 8;
  const headerIsMultipleOf31 = (bytes[0] << 8 | bytes[1]) % 31 === 0;
  return !(isDeflateMethod && headerIsMultipleOf31);
}
export {
  isRawBuffer
};
//# sourceMappingURL=buffer.mjs.map
