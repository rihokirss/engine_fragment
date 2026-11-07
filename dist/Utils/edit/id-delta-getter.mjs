import { EditRequestType } from "./edit-types.mjs";
import { EditUtils } from "./edit-utils.mjs";
import { RepresentationClass } from "../../Schema/representation-class.mjs";
function getIdsDelta(model, requests) {
  const itemIds = /* @__PURE__ */ new Set();
  const globalTranforms = /* @__PURE__ */ new Set();
  const localTransforms = /* @__PURE__ */ new Set();
  const samples = /* @__PURE__ */ new Set();
  const materials = /* @__PURE__ */ new Set();
  const representations = /* @__PURE__ */ new Set();
  const shells = /* @__PURE__ */ new Set();
  const circleExtrusions = /* @__PURE__ */ new Set();
  let createNewSample = false;
  let detaDeletedGtsCount = 0;
  let detaDeletedLtsCount = 0;
  let detaDeletedSamplesCount = 0;
  let detaDeletedMaterialsCount = 0;
  let detaDeletedRepresentationsCount = 0;
  let detaDeletedShellsCount = 0;
  let detaDeletedCircleExtrusionsCount = 0;
  const deletedSamples = /* @__PURE__ */ new Set();
  const samplesGtIds = /* @__PURE__ */ new Set();
  const samplesLtIds = /* @__PURE__ */ new Set();
  const samplesMaterialIds = /* @__PURE__ */ new Set();
  const samplesRepIds = /* @__PURE__ */ new Set();
  const samplesSamplesIds = /* @__PURE__ */ new Set();
  const samplesItemsIds = /* @__PURE__ */ new Set();
  const meshes = model.meshes();
  const prevGts = new Set(meshes.globalTransformIdsArray());
  const prevLts = new Set(meshes.localTransformIdsArray());
  const prevMaterials = new Set(meshes.materialIdsArray());
  const prevRepresentations = new Set(meshes.representationIdsArray());
  const prevItems = new Set(model.localIdsArray());
  const prevSamples = new Set(meshes.sampleIdsArray());
  const createdSamplesIds = /* @__PURE__ */ new Set();
  for (const request of requests) {
    if (request.type === EditRequestType.CREATE_SAMPLE) {
      createNewSample = true;
    }
    if (request.type === EditRequestType.UPDATE_LOCAL_TRANSFORM) {
      localTransforms.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_MATERIAL) {
      materials.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_REPRESENTATION) {
      representations.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_ITEM) {
      itemIds.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.CREATE_GLOBAL_TRANSFORM) {
      if (prevItems.has(request.data.itemId)) {
        itemIds.add(request.data.itemId);
      }
      continue;
    }
    if (request.type === EditRequestType.UPDATE_GLOBAL_TRANSFORM) {
      globalTranforms.add(request.localId);
      if (prevItems.has(request.data.itemId)) {
        itemIds.add(request.data.itemId);
      }
      continue;
    }
    if (request.type === EditRequestType.UPDATE_SAMPLE) {
      if (!createdSamplesIds.has(request.localId)) {
        samples.add(request.localId);
      }
      if (prevGts.has(request.data.item)) {
        globalTranforms.add(request.data.item);
      }
      if (prevLts.has(request.data.localTransform)) {
        samplesLtIds.add(request.data.localTransform);
      }
      if (prevMaterials.has(request.data.material)) {
        samplesMaterialIds.add(request.data.material);
      }
      if (prevRepresentations.has(request.data.representation)) {
        samplesRepIds.add(request.data.representation);
      }
      continue;
    }
    if (request.type === EditRequestType.CREATE_SAMPLE) {
      createdSamplesIds.add(request.localId);
      if (prevGts.has(request.data.item)) {
        globalTranforms.add(request.data.item);
      }
      if (prevLts.has(request.data.localTransform)) {
        samplesLtIds.add(request.data.localTransform);
      }
      if (prevMaterials.has(request.data.material)) {
        samplesMaterialIds.add(request.data.material);
      }
      if (prevRepresentations.has(request.data.representation)) {
        samplesRepIds.add(request.data.representation);
      }
      continue;
    }
  }
  const deletedRepsIds = /* @__PURE__ */ new Set();
  for (const request of requests) {
    if (request.type === EditRequestType.DELETE_GLOBAL_TRANSFORM) {
      globalTranforms.delete(request.localId);
      if (!prevGts.has(request.localId)) {
        detaDeletedGtsCount++;
      }
      continue;
    }
    if (request.type === EditRequestType.DELETE_LOCAL_TRANSFORM) {
      localTransforms.delete(request.localId);
      if (!prevLts.has(request.localId)) {
        detaDeletedLtsCount++;
      }
      continue;
    }
    if (request.type === EditRequestType.DELETE_SAMPLE) {
      samples.delete(request.localId);
      deletedSamples.add(request.localId);
      if (!prevSamples.has(request.localId)) {
        detaDeletedSamplesCount++;
      }
      continue;
    }
    if (request.type === EditRequestType.DELETE_MATERIAL) {
      materials.delete(request.localId);
      if (!prevMaterials.has(request.localId)) {
        detaDeletedMaterialsCount++;
      }
      continue;
    }
    if (request.type === EditRequestType.DELETE_REPRESENTATION) {
      representations.delete(request.localId);
      deletedRepsIds.add(request.localId);
      if (!prevRepresentations.has(request.localId)) {
        detaDeletedRepresentationsCount++;
      }
      continue;
    }
    if (request.type === EditRequestType.DELETE_ITEM) {
      itemIds.delete(request.localId);
      continue;
    }
  }
  const deletedReprs = EditUtils.getRepresentations(model, deletedRepsIds);
  for (const [id, repr] of deletedReprs) {
    if (prevRepresentations.has(id)) continue;
    if (repr.representationClass === RepresentationClass.SHELL) {
      detaDeletedShellsCount++;
    } else if (repr.representationClass === RepresentationClass.CIRCLE_EXTRUSION) {
      detaDeletedCircleExtrusionsCount++;
    } else {
      throw new Error("Unsupported representation class");
    }
  }
  for (const request of requests) {
    if (request.type === EditRequestType.CREATE_REPRESENTATION) {
      if (deletedRepsIds.has(request.localId)) {
        if (request.data.representationClass === RepresentationClass.SHELL) {
          detaDeletedShellsCount++;
        } else if (request.data.representationClass === RepresentationClass.CIRCLE_EXTRUSION) {
          detaDeletedCircleExtrusionsCount++;
        } else {
          throw new Error("Unsupported representation class");
        }
      }
    }
  }
  for (let i = 0; i < meshes.samplesLength(); i++) {
    const sample = meshes.samples(i);
    const gtIndex = sample.item();
    const ltIndex = sample.localTransform();
    const materialIndex = sample.material();
    const repIndex = sample.representation();
    const gtId = meshes.globalTransformIds(gtIndex);
    const ltId = meshes.localTransformIds(ltIndex);
    const materialId = meshes.materialIds(materialIndex);
    const repId = meshes.representationIds(repIndex);
    const itemIndex = meshes.meshesItems(gtIndex);
    const itemId = model.localIds(itemIndex);
    if (globalTranforms.has(gtId) || localTransforms.has(ltId) || materials.has(materialId) || representations.has(repId) || itemIds.has(itemId)) {
      if (prevItems.has(itemId)) {
        itemIds.add(itemId);
      }
    }
  }
  for (let i = 0; i < meshes.samplesLength(); i++) {
    const sampleId = meshes.sampleIds(i);
    if (deletedSamples.has(sampleId)) {
      continue;
    }
    const sample = meshes.samples(i);
    const gtIndex = sample.item();
    const ltIndex = sample.localTransform();
    const materialIndex = sample.material();
    const repIndex = sample.representation();
    const gtId = meshes.globalTransformIds(gtIndex);
    const ltId = meshes.localTransformIds(ltIndex);
    const materialId = meshes.materialIds(materialIndex);
    const repId = meshes.representationIds(repIndex);
    const itemIndex = meshes.meshesItems(gtIndex);
    const itemId = model.localIds(itemIndex);
    if (globalTranforms.has(gtId) || localTransforms.has(ltId) || materials.has(materialId) || representations.has(repId) || itemIds.has(itemId)) {
      if (prevGts.has(gtId)) {
        samplesGtIds.add(gtId);
      }
      if (prevLts.has(ltId)) {
        samplesLtIds.add(ltId);
      }
      if (prevMaterials.has(materialId)) {
        samplesMaterialIds.add(materialId);
      }
      if (prevRepresentations.has(repId)) {
        samplesRepIds.add(repId);
      }
      if (prevItems.has(itemId)) {
        samplesItemsIds.add(itemId);
      }
      samplesSamplesIds.add(sampleId);
    }
  }
  prevGts.clear();
  prevLts.clear();
  prevMaterials.clear();
  prevRepresentations.clear();
  prevItems.clear();
  prevSamples.clear();
  for (const id of samplesGtIds) {
    globalTranforms.add(id);
  }
  for (const id of samplesLtIds) {
    localTransforms.add(id);
  }
  for (const id of samplesMaterialIds) {
    materials.add(id);
  }
  for (const id of samplesRepIds) {
    representations.add(id);
  }
  for (const id of samplesSamplesIds) {
    samples.add(id);
  }
  for (const id of samplesItemsIds) {
    itemIds.add(id);
  }
  samplesGtIds.clear();
  samplesLtIds.clear();
  samplesMaterialIds.clear();
  samplesRepIds.clear();
  samplesSamplesIds.clear();
  samplesItemsIds.clear();
  const indices = EditUtils.getGeometryIndicesFromRepresentations(
    model,
    representations
  );
  for (const index of indices.shellsIndices) {
    shells.add(index);
  }
  for (const index of indices.rebarsIndices) {
    circleExtrusions.add(index);
  }
  return {
    itemIds,
    globalTranforms,
    localTransforms,
    samples,
    materials,
    representations,
    shells,
    // Indices
    circleExtrusions,
    // Indices
    detaDeletedGts: detaDeletedGtsCount,
    detaDeletedLts: detaDeletedLtsCount,
    detaDeletedSamples: detaDeletedSamplesCount,
    detaDeletedMaterials: detaDeletedMaterialsCount,
    detaDeletedRepresentations: detaDeletedRepresentationsCount,
    detaDeletedShells: detaDeletedShellsCount,
    detaDeletedCircleExtrusions: detaDeletedCircleExtrusionsCount,
    createNewSample
  };
}
export {
  getIdsDelta
};
//# sourceMappingURL=id-delta-getter.mjs.map
