import * as THREE from "three";
import { EditRequestType, isIndexRequest } from "../../../Utils/edit/edit-types.mjs";
import { GeomsFbUtils } from "../../../Utils/shells/index.mjs";
import { EditUtils } from "../../../Utils/edit/edit-utils.mjs";
import { RepresentationClass } from "../../../Schema/representation-class.mjs";
class ElementsHelper {
  _nextTempIds = {};
  _requests = {};
  _fragments;
  // Indexes are name-keyed, not localId-keyed, so they don't fit cleanly
  // into the create/update/remove maps above. They get their own queue,
  // appended to the request list at applyChanges time.
  _indexRequests = {};
  constructor(fragments) {
    this._fragments = fragments;
  }
  getRequests(modelId) {
    const modelRequests = this.getModelRequests(modelId);
    this._requests[modelId] = this.newRequests();
    const {
      create,
      update,
      remove,
      relations: { create: relCreate, update: relUpdate, remove: relRemove }
    } = modelRequests;
    const createRequests = Object.values(create);
    const updateRequests = Object.values(update);
    const removeRequests = Object.values(remove);
    const relCreateRequests = Object.values(relCreate);
    const relUpdateRequests = Object.values(relUpdate);
    const relRemoveRequests = Object.values(relRemove);
    const indexRequests = this._indexRequests[modelId] ?? [];
    this._indexRequests[modelId] = [];
    const requests = [
      ...removeRequests,
      ...createRequests,
      ...updateRequests,
      ...relCreateRequests,
      ...relUpdateRequests,
      ...relRemoveRequests,
      ...indexRequests
    ];
    if (requests.length > 0) {
      return requests;
    }
    return null;
  }
  /**
   * Queue a CREATE_INDEX request. Flushed when `editor.applyChanges()` runs.
   */
  createIndex(modelId, data) {
    this.queueIndexRequest(modelId, {
      type: EditRequestType.CREATE_INDEX,
      data
    });
  }
  /**
   * Queue an UPDATE_INDEX request. Replaces the index identified by
   * `data.name` when flushed.
   */
  updateIndex(modelId, data) {
    this.queueIndexRequest(modelId, {
      type: EditRequestType.UPDATE_INDEX,
      data
    });
  }
  /**
   * Queue a DELETE_INDEX request. No-op at flush time if the index doesn't
   * exist.
   */
  deleteIndex(modelId, name) {
    this.queueIndexRequest(modelId, {
      type: EditRequestType.DELETE_INDEX,
      name
    });
  }
  queueIndexRequest(modelId, request) {
    if (!this._indexRequests[modelId]) {
      this._indexRequests[modelId] = [];
    }
    this._indexRequests[modelId].push(request);
  }
  createMaterial(modelId, material) {
    const tempId = this.getNextTempId(modelId);
    const data = {
      r: material.color.r * 255,
      g: material.color.g * 255,
      b: material.color.b * 255,
      a: material.opacity * 255,
      renderedFaces: material.side === THREE.DoubleSide ? 1 : 0,
      stroke: 0
    };
    this.addRequest(modelId, tempId, "create", {
      type: EditRequestType.CREATE_MATERIAL,
      tempId,
      data
    });
    return tempId;
  }
  createLocalTransform(modelId, transform) {
    const tempId = this.getNextTempId(modelId);
    const data = GeomsFbUtils.transformFromMatrix(transform);
    this.addRequest(modelId, tempId, "create", {
      type: EditRequestType.CREATE_LOCAL_TRANSFORM,
      tempId,
      data
    });
    return tempId;
  }
  createShell(modelId, geometry) {
    const tempId = this.getNextTempId(modelId);
    const shell = GeomsFbUtils.representationFromGeometry(geometry);
    this.addRequest(modelId, tempId, "create", {
      type: EditRequestType.CREATE_REPRESENTATION,
      tempId,
      data: shell
    });
    return tempId;
  }
  createCircleExtrusion(modelId, data) {
    const bbox = GeomsFbUtils.bboxFromCircleExtrusion(data);
    const tempId = this.getNextTempId(modelId);
    this.addRequest(modelId, tempId, "create", {
      type: EditRequestType.CREATE_REPRESENTATION,
      tempId,
      data: {
        representationClass: RepresentationClass.CIRCLE_EXTRUSION,
        bbox,
        geometry: data
      }
    });
    return tempId;
  }
  createGlobalTransform(modelId, transform, itemId) {
    const tempId = this.getNextTempId(modelId);
    const data = GeomsFbUtils.transformFromMatrix(transform);
    this.addRequest(modelId, tempId, "create", {
      type: EditRequestType.CREATE_GLOBAL_TRANSFORM,
      tempId,
      data: {
        itemId,
        ...data
      }
    });
    return tempId;
  }
  createSample(modelId, data) {
    const { localTransform, representation, material, globalTransform } = data;
    const tempId = this.getNextTempId(modelId);
    this.addRequest(modelId, tempId, "create", {
      type: EditRequestType.CREATE_SAMPLE,
      tempId,
      data: {
        localTransform,
        representation,
        material,
        item: globalTransform
      }
    });
    return tempId;
  }
  createItem(modelId, item) {
    const tempId = this.getNextTempId(modelId);
    this.addRequest(modelId, tempId, "create", {
      type: EditRequestType.CREATE_ITEM,
      tempId,
      data: item
    });
    return tempId;
  }
  setItem(modelId, item) {
    const localIdAttr = item._localId;
    if (!localIdAttr) {
      throw new Error("No local id provided for the item to set");
    }
    const localId = localIdAttr.value;
    const data = EditUtils.itemDataToRawItemData(item);
    this.addRequest(modelId, localIdAttr.value, "update", {
      type: EditRequestType.UPDATE_ITEM,
      localId,
      data
    });
  }
  async relate(modelId, itemId, relationName, itemIds) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    const relations = await model.getRelations([itemId]);
    const relationData = relations.get(itemId);
    if (!relationData) {
      this.addRelationRequest(modelId, itemId, "create", {
        type: EditRequestType.CREATE_RELATION,
        localId: itemId,
        data: {
          data: {
            [relationName]: itemIds
          }
        }
      });
      return;
    }
    if (!relationData.data[relationName]) {
      relationData.data[relationName] = itemIds;
    } else {
      const uniqueRels = new Set(relationData.data[relationName]);
      for (const id of itemIds) {
        uniqueRels.add(id);
      }
      relationData.data[relationName] = Array.from(uniqueRels);
    }
    this.addRelationRequest(modelId, itemId, "update", {
      type: EditRequestType.UPDATE_RELATION,
      localId: itemId,
      data: relationData
    });
  }
  async unrelate(modelId, itemId, relationName, itemIds) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    const relations = await model.getRelations([itemId]);
    const relationData = relations.get(itemId);
    if (!relationData) {
      return;
    }
    if (!relationData.data[relationName]) {
      return;
    }
    const uniqueRels = new Set(relationData.data[relationName]);
    for (const id of itemIds) {
      uniqueRels.delete(id);
    }
    relationData.data[relationName] = Array.from(uniqueRels);
    this.addRelationRequest(modelId, itemId, "update", {
      type: EditRequestType.UPDATE_RELATION,
      localId: itemId,
      data: relationData
    });
  }
  async get(modelId, localIds) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    return model._getElements(localIds);
  }
  async create(modelId, elements) {
    for (const element of elements) {
      const { attributes, samples, globalTransform } = element;
      const tempId = this.getNextTempId(modelId);
      const data = EditUtils.itemDataToRawItemData(attributes);
      this.addRequest(modelId, tempId, "create", {
        type: EditRequestType.CREATE_ITEM,
        tempId,
        data
      });
      const gtId = this.createGlobalTransform(modelId, globalTransform, tempId);
      for (const sample of samples) {
        const { localTransform, representation, material } = sample;
        let ltId;
        if (typeof localTransform !== "number" && typeof localTransform !== "string") {
          ltId = this.createLocalTransform(modelId, localTransform);
        } else {
          ltId = localTransform;
        }
        let reprId;
        if (typeof representation !== "number" && typeof representation !== "string") {
          reprId = this.createShell(modelId, representation);
        } else {
          reprId = representation;
        }
        let matId;
        if (typeof material !== "number" && typeof material !== "string") {
          matId = this.createMaterial(modelId, material);
        } else {
          matId = material;
        }
        this.createSample(modelId, {
          localTransform: ltId,
          representation: reprId,
          material: matId,
          globalTransform: gtId
        });
      }
    }
    const requests = this.getRequests(modelId);
    if (!requests) {
      console.log("Something went wrong, no requests sent");
      return null;
    }
    const itemIndices = [];
    for (let i = 0; i < requests.length; i++) {
      if (requests[i].type === EditRequestType.CREATE_ITEM) {
        itemIndices.push(i);
      }
    }
    const result = await this._fragments.editor.edit(modelId, requests);
    const itemIds = itemIndices.map((index) => result[index]);
    return this.get(modelId, itemIds);
  }
  delete(modelId, elements) {
    for (const element of elements) {
      element.delete();
      const currentRequests = element.getRequests();
      if (currentRequests) {
        for (const request of currentRequests) {
          if (isIndexRequest(request)) continue;
          const id = request.localId;
          if (id) {
            this.addRequest(modelId, id, "remove", request);
          }
        }
      }
    }
  }
  async applyChanges(modelId, elements = []) {
    const allRequests = [];
    for (const element of elements) {
      const requests2 = element.getRequests();
      if (requests2) {
        allRequests.push(...requests2);
      }
    }
    const requests = this.getRequests(modelId);
    if (requests) {
      allRequests.push(...requests);
    }
    if (allRequests.length > 0) {
      return this._fragments.editor.edit(modelId, allRequests);
    }
    return [];
  }
  async deleteData(modelId, data) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    const filterInUse = data.filterInUse ?? true;
    const {
      itemIds,
      materialIds,
      localTransformIds,
      representationIds,
      sampleIds
    } = data;
    const usedMaterials = /* @__PURE__ */ new Set();
    const usedLocalTransforms = /* @__PURE__ */ new Set();
    const usedGlobalTransforms = /* @__PURE__ */ new Set();
    const usedRepresentations = /* @__PURE__ */ new Set();
    if (filterInUse) {
      const samples = await model.getSamples();
      for (const sample of samples.values()) {
        usedMaterials.add(sample.material);
        usedLocalTransforms.add(sample.localTransform);
        usedGlobalTransforms.add(sample.item);
        usedRepresentations.add(sample.representation);
      }
    }
    if (materialIds) {
      for (const materialId of materialIds) {
        if (filterInUse && usedMaterials.has(materialId)) {
          console.log(`Material ${materialId} is used, skipping`);
          continue;
        }
        if (this.isBeingCreated(modelId, materialId)) {
          delete this._requests[modelId].create[materialId];
          continue;
        }
        this.addRequest(modelId, materialId, "remove", {
          type: EditRequestType.DELETE_MATERIAL,
          localId: materialId
        });
      }
    }
    if (localTransformIds) {
      for (const localTransformId of localTransformIds) {
        if (filterInUse && usedLocalTransforms.has(localTransformId)) {
          console.log(`Local transform ${localTransformId} is used, skipping`);
          continue;
        }
        if (this.isBeingCreated(modelId, localTransformId)) {
          delete this._requests[modelId].create[localTransformId];
          continue;
        }
        this.addRequest(modelId, localTransformId, "remove", {
          type: EditRequestType.DELETE_LOCAL_TRANSFORM,
          localId: localTransformId
        });
      }
    }
    if (representationIds) {
      for (const representationId of representationIds) {
        if (filterInUse && usedRepresentations.has(representationId)) {
          console.log(`Representation ${representationId} is used, skipping`);
          continue;
        }
        if (this.isBeingCreated(modelId, representationId)) {
          delete this._requests[modelId].create[representationId];
          continue;
        }
        this.addRequest(modelId, representationId, "remove", {
          type: EditRequestType.DELETE_REPRESENTATION,
          localId: representationId
        });
      }
    }
    if (sampleIds) {
      for (const sampleId of sampleIds) {
        if (this.isBeingCreated(modelId, sampleId)) {
          delete this._requests[modelId].create[sampleId];
          continue;
        }
        this.addRequest(modelId, sampleId, "remove", {
          type: EditRequestType.DELETE_SAMPLE,
          localId: sampleId
        });
      }
    }
    if (itemIds) {
      for (const itemId of itemIds) {
        if (this.isBeingCreated(modelId, itemId)) {
          delete this._requests[modelId].create[itemId];
          continue;
        }
        this.addRequest(modelId, itemId, "remove", {
          type: EditRequestType.DELETE_ITEM,
          localId: itemId
        });
      }
    }
  }
  getNextTempId(modelId) {
    if (!this._nextTempIds[modelId]) {
      this._nextTempIds[modelId] = 0;
    }
    return (this._nextTempIds[modelId]++).toString();
  }
  addRelationRequest(modelId, localId, type, request) {
    const modelRequests = this.getModelRequests(modelId);
    const relRequests = modelRequests.relations;
    const currentRequests = relRequests[type];
    const id = localId;
    currentRequests[id] = request;
  }
  addRequest(modelId, localId, type, request) {
    const modelRequests = this.getModelRequests(modelId);
    const currentRequests = modelRequests[type];
    const id = localId;
    currentRequests[id] = request;
  }
  getModelRequests(modelId) {
    if (!this._requests[modelId]) {
      this._requests[modelId] = this.newRequests();
    }
    return this._requests[modelId];
  }
  isBeingCreated(modelId, localId) {
    if (!this._requests[modelId]) {
      return false;
    }
    const requests = this._requests[modelId];
    return requests.create[localId] !== void 0;
  }
  newRequests() {
    return {
      update: {},
      create: {},
      remove: {},
      relations: {
        create: {},
        update: {},
        remove: {}
      }
    };
  }
}
export {
  ElementsHelper
};
//# sourceMappingURL=elements-helper.mjs.map
