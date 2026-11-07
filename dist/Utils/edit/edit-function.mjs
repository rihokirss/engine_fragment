import "../../vendor/flatbuffers/mjs/utils.mjs";
import "../../vendor/flatbuffers/mjs/encoding.mjs";
import { Builder } from "../../vendor/flatbuffers/mjs/builder.mjs";
import pako from "../../vendor/pako/dist/pako.esm.mjs";
import { EditRequestType } from "./edit-types.mjs";
import { createTransform, copyTransform } from "./transfom-functions.mjs";
import { createShell, copyShell } from "./shell-functions.mjs";
import { createCircleExtrusion, copyCircleExtrusion } from "./circle-extrusion-functions.mjs";
import { createSpatialStructure, copySpatialStructure } from "./spatial-structure-functions.mjs";
import { buildSample } from "./sample-functions.mjs";
import { copyIndex, buildIndex } from "./index-functions.mjs";
import { getIdsDelta } from "./id-delta-getter.mjs";
import { newModel } from "./new-model-function.mjs";
import { EditUtils } from "./edit-utils.mjs";
import { RepresentationClass } from "../../Schema/representation-class.mjs";
import { Meshes } from "../../Schema/meshes.mjs";
import { Representation } from "../../Schema/representation.mjs";
import { Material } from "../../Schema/material.mjs";
import { Attribute } from "../../Schema/attribute.mjs";
import { Model } from "../../Schema/model.mjs";
import { Relation } from "../../Schema/relation.mjs";
function getAffectedItems(requests, editedSamples, meshes, model, affectedItems) {
  for (const request of requests) {
    if (request.type === EditRequestType.UPDATE_SAMPLE || request.type === EditRequestType.DELETE_SAMPLE) {
      editedSamples.add(request.localId);
    }
  }
  for (let i = 0; i < meshes.sampleIdsLength(); i++) {
    const sampleId = meshes.sampleIds(i);
    if (editedSamples.has(sampleId)) {
      const sample = meshes.samples(i);
      const itemIndex = sample.item();
      const ltIndex = meshes.meshesItems(itemIndex);
      const localId = model.localIds(ltIndex);
      affectedItems.add(localId);
    }
  }
}
function edit(model, requests, config) {
  const meshes = model.meshes();
  const raw = config?.raw ?? false;
  const delta = config?.delta ?? false;
  let deltaItemIds = /* @__PURE__ */ new Set();
  let deltaGts = /* @__PURE__ */ new Set();
  let deltaLts = /* @__PURE__ */ new Set();
  let deltaSamples = /* @__PURE__ */ new Set();
  let deltaMaterials = /* @__PURE__ */ new Set();
  let deltaReps = /* @__PURE__ */ new Set();
  let deltaShells = /* @__PURE__ */ new Set();
  let deltaCircleExtrusions = /* @__PURE__ */ new Set();
  let deltaDeletedGts = 0;
  let deltaDeletedLts = 0;
  let deltaDeletedSamples = 0;
  let deltaDeletedMaterials = 0;
  let deltaDeletedRepresentations = 0;
  let deltaDeletedShells = 0;
  let deltaDeletedCircleExtrusions = 0;
  if (delta) {
    const itemsToInclude = getIdsDelta(model, requests);
    deltaItemIds = itemsToInclude.itemIds;
    deltaGts = itemsToInclude.globalTranforms;
    deltaLts = itemsToInclude.localTransforms;
    deltaSamples = itemsToInclude.samples;
    deltaMaterials = itemsToInclude.materials;
    deltaReps = itemsToInclude.representations;
    deltaShells = itemsToInclude.shells;
    deltaCircleExtrusions = itemsToInclude.circleExtrusions;
    deltaDeletedGts = itemsToInclude.detaDeletedGts;
    deltaDeletedLts = itemsToInclude.detaDeletedLts;
    deltaDeletedSamples = itemsToInclude.detaDeletedSamples;
    deltaDeletedMaterials = itemsToInclude.detaDeletedMaterials;
    deltaDeletedRepresentations = itemsToInclude.detaDeletedRepresentations;
    deltaDeletedShells = itemsToInclude.detaDeletedShells;
    deltaDeletedCircleExtrusions = itemsToInclude.detaDeletedCircleExtrusions;
    const createNewSample = itemsToInclude.createNewSample;
    if (!createNewSample && deltaItemIds.size === 0 && deltaGts.size === 0 && deltaLts.size === 0 && deltaSamples.size === 0 && deltaMaterials.size === 0 && deltaReps.size === 0 && deltaShells.size === 0 && deltaCircleExtrusions.size === 0) {
      const affectedItems2 = /* @__PURE__ */ new Set();
      const editedSamples2 = /* @__PURE__ */ new Set();
      getAffectedItems(requests, editedSamples2, meshes, model, affectedItems2);
      return { model: newModel({ raw }), items: Array.from(affectedItems2) };
    }
  }
  const matsToUpdate = /* @__PURE__ */ new Map();
  const reprsToUpdate = /* @__PURE__ */ new Map();
  const samplesToUpdate = /* @__PURE__ */ new Map();
  const gtsToUpdate = /* @__PURE__ */ new Map();
  const ltsToUpdate = /* @__PURE__ */ new Map();
  const shellsToUpdate = /* @__PURE__ */ new Map();
  const circleExtrusionsToUpdate = /* @__PURE__ */ new Map();
  const itemsToUpdate = /* @__PURE__ */ new Map();
  const relationsToUpdate = /* @__PURE__ */ new Map();
  let metadataToUpdate = null;
  let spatialStructureToUpdate = null;
  const matsToCreate = /* @__PURE__ */ new Map();
  const reprsToCreate = /* @__PURE__ */ new Map();
  const shellsToCreate = /* @__PURE__ */ new Map();
  const circleExtrusionsToCreate = /* @__PURE__ */ new Map();
  const samplesToCreate = /* @__PURE__ */ new Map();
  const gtsToCreate = /* @__PURE__ */ new Map();
  const ltsToCreate = /* @__PURE__ */ new Map();
  const itemsToCreate = /* @__PURE__ */ new Map();
  const relationsToCreate = /* @__PURE__ */ new Map();
  const matsToDelete = /* @__PURE__ */ new Set();
  const samplesToDelete = /* @__PURE__ */ new Set();
  const reprsToDelete = /* @__PURE__ */ new Set();
  const shellsToDelete = /* @__PURE__ */ new Set();
  const circleExtrusionsToDelete = /* @__PURE__ */ new Set();
  const gtsToDelete = /* @__PURE__ */ new Set();
  const ltsToDelete = /* @__PURE__ */ new Set();
  const itemsToDelete = /* @__PURE__ */ new Set();
  const relationsToDelete = /* @__PURE__ */ new Set();
  const indexesToUpsert = /* @__PURE__ */ new Map();
  const indexesToDelete = /* @__PURE__ */ new Set();
  const prevMatIds = new Set(meshes.materialIdsArray());
  const prevReprIds = new Set(meshes.representationIdsArray());
  const prevSampleIds = new Set(meshes.sampleIdsArray());
  const prevGtIds = new Set(meshes.globalTransformIdsArray());
  const prevLtIds = new Set(meshes.localTransformIdsArray());
  const prevItemIds = new Set(model.localIdsArray());
  let newMaxLocalId = model.maxLocalId();
  for (const request of requests) {
    if (request.type === EditRequestType.UPDATE_MATERIAL) {
      matsToUpdate.set(request.localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_REPRESENTATION) {
      reprsToUpdate.set(request.localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_SAMPLE) {
      samplesToUpdate.set(
        request.localId,
        request.data
      );
      continue;
    }
    if (request.type === EditRequestType.UPDATE_GLOBAL_TRANSFORM) {
      gtsToUpdate.set(request.localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_LOCAL_TRANSFORM) {
      ltsToUpdate.set(request.localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_ITEM) {
      itemsToUpdate.set(request.localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_RELATION) {
      relationsToUpdate.set(request.localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_METADATA) {
      metadataToUpdate = request.data;
      continue;
    }
    if (request.type === EditRequestType.UPDATE_SPATIAL_STRUCTURE) {
      spatialStructureToUpdate = request.data;
      continue;
    }
    if (request.type === EditRequestType.CREATE_MATERIAL) {
      const localId = request.localId;
      if (prevMatIds.has(localId)) {
        continue;
      }
      matsToCreate.set(localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.CREATE_REPRESENTATION) {
      const localId = request.localId;
      if (prevReprIds.has(localId)) {
        continue;
      }
      reprsToCreate.set(localId, request.data);
      if (request.data.representationClass === RepresentationClass.SHELL) {
        shellsToCreate.set(
          localId,
          request.data.geometry
        );
      } else if (request.data.representationClass === RepresentationClass.CIRCLE_EXTRUSION) {
        circleExtrusionsToCreate.set(
          localId,
          request.data.geometry
        );
      }
      continue;
    }
    if (request.type === EditRequestType.CREATE_SAMPLE) {
      const localId = request.localId;
      if (prevSampleIds.has(localId)) {
        continue;
      }
      samplesToCreate.set(localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.CREATE_GLOBAL_TRANSFORM) {
      const localId = request.localId;
      if (prevGtIds.has(localId)) {
        continue;
      }
      gtsToCreate.set(localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.CREATE_LOCAL_TRANSFORM) {
      const localId = request.localId;
      if (prevLtIds.has(localId)) {
        continue;
      }
      ltsToCreate.set(localId, request.data);
      continue;
    }
    if (request.type === EditRequestType.CREATE_ITEM) {
      const localId = request.localId;
      if (prevItemIds.has(localId)) {
        continue;
      }
      itemsToCreate.set(localId, request.data);
    }
    if (request.type === EditRequestType.CREATE_RELATION) {
      const localId = request.localId;
      relationsToCreate.set(localId, request.data);
    }
    if (request.type === EditRequestType.DELETE_MATERIAL) {
      matsToDelete.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.DELETE_REPRESENTATION) {
      reprsToDelete.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.DELETE_SAMPLE) {
      samplesToDelete.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.DELETE_GLOBAL_TRANSFORM) {
      gtsToDelete.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.DELETE_LOCAL_TRANSFORM) {
      ltsToDelete.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.DELETE_ITEM) {
      itemsToDelete.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_MAX_LOCAL_ID) {
      newMaxLocalId = request.localId;
      continue;
    }
    if (request.type === EditRequestType.DELETE_RELATION) {
      relationsToDelete.add(request.localId);
      continue;
    }
    if (request.type === EditRequestType.CREATE_INDEX || request.type === EditRequestType.UPDATE_INDEX) {
      const { keys, values, end, start } = request.data;
      const validateNumbers = (items, key) => {
        if (!items || items.length === 0 || typeof items[0] !== "number") {
          return;
        }
        const numberErrors = [];
        for (let index = 0; index < items.length; index++) {
          const value = items[index];
          if (!Number.isInteger(value) || value < 0 || value > 4294967295) {
            numberErrors.push({ index, value });
          }
        }
        if (numberErrors.length) {
          throw new Error(
            `Invalid index request: ${key} must be non-negative 32-bit integers`,
            {
              cause: {
                type: "invalid-number",
                key,
                errors: numberErrors
              }
            }
          );
        }
      };
      validateNumbers(keys, "keys");
      validateNumbers(values, "values");
      if (values && !end) {
        if (values.length !== keys.length) {
          throw new Error(
            "Invalid index request: unexpected values vector length",
            {
              cause: {
                type: "invalid-length",
                key: "values",
                expected: keys.length,
                actual: values.length
              }
            }
          );
        }
      }
      if (values && end) {
        if (end.length !== keys.length) {
          throw new Error(
            "Invalid index request: unexpected end vector length",
            {
              cause: {
                type: "invalid-length",
                key: "end",
                expected: keys.length,
                actual: end.length
              }
            }
          );
        }
        if (start && start.length !== keys.length) {
          throw new Error(
            "Invalid index request: unexpected start vector length",
            {
              cause: {
                type: "invalid-length",
                key: "start",
                expected: keys.length,
                actual: start.length
              }
            }
          );
        }
        const errors = [];
        for (let index = 0; index < keys.length; index++) {
          const valuesStart = start?.[index] ?? end[index - 1] ?? 0;
          const valuesEnd = end[index];
          if (valuesStart < 0 || valuesEnd > values.length || valuesStart > valuesEnd) {
            errors.push({
              index,
              start: valuesStart,
              end: valuesEnd
            });
          }
        }
        if (errors.length) {
          throw new Error("Invalid index request: out of bounds value slices", {
            cause: {
              type: "invalid-bounds",
              errors
            }
          });
        }
      }
      indexesToUpsert.set(request.data.name, request.data);
      indexesToDelete.delete(request.data.name);
      continue;
    }
    if (request.type === EditRequestType.DELETE_INDEX) {
      indexesToDelete.add(request.name);
      indexesToUpsert.delete(request.name);
      continue;
    }
  }
  for (let i = 0; i < meshes.representationsLength(); i++) {
    const repr = meshes.representations(i);
    const geometryIndex = repr.id();
    const reprId = meshes.representationIds(i);
    if (delta && !deltaReps.has(reprId)) {
      continue;
    }
    if (reprsToDelete.has(reprId)) {
      if (repr.representationClass() === RepresentationClass.SHELL) {
        shellsToDelete.add(geometryIndex);
      } else if (repr.representationClass() === RepresentationClass.CIRCLE_EXTRUSION) {
        circleExtrusionsToDelete.add(geometryIndex);
      } else {
        throw new Error("Representation class is not supported");
      }
      continue;
    }
    if (!reprsToUpdate.has(reprId)) {
      continue;
    }
    const reprClass = repr.representationClass();
    if (reprClass === RepresentationClass.SHELL) {
      shellsToUpdate.set(geometryIndex, reprId);
    } else if (reprClass === RepresentationClass.CIRCLE_EXTRUSION) {
      circleExtrusionsToUpdate.set(geometryIndex, reprId);
    } else {
      throw new Error("Representation class is not supported");
    }
  }
  prevMatIds.clear();
  prevReprIds.clear();
  prevSampleIds.clear();
  prevGtIds.clear();
  prevLtIds.clear();
  prevItemIds.clear();
  const prevMatCount = meshes.materialsLength();
  const includedMatCount = delta ? deltaMaterials.size : prevMatCount;
  const deletedMatCount = delta ? deltaDeletedMaterials : matsToDelete.size;
  const newMatCount = includedMatCount + matsToCreate.size - deletedMatCount;
  const prevReprCount = meshes.representationsLength();
  const includedReprCount = delta ? deltaReps.size : prevReprCount;
  const deletedReprCount = delta ? deltaDeletedRepresentations : reprsToDelete.size;
  let reprOverlap = 0;
  if (delta) {
    for (const [id] of reprsToCreate) {
      if (deltaReps.has(id)) {
        reprOverlap++;
      }
    }
  }
  const newReprCount = includedReprCount + reprsToCreate.size - deletedReprCount - reprOverlap;
  const prevShellCount = meshes.shellsLength();
  const includedShellCount = delta ? deltaShells.size : prevShellCount;
  const deletedShellCount = delta ? deltaDeletedShells : shellsToDelete.size;
  const newShellCount = includedShellCount + shellsToCreate.size - deletedShellCount;
  const prevCircleExtrusionCount = meshes.circleExtrusionsLength();
  const includedCircleExtrusionCount = delta ? deltaCircleExtrusions.size : prevCircleExtrusionCount;
  const deletedCircleExtrusionCount = delta ? deltaDeletedCircleExtrusions : circleExtrusionsToDelete.size;
  const newCircleExtrusionCount = includedCircleExtrusionCount + circleExtrusionsToCreate.size - deletedCircleExtrusionCount;
  const prevSampleCount = meshes.samplesLength();
  const includedSampleCount = delta ? deltaSamples.size : prevSampleCount;
  const deletedSampleCount = delta ? deltaDeletedSamples : samplesToDelete.size;
  const newSampleCount = includedSampleCount + samplesToCreate.size - deletedSampleCount;
  const prevGtCount = meshes.globalTransformsLength();
  const includedGtCount = delta ? deltaGts.size : prevGtCount;
  const deletedGtCount = delta ? deltaDeletedGts : gtsToDelete.size;
  const newGtCount = includedGtCount + gtsToCreate.size - deletedGtCount;
  const prevLtCount = meshes.localTransformsLength();
  const includedLtCount = delta ? deltaLts.size : prevLtCount;
  const deletedLtCount = delta ? deltaDeletedLts : ltsToDelete.size;
  const newLtCount = includedLtCount + ltsToCreate.size - deletedLtCount;
  if (newGtCount < 0 || newReprCount < 0 || newSampleCount < 0 || newLtCount < 0 || newMatCount < 0 || newShellCount < 0 || newCircleExtrusionCount < 0) {
    throw new Error("Invalid number of elements");
  }
  const localIdToIndex = /* @__PURE__ */ new Map();
  const finalMaterialIds = [];
  const finalReprIds = [];
  const finalSampleIds = [];
  const finalGtIds = [];
  const finalMeshesItems = [];
  const finalLtIds = [];
  const finalItemIds = [];
  let gtCounter = 0;
  for (let i = 0; i < meshes.globalTransformsLength(); i++) {
    const localId = meshes.globalTransformIds(i);
    if (gtsToDelete.has(localId)) {
      continue;
    }
    if (delta && !deltaGts.has(localId)) {
      continue;
    }
    if (localIdToIndex.has(localId)) {
      throw new Error("Local id already exists");
    }
    localIdToIndex.set(localId, gtCounter++);
    finalGtIds.push(localId);
  }
  for (const [localId] of gtsToCreate) {
    if (gtsToDelete.has(localId)) {
      continue;
    }
    if (localIdToIndex.has(localId)) {
      throw new Error("Local id already exists");
    }
    localIdToIndex.set(localId, gtCounter++);
    finalGtIds.push(localId);
  }
  let matCounter = 0;
  for (let i = 0; i < meshes.materialIdsLength(); i++) {
    const localId = meshes.materialIds(i);
    if (matsToDelete.has(localId)) {
      continue;
    }
    if (delta && !deltaMaterials.has(localId)) {
      continue;
    }
    if (localIdToIndex.has(localId)) {
      throw new Error("Local id already exists");
    }
    localIdToIndex.set(localId, matCounter++);
    finalMaterialIds.push(localId);
  }
  for (const [localId] of matsToCreate) {
    if (matsToDelete.has(localId)) {
      continue;
    }
    if (localIdToIndex.has(localId)) {
      throw new Error("Local id already exists");
    }
    localIdToIndex.set(localId, matCounter++);
    finalMaterialIds.push(localId);
  }
  let ltCounter = 0;
  for (let i = 0; i < meshes.localTransformIdsLength(); i++) {
    const localId = meshes.localTransformIds(i);
    if (ltsToDelete.has(localId)) {
      continue;
    }
    if (delta && !deltaLts.has(localId)) {
      continue;
    }
    if (localIdToIndex.has(localId)) {
      throw new Error("Local id already exists");
    }
    localIdToIndex.set(localId, ltCounter++);
    finalLtIds.push(localId);
  }
  for (const [localId] of ltsToCreate) {
    if (ltsToDelete.has(localId)) {
      continue;
    }
    if (localIdToIndex.has(localId)) {
      throw new Error("Local id already exists");
    }
    localIdToIndex.set(localId, ltCounter++);
    finalLtIds.push(localId);
  }
  let reprCounter = 0;
  for (let i = 0; i < meshes.representationIdsLength(); i++) {
    const localId = meshes.representationIds(i);
    if (reprsToDelete.has(localId)) {
      continue;
    }
    if (delta && !deltaReps.has(localId)) {
      continue;
    }
    if (localIdToIndex.has(localId)) {
      throw new Error("Local id already exists");
    }
    localIdToIndex.set(localId, reprCounter++);
    finalReprIds.push(localId);
  }
  for (const [localId] of reprsToCreate) {
    if (reprsToDelete.has(localId)) {
      continue;
    }
    if (localIdToIndex.has(localId)) {
      throw new Error("Local id already exists");
    }
    localIdToIndex.set(localId, reprCounter++);
    finalReprIds.push(localId);
  }
  for (let i = 0; i < meshes.sampleIdsLength(); i++) {
    const localId = meshes.sampleIds(i);
    if (samplesToDelete.has(localId)) {
      continue;
    }
    if (delta && !deltaSamples.has(localId)) {
      continue;
    }
    finalSampleIds.push(localId);
  }
  for (const [localId] of samplesToCreate) {
    if (samplesToDelete.has(localId)) {
      continue;
    }
    finalSampleIds.push(localId);
  }
  let itemsCounter = 0;
  for (let i = 0; i < model.localIdsLength(); i++) {
    const localId = model.localIds(i);
    if (itemsToDelete.has(localId)) {
      continue;
    }
    if (delta && !deltaItemIds.has(localId)) {
      continue;
    }
    localIdToIndex.set(localId, itemsCounter++);
    finalItemIds.push(localId);
  }
  for (const [localId] of itemsToCreate) {
    if (itemsToDelete.has(localId)) {
      continue;
    }
    localIdToIndex.set(localId, itemsCounter++);
    finalItemIds.push(localId);
  }
  const builder = new Builder(1024);
  Meshes.startGlobalTransformsVector(builder, newGtCount);
  const newGtIdSet = Array.from(gtsToCreate.keys());
  for (let i = 0; i < newGtIdSet.length; i++) {
    const j = newGtIdSet.length - 1 - i;
    const localId = newGtIdSet[j];
    const needsUpdate = gtsToUpdate.has(localId);
    const gt = needsUpdate ? gtsToUpdate.get(localId) : gtsToCreate.get(localId);
    if (!gt) {
      throw new Error(`Global transform not found: ${localId}`);
    }
    if (gtsToDelete.has(localId)) {
      continue;
    }
    const itemId = gt.itemId;
    if (!localIdToIndex.has(itemId)) {
      throw new Error("Item id not found for global transform");
    }
    const itemIndex = localIdToIndex.get(itemId);
    finalMeshesItems.unshift(itemIndex);
    createTransform(gt, builder);
  }
  newGtIdSet.length = 0;
  for (let i = 0; i < prevGtCount; i++) {
    const j = prevGtCount - 1 - i;
    const current = meshes.globalTransforms(j);
    const localId = meshes.globalTransformIds(j);
    if (gtsToDelete.has(localId)) {
      continue;
    }
    if (delta && !deltaGts.has(localId)) {
      continue;
    }
    const needsUpdate = gtsToUpdate.has(localId);
    if (needsUpdate) {
      const updated = gtsToUpdate.get(localId);
      const itemId = updated.itemId;
      if (!localIdToIndex.has(itemId)) {
        throw new Error(`Item id not found for global transform: ${localId}`);
      }
      const newItemIndex = localIdToIndex.get(itemId);
      finalMeshesItems.unshift(newItemIndex);
      createTransform(updated, builder);
    } else {
      const prevItemIndex = meshes.meshesItems(j);
      const itemId = model.localIds(prevItemIndex);
      if (!localIdToIndex.has(itemId)) {
        throw new Error(`Item id not found for global transform: ${localId}`);
      }
      const newItemIndex = localIdToIndex.get(itemId);
      finalMeshesItems.unshift(newItemIndex);
      copyTransform(builder, current);
    }
  }
  const globalTransformsRef = builder.endVector();
  const shellsOffsets = [];
  for (let i = 0; i < prevShellCount; i++) {
    if (shellsToDelete.has(i)) {
      continue;
    }
    if (delta && !deltaShells.has(i)) {
      continue;
    }
    if (shellsToUpdate.has(i)) {
      const reprId = shellsToUpdate.get(i);
      const repr = reprsToUpdate.get(reprId);
      const shell2 = repr.geometry;
      const shellOffset2 = createShell(builder, shell2);
      shellsOffsets.push(shellOffset2);
      continue;
    }
    const shell = meshes.shells(i);
    const shellOffset = copyShell(builder, shell);
    shellsOffsets.push(shellOffset);
  }
  for (const [id] of shellsToCreate) {
    if (reprsToDelete.has(id)) {
      continue;
    }
    const needsUpdate = reprsToUpdate.has(id);
    let shellOffset = 0;
    if (needsUpdate) {
      const repr = reprsToUpdate.get(id);
      const shell = repr.geometry;
      shellOffset = createShell(builder, shell);
    } else {
      const shell = shellsToCreate.get(id);
      shellOffset = createShell(builder, shell);
    }
    shellsOffsets.push(shellOffset);
  }
  const shells = Meshes.createShellsVector(builder, shellsOffsets);
  const circleExtrusionsOffsets = [];
  for (let i = 0; i < prevCircleExtrusionCount; i++) {
    if (circleExtrusionsToDelete.has(i)) {
      continue;
    }
    if (delta && !deltaCircleExtrusions.has(i)) {
      continue;
    }
    if (circleExtrusionsToUpdate.has(i)) {
      const reprId = circleExtrusionsToUpdate.get(i);
      const repr = reprsToUpdate.get(reprId);
      const circleExtrusion2 = repr.geometry;
      const circleExtrusionOffset2 = createCircleExtrusion(
        builder,
        circleExtrusion2
      );
      circleExtrusionsOffsets.push(circleExtrusionOffset2);
      continue;
    }
    const circleExtrusion = meshes.circleExtrusions(i);
    const circleExtrusionOffset = copyCircleExtrusion(builder, circleExtrusion);
    circleExtrusionsOffsets.push(circleExtrusionOffset);
  }
  for (const [id] of circleExtrusionsToCreate) {
    if (circleExtrusionsToDelete.has(id)) {
      continue;
    }
    const needsUpdate = reprsToUpdate.has(id);
    let circleExtrusionOffset = 0;
    if (needsUpdate) {
      const repr = reprsToUpdate.get(id);
      const circleExtrusion = repr.geometry;
      circleExtrusionOffset = createCircleExtrusion(builder, circleExtrusion);
    } else {
      const circleExtrusion = circleExtrusionsToCreate.get(
        id
      );
      circleExtrusionOffset = createCircleExtrusion(builder, circleExtrusion);
    }
    circleExtrusionsOffsets.push(circleExtrusionOffset);
  }
  const circleExtrusions = Meshes.createCircleExtrusionsVector(
    builder,
    circleExtrusionsOffsets
  );
  Meshes.startRepresentationsVector(builder, newReprCount);
  const createdReprsIdSet = Array.from(reprsToCreate.keys());
  let newShellCounter = newShellCount - 1;
  let newCircleExtrusionCounter = newCircleExtrusionCount - 1;
  for (let i = 0; i < createdReprsIdSet.length; i++) {
    const j = createdReprsIdSet.length - 1 - i;
    const localId = createdReprsIdSet[j];
    if (reprsToDelete.has(localId)) {
      continue;
    }
    const needsUpdate = reprsToUpdate.has(localId);
    const repr = needsUpdate ? reprsToUpdate.get(localId) : reprsToCreate.get(localId);
    if (!repr) {
      throw new Error(`Representation not found: ${localId}`);
    }
    const bbox = repr.bbox;
    const rClass = repr.representationClass;
    let id = 0;
    if (repr.representationClass === RepresentationClass.SHELL) {
      id = newShellCounter--;
    } else if (repr.representationClass === RepresentationClass.CIRCLE_EXTRUSION) {
      id = newCircleExtrusionCounter--;
    } else {
      throw new Error("Representation class is not supported");
    }
    Representation.createRepresentation(
      builder,
      id,
      bbox[0],
      bbox[1],
      bbox[2],
      bbox[3],
      bbox[4],
      bbox[5],
      rClass
    );
  }
  createdReprsIdSet.length = 0;
  for (let i = 0; i < prevReprCount; i++) {
    const j = prevReprCount - 1 - i;
    const current = meshes.representations(j);
    const currentId = meshes.representationIds(j);
    if (reprsToDelete.has(currentId)) {
      continue;
    }
    if (delta && !deltaReps.has(currentId)) {
      continue;
    }
    const needsUpdate = reprsToUpdate.has(currentId);
    if (needsUpdate) {
      const updated = reprsToUpdate.get(currentId);
      const bbox = updated.bbox;
      let id = 0;
      if (updated.representationClass === RepresentationClass.SHELL) {
        id = newShellCounter--;
      } else if (updated.representationClass === RepresentationClass.CIRCLE_EXTRUSION) {
        id = newCircleExtrusionCounter--;
      } else {
        throw new Error("Representation class is not supported");
      }
      const rClass = updated.representationClass;
      Representation.createRepresentation(
        builder,
        id,
        bbox[0],
        bbox[1],
        bbox[2],
        bbox[3],
        bbox[4],
        bbox[5],
        rClass
      );
    } else {
      const bbox = current.bbox();
      let id = 0;
      if (current.representationClass() === RepresentationClass.SHELL) {
        id = newShellCounter--;
      } else if (current.representationClass() === RepresentationClass.CIRCLE_EXTRUSION) {
        id = newCircleExtrusionCounter--;
      } else {
        throw new Error("Representation class is not supported");
      }
      const rClass = current.representationClass();
      const min = bbox.min();
      const max = bbox.max();
      Representation.createRepresentation(
        builder,
        id,
        min.x(),
        min.y(),
        min.z(),
        max.x(),
        max.y(),
        max.z(),
        rClass
      );
    }
  }
  const representationsRef = builder.endVector();
  Meshes.startSamplesVector(builder, newSampleCount);
  const newSamplesIdSet = Array.from(samplesToCreate.keys());
  for (let i = 0; i < newSamplesIdSet.length; i++) {
    const j = newSamplesIdSet.length - 1 - i;
    const localId = newSamplesIdSet[j];
    if (samplesToDelete.has(localId)) {
      continue;
    }
    const needsUpdate = samplesToUpdate.has(localId);
    const sample = needsUpdate ? samplesToUpdate.get(localId) : samplesToCreate.get(localId);
    if (!sample) {
      throw new Error(`Sample not found: ${localId}`);
    }
    if (matsToDelete.has(sample.material)) {
      throw new Error(`Material to delete found in sample ${localId}`);
    }
    if (reprsToDelete.has(sample.representation)) {
      throw new Error(`Representation to delete found in sample ${localId}`);
    }
    const gtId = sample.item;
    const matId = sample.material;
    const reprId = sample.representation;
    const ltId = sample.localTransform;
    buildSample(builder, localIdToIndex, gtId, matId, reprId, ltId);
  }
  newSamplesIdSet.length = 0;
  for (let i = 0; i < prevSampleCount; i++) {
    const j = prevSampleCount - 1 - i;
    const current = meshes.samples(j);
    const currentId = meshes.sampleIds(j);
    if (samplesToDelete.has(currentId)) {
      continue;
    }
    if (delta && !deltaSamples.has(currentId)) {
      continue;
    }
    const needsUpdate = samplesToUpdate.has(currentId);
    if (needsUpdate) {
      const updated = samplesToUpdate.get(currentId);
      const gtId2 = updated.item;
      const matId2 = updated.material;
      const reprId2 = updated.representation;
      const ltId2 = updated.localTransform;
      buildSample(builder, localIdToIndex, gtId2, matId2, reprId2, ltId2);
      continue;
    }
    const gtId = meshes.globalTransformIds(current.item());
    const matId = meshes.materialIds(current.material());
    const reprId = meshes.representationIds(current.representation());
    const ltId = meshes.localTransformIds(current.localTransform());
    if (matsToDelete.has(matId)) {
      throw new Error(`Material to delete found in sample ${currentId}`);
    }
    buildSample(builder, localIdToIndex, gtId, matId, reprId, ltId);
  }
  const samplesOffset = builder.endVector();
  Meshes.startLocalTransformsVector(builder, newLtCount);
  const newLtIdSet = Array.from(ltsToCreate.keys());
  for (let i = 0; i < newLtIdSet.length; i++) {
    const j = newLtIdSet.length - 1 - i;
    const localId = newLtIdSet[j];
    if (ltsToDelete.has(localId)) {
      continue;
    }
    const needsUpdate = ltsToUpdate.has(localId);
    const lt = needsUpdate ? ltsToUpdate.get(localId) : ltsToCreate.get(localId);
    if (!lt) {
      throw new Error(`Local transform not found: ${localId}`);
    }
    createTransform(lt, builder);
  }
  newLtIdSet.length = 0;
  for (let i = 0; i < prevLtCount; i++) {
    const j = prevLtCount - 1 - i;
    const current = meshes.localTransforms(j);
    const currentId = meshes.localTransformIds(j);
    const needsUpdate = ltsToUpdate.has(currentId);
    if (ltsToDelete.has(currentId)) {
      continue;
    }
    if (delta && !deltaLts.has(currentId)) {
      continue;
    }
    if (needsUpdate) {
      const updated = ltsToUpdate.get(currentId);
      createTransform(updated, builder);
    } else {
      copyTransform(builder, current);
    }
  }
  const localTransformRef = builder.endVector();
  Meshes.startMaterialsVector(builder, newMatCount);
  const newMatsIdSet = Array.from(matsToCreate.keys());
  for (let i = 0; i < newMatsIdSet.length; i++) {
    const j = newMatsIdSet.length - 1 - i;
    const currentId = newMatsIdSet[j];
    if (matsToDelete.has(currentId)) {
      continue;
    }
    const needsUpdate = matsToUpdate.has(currentId);
    const material = needsUpdate ? matsToUpdate.get(currentId) : matsToCreate.get(currentId);
    if (!material) {
      throw new Error(`Material not found: ${currentId}`);
    }
    const r = material.r;
    const g = material.g;
    const b = material.b;
    const a = material.a;
    const stroke = material.stroke;
    const renderedFaces = material.renderedFaces;
    Material.createMaterial(builder, r, g, b, a, renderedFaces, stroke);
  }
  newMatsIdSet.length = 0;
  for (let i = 0; i < prevMatCount; i++) {
    const j = prevMatCount - 1 - i;
    const current = meshes.materials(j);
    const currentId = meshes.materialIds(j);
    if (matsToDelete.has(currentId)) {
      continue;
    }
    if (delta && !deltaMaterials.has(currentId)) {
      continue;
    }
    const needsUpdate = matsToUpdate.has(currentId);
    const updated = matsToUpdate.get(currentId);
    const r = needsUpdate ? updated.r : current.r();
    const g = needsUpdate ? updated.g : current.g();
    const b = needsUpdate ? updated.b : current.b();
    const a = needsUpdate ? updated.a : current.a();
    const stroke = needsUpdate ? updated.stroke : current.stroke();
    const renderedFaces = needsUpdate ? updated.renderedFaces : current.renderedFaces();
    Material.createMaterial(builder, r, g, b, a, renderedFaces, stroke);
  }
  const materialsRef = builder.endVector();
  const meshesItemsOffset = Meshes.createMeshesItemsVector(
    builder,
    finalMeshesItems
  );
  const reprLocalIdsOffset = Meshes.createRepresentationIdsVector(
    builder,
    finalReprIds
  );
  const sampleLocalIdsOffset = Meshes.createSampleIdsVector(
    builder,
    finalSampleIds
  );
  const materialLocalIdsOffset = Meshes.createMaterialIdsVector(
    builder,
    finalMaterialIds
  );
  const ltLocalIdsOffset = Meshes.createLocalTransformIdsVector(
    builder,
    finalLtIds
  );
  const gtLocalIdsOffset = Meshes.createGlobalTransformIdsVector(
    builder,
    finalGtIds
  );
  Meshes.startMeshes(builder);
  const coordinates = meshes.coordinates();
  const coordinatesRef = copyTransform(builder, coordinates);
  Meshes.addCoordinates(builder, coordinatesRef);
  Meshes.addGlobalTransforms(builder, globalTransformsRef);
  Meshes.addShells(builder, shells);
  Meshes.addRepresentations(builder, representationsRef);
  Meshes.addSamples(builder, samplesOffset);
  Meshes.addLocalTransforms(builder, localTransformRef);
  Meshes.addMaterials(builder, materialsRef);
  Meshes.addCircleExtrusions(builder, circleExtrusions);
  Meshes.addMeshesItems(builder, meshesItemsOffset);
  Meshes.addRepresentationIds(builder, reprLocalIdsOffset);
  Meshes.addSampleIds(builder, sampleLocalIdsOffset);
  Meshes.addMaterialIds(builder, materialLocalIdsOffset);
  Meshes.addLocalTransformIds(builder, ltLocalIdsOffset);
  Meshes.addGlobalTransformIds(builder, gtLocalIdsOffset);
  const modelMesh = Meshes.endMeshes(builder);
  let metadataOffset;
  if (metadataToUpdate) {
    const metadata = JSON.stringify(metadataToUpdate);
    metadataOffset = builder.createString(metadata);
  } else {
    const metadata = model.metadata();
    metadataOffset = builder.createString(metadata);
  }
  const prevAttrLength = model.attributesLength();
  const attributesOffsets = [];
  const uniqueAttributes = /* @__PURE__ */ new Set();
  const categoriesOffsets = [];
  const guidsOffsets = [];
  const guidsItems = [];
  const guidsIndicesById = /* @__PURE__ */ new Map();
  for (let i = 0; i < model.guidsItemsLength(); i++) {
    const guidLocalId = model.guidsItems(i);
    guidsIndicesById.set(guidLocalId, i);
  }
  for (let i = 0; i < prevAttrLength; i++) {
    const currentId = model.localIds(i);
    if (itemsToDelete.has(currentId)) {
      continue;
    }
    const current = model.attributes(i);
    const dataOffsets = [];
    const needsUpdate = itemsToUpdate.has(currentId);
    if (needsUpdate) {
      const updated = itemsToUpdate.get(currentId);
      categoriesOffsets.push(builder.createSharedString(updated.category));
      if (updated.guid) {
        guidsOffsets.push(builder.createSharedString(updated.guid));
        guidsItems.push(currentId);
      }
      for (const attrName in updated.data) {
        const { value, type } = updated.data[attrName];
        const attrString = JSON.stringify([attrName, value, type]);
        uniqueAttributes.add(attrString);
        const dataOffset2 = builder.createSharedString(attrString);
        dataOffsets.push(dataOffset2);
      }
    } else {
      const currentCategory = model.categories(i);
      categoriesOffsets.push(builder.createSharedString(currentCategory));
      const guidIndex = guidsIndicesById.get(currentId);
      if (guidIndex !== void 0) {
        const guid = model.guids(guidIndex);
        guidsOffsets.push(builder.createSharedString(guid));
        guidsItems.push(currentId);
      }
      const dataLength = current.dataLength();
      for (let j = 0; j < dataLength; j++) {
        const currentData = current.data(j);
        uniqueAttributes.add(currentData);
        const dataOffset2 = builder.createSharedString(currentData);
        dataOffsets.push(dataOffset2);
      }
    }
    const dataOffset = Attribute.createDataVector(builder, dataOffsets);
    const attributeOffset = Attribute.createAttribute(builder, dataOffset);
    attributesOffsets.push(attributeOffset);
  }
  for (const [currentId, created] of itemsToCreate) {
    if (itemsToDelete.has(currentId)) {
      continue;
    }
    const attributes = itemsToUpdate.get(currentId) ?? created;
    categoriesOffsets.push(builder.createSharedString(attributes.category));
    if (attributes.guid) {
      guidsOffsets.push(builder.createSharedString(attributes.guid));
      guidsItems.push(currentId);
    }
    const dataOffsets = [];
    for (const attrName in attributes.data) {
      const { value, type } = attributes.data[attrName];
      const attrString = JSON.stringify([attrName, value, type]);
      uniqueAttributes.add(attrString);
      const dataOffset2 = builder.createSharedString(attrString);
      dataOffsets.push(dataOffset2);
    }
    const dataOffset = Attribute.createDataVector(builder, dataOffsets);
    const attributeOffset = Attribute.createAttribute(builder, dataOffset);
    attributesOffsets.push(attributeOffset);
  }
  const attributesVector = Model.createAttributesVector(
    builder,
    attributesOffsets
  );
  const uniqueAttrsOffsets = [];
  for (const attr of uniqueAttributes) {
    const dataOffset = builder.createSharedString(attr);
    uniqueAttrsOffsets.push(dataOffset);
  }
  const uniqueAttributesVector = Model.createUniqueAttributesVector(
    builder,
    uniqueAttrsOffsets
  );
  const relationNamesLength = model.relationNamesLength();
  const relationNamesOffsets = [];
  for (let i = 0; i < relationNamesLength; i++) {
    const current = model.relationNames(i);
    const relationNameOffset = builder.createSharedString(current);
    relationNamesOffsets.push(relationNameOffset);
  }
  const relNamesVector = Model.createRelationNamesVector(
    builder,
    relationNamesOffsets
  );
  const localIdsVector = Model.createLocalIdsVector(builder, finalItemIds);
  const categoriesVector = Model.createCategoriesVector(
    builder,
    categoriesOffsets
  );
  const relsOffsets = [];
  const newRelationsItems = [];
  const existingRelations = /* @__PURE__ */ new Set();
  const relItemsIndices = model.relationsItemsLength();
  const saveRelation = (relationData) => {
    const dataOffsets = [];
    for (const name in relationData.data) {
      const ids = relationData.data[name];
      const filteredIds = ids.filter((id) => !itemsToDelete.has(id));
      if (!filteredIds.length) continue;
      const dataOffset2 = builder.createSharedString(
        JSON.stringify([name, ...filteredIds])
      );
      dataOffsets.push(dataOffset2);
    }
    const dataOffset = Relation.createDataVector(builder, dataOffsets);
    const relOffset = Relation.createRelation(builder, dataOffset);
    relsOffsets.push(relOffset);
  };
  for (let i = 0; i < relItemsIndices; i++) {
    const localId = model.relationsItems(i);
    existingRelations.add(localId);
    if (itemsToDelete.has(localId) || relationsToDelete.has(localId) || !localIdToIndex.has(localId)) {
      continue;
    }
    let relationData;
    if (relationsToUpdate.has(localId)) {
      relationData = relationsToUpdate.get(localId);
    } else {
      const current = model.relations(i);
      relationData = EditUtils.getRelationData(current);
    }
    saveRelation(relationData);
    newRelationsItems.push(localId);
  }
  for (const [localId, newRelationData] of relationsToCreate) {
    if (itemsToDelete.has(localId) || relationsToDelete.has(localId) || existingRelations.has(localId)) {
      continue;
    }
    let relationData;
    if (relationsToUpdate.has(localId)) {
      relationData = relationsToUpdate.get(localId);
    } else {
      relationData = newRelationData;
    }
    saveRelation(relationData);
    newRelationsItems.push(localId);
  }
  existingRelations.clear();
  const relsVector = Model.createRelationsVector(builder, relsOffsets);
  const relIndicesVector = Model.createRelationsItemsVector(
    builder,
    newRelationsItems
  );
  const guidsItemsVector = Model.createGuidsItemsVector(
    builder,
    guidsItems
  );
  const guidsVector = Model.createGuidsVector(builder, guidsOffsets);
  let spatialStructureOffset = null;
  if (spatialStructureToUpdate) {
    spatialStructureOffset = createSpatialStructure(
      builder,
      spatialStructureToUpdate
    );
  } else {
    const spatialStruture = model.spatialStructure();
    spatialStructureOffset = copySpatialStructure(builder, spatialStruture);
  }
  const guidLength = model.guid();
  const guidRef = builder.createString(guidLength);
  const indexOffsets = [];
  const upsertNames = new Set(indexesToUpsert.keys());
  for (let i = 0; i < model.indexesLength(); i++) {
    const existing = model.indexes(i);
    if (!existing) continue;
    const name = existing.name();
    if (!name) continue;
    if (indexesToDelete.has(name)) continue;
    if (upsertNames.has(name)) continue;
    indexOffsets.push(copyIndex(builder, existing));
  }
  for (const data of indexesToUpsert.values()) {
    indexOffsets.push(buildIndex(builder, data));
  }
  const indexesVector = indexOffsets.length > 0 ? Model.createIndexesVector(builder, indexOffsets) : null;
  Model.startModel(builder);
  Model.addMeshes(builder, modelMesh);
  Model.addMetadata(builder, metadataOffset);
  Model.addAttributes(builder, attributesVector);
  Model.addUniqueAttributes(builder, uniqueAttributesVector);
  Model.addRelationNames(builder, relNamesVector);
  Model.addLocalIds(builder, localIdsVector);
  Model.addCategories(builder, categoriesVector);
  Model.addRelationsItems(builder, relIndicesVector);
  Model.addRelations(builder, relsVector);
  Model.addGuidsItems(builder, guidsItemsVector);
  Model.addGuids(builder, guidsVector);
  if (spatialStructureOffset !== null) {
    Model.addSpatialStructure(builder, spatialStructureOffset);
  }
  Model.addGuid(builder, guidRef);
  Model.addMaxLocalId(builder, newMaxLocalId);
  if (indexesVector !== null) {
    Model.addIndexes(builder, indexesVector);
  }
  const outData = Model.endModel(builder);
  builder.finish(outData);
  const outBytes = builder.asUint8Array();
  builder.clear();
  const result = raw ? outBytes : pako.deflate(outBytes);
  const affectedItems = new Set(finalItemIds);
  const editedSamples = new Set(finalSampleIds);
  getAffectedItems(requests, editedSamples, meshes, model, affectedItems);
  return { model: result, items: Array.from(affectedItems) };
}
export {
  edit
};
//# sourceMappingURL=edit-function.mjs.map
