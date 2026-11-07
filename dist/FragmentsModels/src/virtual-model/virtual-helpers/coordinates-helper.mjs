class CoordinatesHelper {
  getPositions(model, localIds) {
    const positions = [];
    const itemIds = model.properties.getItemIdsFromLocalIds(localIds);
    for (const id of itemIds) {
      const transform = model.tiles.meshes.globalTransforms(id);
      if (!transform) {
        continue;
      }
      const position = transform.position();
      const x = position.x();
      const y = position.y();
      const z = position.z();
      positions.push({ x, y, z });
    }
    return positions;
  }
  getCoordinates(model) {
    const meshes = model.data.meshes();
    const coords = meshes.coordinates();
    const position = coords.position();
    const xDir = coords.xDirection();
    const yDir = coords.yDirection();
    const x = position.x();
    const y = position.y();
    const z = position.z();
    const xx = xDir.x();
    const xy = xDir.y();
    const xz = xDir.z();
    const yx = yDir.x();
    const yy = yDir.y();
    const yz = yDir.z();
    return [
      x,
      y,
      z,
      xx,
      xy,
      xz,
      yx,
      yy,
      yz
    ];
  }
}
export {
  CoordinatesHelper
};
//# sourceMappingURL=coordinates-helper.mjs.map
