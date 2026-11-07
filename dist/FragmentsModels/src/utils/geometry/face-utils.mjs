class FaceUtils {
  static getEarcutDimensions(normal) {
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);
    const xDim = 0;
    const yDim = 1;
    const zDim = 2;
    const isMostlyHorizontal = absZ >= absX && absZ >= absY;
    if (isMostlyHorizontal) {
      const lookingUp = normal.z > 0;
      if (lookingUp) {
        return [xDim, yDim];
      }
      return [yDim, xDim];
    }
    const isMostlyLookingToY = absY >= absX && absY >= absZ;
    if (isMostlyLookingToY) {
      const isLookingYPositive = normal.y > 0;
      if (isLookingYPositive) {
        return [zDim, xDim];
      }
      return [xDim, zDim];
    }
    const isLookingXPositive = normal.x > 0;
    if (isLookingXPositive) {
      return [yDim, zDim];
    }
    return [zDim, yDim];
  }
}
export {
  FaceUtils
};
//# sourceMappingURL=face-utils.mjs.map
