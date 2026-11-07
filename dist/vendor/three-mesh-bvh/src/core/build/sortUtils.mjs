function partition(buffer, stride, primitiveBounds, offset, count, split) {
  let left = offset;
  let right = offset + count - 1;
  const pos = split.pos;
  const axisOffset = split.axis * 2;
  const boundsOffset = primitiveBounds.offset || 0;
  while (true) {
    while (left <= right && primitiveBounds[(left - boundsOffset) * 6 + axisOffset] < pos) {
      left++;
    }
    while (left <= right && primitiveBounds[(right - boundsOffset) * 6 + axisOffset] >= pos) {
      right--;
    }
    if (left < right) {
      for (let i = 0; i < stride; i++) {
        let t0 = buffer[left * stride + i];
        buffer[left * stride + i] = buffer[right * stride + i];
        buffer[right * stride + i] = t0;
      }
      for (let i = 0; i < 6; i++) {
        const l = left - boundsOffset;
        const r = right - boundsOffset;
        const tb = primitiveBounds[l * 6 + i];
        primitiveBounds[l * 6 + i] = primitiveBounds[r * 6 + i];
        primitiveBounds[r * 6 + i] = tb;
      }
      left++;
      right--;
    } else {
      return left;
    }
  }
}
export {
  partition
};
//# sourceMappingURL=sortUtils.mjs.map
