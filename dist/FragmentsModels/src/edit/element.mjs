import * as THREE from "three";
import { GeomsFbUtils } from "../../../Utils/shells/index.mjs";
import { EditRequestType } from "../../../Utils/edit/edit-types.mjs";
import { RepresentationClass } from "../../../Schema/representation-class.mjs";
class Element {
  localId;
  model;
  core;
  config = {
    data: {
      attributesDefault: true,
      relations: {
        IsDefinedBy: { attributes: true, relations: true },
        DefinesOccurrence: { attributes: false, relations: false }
      }
    }
  };
  updateRequests = {};
  createRequests = {};
  removeRequests = {};
  _elementChanged = false;
  get elementChanged() {
    return this._elementChanged;
  }
  constructor(id, data, model) {
    this.localId = id;
    this.core = data;
    this.model = model;
  }
  getRequests() {
    const createRequests = Object.values(this.createRequests);
    this.createRequests = {};
    const updateRequests = Object.values(this.updateRequests);
    this.updateRequests = {};
    const removeRequests = Object.values(this.removeRequests);
    this.removeRequests = {};
    const requests = [...removeRequests, ...createRequests, ...updateRequests];
    if (requests.length > 0) {
      return requests;
    }
    return null;
  }
  // Deletes all samples, global transform, item and relationships in related items
  delete() {
    if (this.createRequests[this.localId]) {
      delete this.createRequests[this.localId];
    } else {
      this.removeRequests[this.localId] = {
        type: EditRequestType.DELETE_ITEM,
        localId: this.localId
      };
    }
    for (const sampleIdStr in this.core.samples) {
      const sample = this.core.samples[sampleIdStr];
      const sampleId = parseInt(sampleIdStr, 10);
      if (this.createRequests[sample.localTransform]) {
        delete this.createRequests[sample.localTransform];
      } else {
        this.removeRequests[sample.localTransform] = {
          type: EditRequestType.DELETE_LOCAL_TRANSFORM,
          localId: sample.localTransform
        };
      }
      if (this.createRequests[sample.representation]) {
        delete this.createRequests[sample.representation];
      } else {
        this.removeRequests[sample.representation] = {
          type: EditRequestType.DELETE_REPRESENTATION,
          localId: sample.representation
        };
      }
      if (this.createRequests[sample.material]) {
        delete this.createRequests[sample.material];
      } else {
        this.removeRequests[sample.material] = {
          type: EditRequestType.DELETE_MATERIAL,
          localId: sample.material
        };
      }
      if (this.createRequests[sample.item]) {
        delete this.createRequests[sample.item];
      } else {
        this.removeRequests[sample.item] = {
          type: EditRequestType.DELETE_GLOBAL_TRANSFORM,
          localId: sample.item
        };
      }
      if (this.createRequests[sampleId]) {
        delete this.createRequests[sampleId];
      } else {
        this.removeRequests[sampleId] = {
          type: EditRequestType.DELETE_SAMPLE,
          localId: sampleId
        };
      }
    }
  }
  async getData() {
    const result = await this.model.getItemsData(
      [this.localId],
      this.config.data
    );
    return result[0];
  }
  getGlobalTransformId() {
    return parseInt(Object.keys(this.core.globalTransforms)[0], 10);
  }
  disposeMeshes(meshes, config) {
    const disposeGeometry = config?.disposeGeometry ?? true;
    const disposeMaterial = config?.disposeMaterial ?? true;
    meshes.removeFromParent();
    meshes.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (disposeGeometry) {
          child.geometry.dispose();
        }
        if (disposeMaterial) {
          child.material.dispose();
        }
      }
    });
  }
  async getMeshes() {
    const meshes = new THREE.Group();
    const firstGt = Object.values(this.core.globalTransforms)[0];
    const globalTransform = GeomsFbUtils.matrixFromTransform(firstGt);
    meshes.applyMatrix4(globalTransform);
    const materialList = /* @__PURE__ */ new Map();
    const geometryList = /* @__PURE__ */ new Map();
    const repsIds = Object.keys(this.core.representations).map(Number);
    const geometries = await this.model.getGeometries(repsIds);
    const geometriesByReprId = /* @__PURE__ */ new Map();
    for (const geometry of geometries) {
      const reprId = geometry.representationId;
      geometriesByReprId.set(reprId, geometry);
    }
    for (const sampleIdStr in this.core.samples) {
      const sampleId = parseInt(sampleIdStr, 10);
      const sample = this.core.samples[sampleId];
      const meshData = geometriesByReprId.get(sample.representation);
      if (!meshData) {
        throw new Error(
          `No geometry found for representation ${sample.representation}`
        );
      }
      const { indices, positions, normals } = meshData;
      if (!indices || !positions || !normals) {
        continue;
      }
      if (!materialList.has(sample.material)) {
        const { r, g, b, a } = this.core.materials[sample.material];
        const color = new THREE.Color().setRGB(
          r / 255,
          g / 255,
          b / 255,
          THREE.SRGBColorSpace
        );
        const material2 = new THREE.MeshLambertMaterial({
          color,
          transparent: true,
          opacity: a / 255
        });
        material2.userData.localId = sample.material;
        materialList.set(sample.material, material2);
      }
      const material = materialList.get(sample.material);
      const lt = this.core.localTransforms[sample.localTransform];
      const localTransform = GeomsFbUtils.matrixFromTransform(lt);
      if (!geometryList.has(sample.representation)) {
        const geometry2 = new THREE.BufferGeometry();
        geometry2.setIndex(Array.from(indices));
        geometry2.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3)
        );
        geometry2.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
        geometry2.userData.localId = sample.representation;
        geometryList.set(sample.representation, geometry2);
      }
      const geometry = geometryList.get(sample.representation);
      const group = new THREE.Group();
      group.userData.localId = sample.localTransform;
      meshes.add(group);
      group.applyMatrix4(localTransform);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.sampleId = sampleId;
      group.add(mesh);
    }
    return meshes;
  }
  async setMeshes(meshes) {
    const pastMeshes = await this.getMeshes();
    let sameGlobalTransform = true;
    meshes.updateMatrix();
    const p = 1e3;
    for (let i = 0; i < meshes.matrix.elements.length; i++) {
      const element = Math.trunc(meshes.matrix.elements[i] * p) / p;
      const pastElement = Math.trunc(pastMeshes.matrix.elements[i] * p) / p;
      if (element !== pastElement) {
        sameGlobalTransform = false;
        break;
      }
    }
    if (!sameGlobalTransform) {
      const gtId = parseInt(Object.keys(this.core.globalTransforms)[0], 10);
      const gt = this.core.globalTransforms[gtId];
      GeomsFbUtils.transformFromMatrix(meshes.matrix, gt);
      this._elementChanged = true;
      this.updateRequests[gtId] = {
        type: EditRequestType.UPDATE_GLOBAL_TRANSFORM,
        localId: gtId,
        data: gt
      };
    }
    const oldMaterials = /* @__PURE__ */ new Map();
    const newMaterials = /* @__PURE__ */ new Map();
    pastMeshes.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        oldMaterials.set(object.material.userData.localId, object.material);
      }
    });
    meshes.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        newMaterials.set(object.material.userData.localId, object.material);
      }
    });
    for (const [localId, oldMat] of oldMaterials) {
      const newMat = newMaterials.get(localId);
      if (!newMat) {
        continue;
      }
      const oldR = oldMat.color.r;
      const oldG = oldMat.color.g;
      const oldB = oldMat.color.b;
      const oldA = oldMat.opacity;
      const newR = newMat.color.r;
      const newG = newMat.color.g;
      const newB = newMat.color.b;
      const newA = newMat.opacity;
      const matData = this.core.materials[localId];
      matData.r = newR * 255;
      matData.g = newG * 255;
      matData.b = newB * 255;
      matData.a = newA * 255;
      if (oldR !== newR || oldG !== newG || oldB !== newB || oldA !== newA) {
        this._elementChanged = true;
        this.updateRequests[localId] = {
          type: EditRequestType.UPDATE_MATERIAL,
          localId,
          data: matData
        };
      }
    }
    oldMaterials.clear();
    newMaterials.clear();
    const oldLocalTransforms = /* @__PURE__ */ new Map();
    const newLocalTransforms = /* @__PURE__ */ new Map();
    for (const group of meshes.children) {
      group.updateMatrix();
      newLocalTransforms.set(group.userData.localId, group.matrix);
    }
    for (const group of pastMeshes.children) {
      oldLocalTransforms.set(group.userData.localId, group.matrix);
    }
    for (const [localId, oldLocalTransform] of oldLocalTransforms) {
      const newLocalTransform = newLocalTransforms.get(localId);
      if (!newLocalTransform) {
        continue;
      }
      if (!oldLocalTransform.equals(newLocalTransform)) {
        const lt = this.core.localTransforms[localId];
        GeomsFbUtils.transformFromMatrix(newLocalTransform, lt);
        this._elementChanged = true;
        this.updateRequests[localId] = {
          type: EditRequestType.UPDATE_LOCAL_TRANSFORM,
          localId,
          data: lt
        };
      }
    }
    oldLocalTransforms.clear();
    newLocalTransforms.clear();
    const oldGeoms = /* @__PURE__ */ new Map();
    const newGeoms = /* @__PURE__ */ new Map();
    meshes.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const geometry = object.geometry;
        newGeoms.set(geometry.userData.localId, geometry);
      }
    });
    pastMeshes.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const geometry = object.geometry;
        oldGeoms.set(geometry.userData.localId, geometry);
      }
    });
    for (const [localId, oldGeom] of oldGeoms) {
      const repr = this.core.representations[localId];
      if (repr.representationClass === RepresentationClass.CIRCLE_EXTRUSION) {
        continue;
      }
      const newGeom = newGeoms.get(localId);
      if (!newGeom) {
        continue;
      }
      let sameVertices = true;
      const oldPosAttribute = oldGeom.getAttribute("position");
      const newPosAttribute = newGeom.getAttribute("position");
      if (oldPosAttribute && newPosAttribute) {
        if (oldPosAttribute.count === newPosAttribute.count) {
          for (let i = 0; i < oldPosAttribute.array.length; i++) {
            if (oldPosAttribute.array[i] !== newPosAttribute.array[i]) {
              sameVertices = false;
              break;
            }
          }
        } else {
          sameVertices = false;
        }
      }
      if (!sameVertices) {
        GeomsFbUtils.representationFromGeometry(newGeom, repr);
        this._elementChanged = true;
        this.updateRequests[localId] = {
          type: EditRequestType.UPDATE_REPRESENTATION,
          localId,
          data: repr
        };
      }
    }
  }
  createSamples(samples) {
    for (const sample of samples) {
      const tempId = Math.trunc(performance.now());
      this.core.samples[tempId] = sample;
      this.createRequests[tempId] = {
        type: EditRequestType.CREATE_SAMPLE,
        data: sample
      };
    }
  }
  deleteSamples(ids) {
    this._elementChanged = true;
    for (const id of ids) {
      const count = Object.keys(this.core.samples).length;
      if (count === 1) {
        continue;
      }
      delete this.core.samples[id];
      delete this.updateRequests[id];
      if (this.createRequests[id]) {
        delete this.createRequests[id];
      } else {
        this.removeRequests[id] = {
          type: EditRequestType.DELETE_SAMPLE,
          localId: id
        };
      }
    }
  }
  async updateSamples() {
    const matsToDelete = new Set(
      Object.keys(this.core.materials).map(Number)
    );
    const ltsToDelete = new Set(
      Object.keys(this.core.localTransforms).map(Number)
    );
    const gtsToDelete = new Set(
      Object.keys(this.core.globalTransforms).map(Number)
    );
    const repsToDelete = new Set(
      Object.keys(this.core.representations).map(Number)
    );
    const materialsToGet = /* @__PURE__ */ new Set();
    const gtsToGet = /* @__PURE__ */ new Set();
    const ltsToGet = /* @__PURE__ */ new Set();
    const representationsToGet = /* @__PURE__ */ new Set();
    const samplesToUpdate = /* @__PURE__ */ new Set();
    for (const sampleIdStr in this.core.samples) {
      const sampleId = parseInt(sampleIdStr, 10);
      const sample = this.core.samples[sampleId];
      matsToDelete.delete(sample.material);
      gtsToDelete.delete(sample.item);
      ltsToDelete.delete(sample.localTransform);
      repsToDelete.delete(sample.representation);
      if (!this.core.materials[sample.material]) {
        samplesToUpdate.add(sampleId);
        materialsToGet.add(sample.material);
      }
      if (!this.core.globalTransforms[sample.item]) {
        samplesToUpdate.add(sampleId);
        gtsToGet.add(sample.item);
      }
      if (!this.core.localTransforms[sample.localTransform]) {
        samplesToUpdate.add(sampleId);
        ltsToGet.add(sample.localTransform);
      }
      if (!this.core.representations[sample.representation]) {
        samplesToUpdate.add(sampleId);
        representationsToGet.add(sample.representation);
      }
    }
    for (const matId of matsToDelete) {
      delete this.core.materials[matId];
    }
    for (const gtId of gtsToDelete) {
      delete this.core.globalTransforms[gtId];
    }
    for (const ltId of ltsToDelete) {
      delete this.core.localTransforms[ltId];
    }
    for (const repId of repsToDelete) {
      delete this.core.representations[repId];
    }
    let newMats = /* @__PURE__ */ new Map();
    if (materialsToGet.size) {
      newMats = await this.model.getMaterials(materialsToGet);
    }
    let newGts = /* @__PURE__ */ new Map();
    if (gtsToGet.size) {
      newGts = await this.model.getGlobalTransforms(gtsToGet);
    }
    let newLts = /* @__PURE__ */ new Map();
    if (ltsToGet.size) {
      newLts = await this.model.getLocalTransforms(ltsToGet);
    }
    let newReps = /* @__PURE__ */ new Map();
    if (representationsToGet.size) {
      newReps = await this.model.getRepresentations(representationsToGet);
    }
    for (const [id, material] of newMats) {
      this.core.materials[id] = material;
    }
    for (const [id, gt] of newGts) {
      this.core.globalTransforms[id] = gt;
    }
    for (const [id, lt] of newLts) {
      this.core.localTransforms[id] = lt;
    }
    for (const [id, rep] of newReps) {
      this.core.representations[id] = rep;
    }
    for (const sampleId of samplesToUpdate) {
      if (this.createRequests[sampleId]) {
        const createRequest = this.createRequests[sampleId];
        createRequest.data = this.core.samples[sampleId];
        continue;
      }
      this._elementChanged = true;
      this.updateRequests[sampleId] = {
        type: EditRequestType.UPDATE_SAMPLE,
        localId: sampleId,
        data: this.core.samples[sampleId]
      };
    }
  }
}
export {
  Element
};
//# sourceMappingURL=element.mjs.map
