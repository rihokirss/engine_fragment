import { CurrentLod } from "../../model/model-types.mjs";
class GeometryHelper {
  getGeometriesLength(model) {
    return model.data.meshes().globalTransformsLength();
  }
  getSampleGeometry(model, itemIndex, lod) {
    const sampleIndices = model.boxes.sampleOf(itemIndex);
    const result = [];
    if (!sampleIndices) return result;
    const meshes = model.data.meshes();
    for (const sampleIndex of sampleIndices) {
      const sample = model.tiles.fetchSample(sampleIndex, lod);
      const sampleId = meshes.sampleIds(sampleIndex);
      const geometries = Array.isArray(sample.geometries) ? sample.geometries : [sample.geometries];
      const sampleData = meshes.samples(sampleIndex);
      const localIdIndex = meshes.meshesItems(sampleData.item());
      const localId = model.data.localIds(localIdIndex);
      for (const geometry of geometries) {
        const pos = lod === CurrentLod.GEOMETRY ? geometry.positionBuffer : new Float32Array(geometry.positionBuffer);
        result.push({
          transform: sample.transform.clone(),
          indices: geometry.indexBuffer,
          positions: pos,
          normals: geometry.normalBuffer,
          sampleId,
          localId,
          representationId: sample.representationId
        });
      }
    }
    return result;
  }
  getVolume(model, id) {
    let volume = 0;
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: 0, y: 0, z: 0 };
    const p3 = { x: 0, y: 0, z: 0 };
    const geometries = this.getSampleGeometry(model, id, CurrentLod.GEOMETRY);
    for (const { indices, positions } of geometries) {
      if (!(indices && positions)) continue;
      for (let i = 0; i < indices.length - 2; i += 3) {
        const i1 = indices[i] * 3;
        const i2 = indices[i + 1] * 3;
        const i3 = indices[i + 2] * 3;
        p1.x = positions[i1];
        p1.y = positions[i1 + 1];
        p1.z = positions[i1 + 2];
        p2.x = positions[i2];
        p2.y = positions[i2 + 1];
        p2.z = positions[i2 + 2];
        p3.x = positions[i3];
        p3.y = positions[i3 + 1];
        p3.z = positions[i3 + 2];
        volume += this.getSignedVolumeOfTriangle(p1, p2, p3);
      }
    }
    return Math.abs(volume);
  }
  getSignedVolumeOfTriangle(p1, p2, p3) {
    const v321 = p3.x * p2.y * p1.z;
    const v231 = p2.x * p3.y * p1.z;
    const v312 = p3.x * p1.y * p2.z;
    const v132 = p1.x * p3.y * p2.z;
    const v213 = p2.x * p1.y * p3.z;
    const v123 = p1.x * p2.y * p3.z;
    return 1 / 6 * (-v321 + v231 + v312 - v132 - v213 + v123);
  }
}
export {
  GeometryHelper
};
//# sourceMappingURL=geometry-helper.mjs.map
