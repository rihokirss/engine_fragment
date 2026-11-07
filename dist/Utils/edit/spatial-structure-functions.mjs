import { SpatialStructure } from "../../Schema/spatial-structure.mjs";
function copySpatialStructure(builder, spatialStructure) {
  if (!spatialStructure) return null;
  const childrenLength = spatialStructure.childrenLength();
  const childrenOffsets = [];
  for (let i = 0; i < childrenLength; i++) {
    const current = spatialStructure.children(i);
    const childOffset = copySpatialStructure(builder, current);
    if (childOffset === null) continue;
    childrenOffsets.push(childOffset);
  }
  const childrenOffset = SpatialStructure.createChildrenVector(
    builder,
    childrenOffsets
  );
  const localId = spatialStructure.localId();
  const category = spatialStructure.category();
  if (localId !== null) {
    SpatialStructure.startSpatialStructure(builder);
    SpatialStructure.addLocalId(builder, localId);
    SpatialStructure.addChildren(builder, childrenOffset);
    return SpatialStructure.endSpatialStructure(builder);
  }
  if (category !== null) {
    const categoryOffset = builder.createSharedString(category);
    SpatialStructure.startSpatialStructure(builder);
    SpatialStructure.addCategory(builder, categoryOffset);
    SpatialStructure.addChildren(builder, childrenOffset);
    return SpatialStructure.endSpatialStructure(builder);
  }
  throw new Error("Spatial structure must have a local id or a category");
}
function createSpatialStructure(builder, spatialStructure) {
  const children = spatialStructure.children ?? [];
  const childrenLength = children ? children.length : 0;
  const childrenOffsets = [];
  for (let i = 0; i < childrenLength; i++) {
    const current = children[i];
    const childOffset = createSpatialStructure(builder, current);
    if (childOffset === null) continue;
    childrenOffsets.push(childOffset);
  }
  const childrenOffset = SpatialStructure.createChildrenVector(
    builder,
    childrenOffsets
  );
  const localId = spatialStructure.localId;
  const category = spatialStructure.category;
  if (localId !== null) {
    SpatialStructure.startSpatialStructure(builder);
    SpatialStructure.addLocalId(builder, localId);
    SpatialStructure.addChildren(builder, childrenOffset);
    return SpatialStructure.endSpatialStructure(builder);
  }
  if (category !== null) {
    const categoryOffset = builder.createSharedString(category);
    SpatialStructure.startSpatialStructure(builder);
    SpatialStructure.addCategory(builder, categoryOffset);
    SpatialStructure.addChildren(builder, childrenOffset);
    return SpatialStructure.endSpatialStructure(builder);
  }
  throw new Error("Spatial structure must have a local id or a category");
}
export {
  copySpatialStructure,
  createSpatialStructure
};
//# sourceMappingURL=spatial-structure-functions.mjs.map
