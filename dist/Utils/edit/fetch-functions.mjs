import "../../vendor/flatbuffers/mjs/utils.mjs";
import "../../vendor/flatbuffers/mjs/encoding.mjs";
import { ByteBuffer } from "../../vendor/flatbuffers/mjs/byte-buffer.mjs";
import pako from "../../vendor/pako/dist/pako.esm.mjs";
import { Model } from "../../Schema/model.mjs";
import { Material } from "../../Schema/material.mjs";
import { Representation } from "../../Schema/representation.mjs";
import { RepresentationClass } from "../../Schema/representation-class.mjs";
import { Transform } from "../../Schema/transform.mjs";
import { Sample } from "../../Schema/sample.mjs";
import { Shell } from "../../Schema/shell.mjs";
const DELTA_MODEL_ID = "-DELTA-MODEL-";
function getRootModelId(modelId) {
  if (modelId.includes(DELTA_MODEL_ID)) {
    return modelId.substring(0, modelId.indexOf(DELTA_MODEL_ID));
  }
  return modelId;
}
function getModelFromBuffer(bytes, raw) {
  const byteBuffer = new ByteBuffer(raw ? bytes : pako.inflate(bytes));
  const readModel = Model.getRootAsModel(byteBuffer);
  return readModel;
}
function getSampleData(sample) {
  return {
    item: sample.item(),
    localTransform: sample.localTransform(),
    material: sample.material(),
    representation: sample.representation()
  };
}
function getTransformData(lt) {
  const position = lt.position();
  const xDir = lt.xDirection();
  const yDir = lt.yDirection();
  const transform = {
    position: [position.x(), position.y(), position.z()],
    xDirection: [xDir.x(), xDir.y(), xDir.z()],
    yDirection: [yDir.x(), yDir.y(), yDir.z()]
  };
  return transform;
}
function getRelationData(relation) {
  const result = {
    data: {}
  };
  const dataLength = relation.dataLength();
  for (let j = 0; j < dataLength; j++) {
    const currentData = relation.data(j);
    const [name, ...ids] = JSON.parse(currentData);
    result.data[name] = ids;
  }
  return result;
}
function getMaterialData(material) {
  return {
    r: material.r(),
    g: material.g(),
    b: material.b(),
    a: material.a(),
    renderedFaces: material.renderedFaces(),
    stroke: material.stroke()
  };
}
function getRepresentationData(representation) {
  const bbox = representation.bbox();
  const min = bbox.min();
  const max = bbox.max();
  return {
    id: representation.id(),
    bbox: [min.x(), min.y(), min.z(), max.x(), max.y(), max.z()],
    representationClass: representation.representationClass()
  };
}
function getShellData(shell) {
  const points = [];
  for (let i = 0; i < shell.pointsLength(); i++) {
    const point = shell.points(i);
    points.push([point.x(), point.y(), point.z()]);
  }
  const profiles = /* @__PURE__ */ new Map();
  for (let i = 0; i < shell.profilesLength(); i++) {
    const profile = shell.profiles(i);
    const indices = Array.from(profile.indicesArray() || []);
    profiles.set(i, indices);
  }
  const holes = /* @__PURE__ */ new Map();
  for (let i = 0; i < shell.holesLength(); i++) {
    const hole = shell.holes(i);
    const indices = Array.from(hole.indicesArray() || []);
    const profileId = hole.profileId();
    if (!holes.has(profileId)) {
      holes.set(profileId, []);
    }
    holes.get(profileId).push(indices);
  }
  const bigProfiles = /* @__PURE__ */ new Map();
  for (let i = 0; i < shell.bigProfilesLength(); i++) {
    const profile = shell.bigProfiles(i);
    const indices = Array.from(profile.indicesArray() || []);
    bigProfiles.set(i, indices);
  }
  const bigHoles = /* @__PURE__ */ new Map();
  for (let i = 0; i < shell.bigHolesLength(); i++) {
    const hole = shell.bigHoles(i);
    const indices = Array.from(hole.indicesArray() || []);
    const profileId = hole.profileId();
    if (!bigHoles.has(profileId)) {
      bigHoles.set(profileId, []);
    }
    bigHoles.get(profileId).push(indices);
  }
  const profilesFaceIds = Array.from(shell.profilesFaceIdsArray() || []);
  return {
    points,
    profiles,
    holes,
    bigProfiles,
    bigHoles,
    type: shell.type(),
    profilesFaceIds
  };
}
function getCircleExtrusionData(circleExtrusion) {
  const result = {
    radius: [],
    axes: []
  };
  const radius = circleExtrusion.radiusArray();
  result.radius = Array.from(radius);
  const axesLength = circleExtrusion.axesLength();
  for (let i = 0; i < axesLength; i++) {
    const axis = circleExtrusion.axes(i);
    const wiresLength = axis.wiresLength();
    const wires = [];
    for (let j = 0; j < wiresLength; j++) {
      const wire = axis.wires(j);
      const p1 = wire.p1();
      const p2 = wire.p2();
      wires.push([p1.x(), p1.y(), p1.z(), p2.x(), p2.y(), p2.z()]);
    }
    const orderLength = axis.orderLength();
    const order = [];
    for (let j = 0; j < orderLength; j++) {
      order.push(axis.order(j));
    }
    const partsLength = axis.partsLength();
    const parts = [];
    for (let j = 0; j < partsLength; j++) {
      parts.push(axis.parts(j));
    }
    const wireSetsLength = axis.wireSetsLength();
    const wireSets = [];
    for (let j = 0; j < wireSetsLength; j++) {
      const wireSet = axis.wireSets(j);
      const psLength = wireSet.psLength();
      const ps = [];
      for (let k = 0; k < psLength; k++) {
        const p = wireSet.ps(k);
        ps.push(p.x(), p.y(), p.z());
      }
      wireSets.push(ps);
    }
    const circleCurvesLength = axis.circleCurvesLength();
    const circleCurves = [];
    for (let j = 0; j < circleCurvesLength; j++) {
      const circleCurve = axis.circleCurves(j);
      const aperture = circleCurve.aperture();
      const position = circleCurve.position();
      const px = position.x();
      const py = position.y();
      const pz = position.z();
      const radius2 = circleCurve.radius();
      const xDirection = circleCurve.xDirection();
      const dx = xDirection.x();
      const dy = xDirection.y();
      const dz = xDirection.z();
      const yDirection = circleCurve.yDirection();
      const dyx = yDirection.x();
      const dyy = yDirection.y();
      const dyz = yDirection.z();
      circleCurves.push({
        aperture,
        position: [px, py, pz],
        radius: radius2,
        xDirection: [dx, dy, dz],
        yDirection: [dyx, dyy, dyz]
      });
    }
    result.axes.push({
      wires,
      order,
      parts,
      wireSets,
      circleCurves
    });
  }
  return result;
}
function getMaterialsIds(model) {
  const meshes = model.meshes();
  return meshes.materialIdsArray() || [];
}
function getMaterials(model, ids) {
  const meshes = model.meshes();
  const source = ids || meshes.materialIdsArray();
  const idsSet = new Set(source);
  const tempMaterial = new Material();
  const materials = /* @__PURE__ */ new Map();
  for (let i = 0; i < meshes.materialsLength(); i++) {
    const matLocalId = meshes.materialIds(i);
    if (!idsSet.has(matLocalId)) {
      continue;
    }
    meshes.materials(i, tempMaterial);
    const material = getMaterialData(tempMaterial);
    materials.set(matLocalId, material);
  }
  return materials;
}
function getRepresentationsIds(model) {
  const meshes = model.meshes();
  return meshes.representationIdsArray() || [];
}
function getRepresentations(model, ids) {
  const meshes = model.meshes();
  const source = ids || meshes.representationIdsArray();
  const idsSet = new Set(source);
  const representations = /* @__PURE__ */ new Map();
  const tempRepresentation = new Representation();
  for (let i = 0; i < meshes.representationsLength(); i++) {
    const representationLocalId = meshes.representationIds(i);
    if (!idsSet.has(representationLocalId)) {
      continue;
    }
    meshes.representations(i, tempRepresentation);
    const repr = getRepresentationData(tempRepresentation);
    if (repr.representationClass === RepresentationClass.SHELL) {
      const fbshell = meshes.shells(repr.id);
      const shell = getShellData(fbshell);
      repr.geometry = shell;
    } else if (repr.representationClass === RepresentationClass.CIRCLE_EXTRUSION) {
      const fbcirclExtrusion = meshes.circleExtrusions(repr.id);
      const circleExtrusion = getCircleExtrusionData(fbcirclExtrusion);
      repr.geometry = circleExtrusion;
    }
    representations.set(representationLocalId, repr);
  }
  return representations;
}
function getGeometryIndicesFromRepresentations(model, ids) {
  const meshes = model.meshes();
  const source = ids || meshes.representationIdsArray();
  const idsSet = new Set(source);
  const tempRepresentation = new Representation();
  const shells = /* @__PURE__ */ new Set();
  const rebars = /* @__PURE__ */ new Set();
  for (let i = 0; i < meshes.representationsLength(); i++) {
    const representationLocalId = meshes.representationIds(i);
    if (!idsSet.has(representationLocalId)) {
      continue;
    }
    meshes.representations(i, tempRepresentation);
    const repr = getRepresentationData(tempRepresentation);
    if (repr.representationClass === RepresentationClass.SHELL) {
      shells.add(repr.id);
    } else if (repr.representationClass === RepresentationClass.CIRCLE_EXTRUSION) {
      rebars.add(repr.id);
    } else {
      throw new Error("Rebars not supported yet");
    }
  }
  return {
    shellsIndices: shells,
    rebarsIndices: rebars
  };
}
function getSerializedAttributes(attributes) {
  const datas = [];
  for (const name in attributes) {
    if (name[0] === "_") {
      continue;
    }
    const current = attributes[name];
    if (Array.isArray(current)) {
      continue;
    }
    const value = current.value;
    const type = current.type;
    const serialized = JSON.stringify([name, value, type]);
    datas.push(serialized);
  }
  return datas;
}
function itemDataToRawItemData(item) {
  const categoryAttr = item._category;
  if (!categoryAttr) {
    throw new Error("Category is required");
  }
  const category = categoryAttr.value;
  const guidAttr = item._guid;
  const data = {};
  for (const name in item) {
    if (name[0] === "_") {
      continue;
    }
    const attr = item[name];
    if (Array.isArray(attr)) {
      continue;
    }
    data[name] = attr;
  }
  const guid = guidAttr ? guidAttr.value : void 0;
  return {
    data,
    category,
    guid
  };
}
function getLocalTransformsIds(model) {
  const meshes = model.meshes();
  return meshes.localTransformIdsArray() || [];
}
function getLocalTransforms(model, ids) {
  const meshes = model.meshes();
  const source = ids || meshes.localTransformIdsArray();
  const idsSet = new Set(source);
  const localTransforms = /* @__PURE__ */ new Map();
  const tempTranform = new Transform();
  for (let i = 0; i < meshes.localTransformsLength(); i++) {
    const localTransformLocalId = meshes.localTransformIds(i);
    if (!idsSet.has(localTransformLocalId)) {
      continue;
    }
    meshes.localTransforms(i, tempTranform);
    const lt = getTransformData(tempTranform);
    localTransforms.set(localTransformLocalId, lt);
  }
  return localTransforms;
}
function getGlobalTransformsIds(model) {
  const meshes = model.meshes();
  return meshes.globalTransformIdsArray() || [];
}
function getGlobalTransforms(model, ids) {
  const meshes = model.meshes();
  let source = null;
  if (ids) {
    source = new Set(ids);
  } else {
    source = new Set(meshes.globalTransformIdsArray());
  }
  const globalTransforms = /* @__PURE__ */ new Map();
  const tempTransform = new Transform();
  const gtLength = meshes.globalTransformsLength();
  for (let i = 0; i < gtLength; i++) {
    meshes.globalTransforms(i, tempTransform);
    const localId = meshes.globalTransformIds(i);
    const idIndex = meshes.meshesItems(i);
    const itemId = model.localIds(idIndex);
    if (!source.has(localId)) continue;
    const gtData = getTransformData(tempTransform);
    globalTransforms.set(localId, { ...gtData, itemId });
  }
  return globalTransforms;
}
function getSamplesIds(model) {
  const meshes = model.meshes();
  const samples = meshes.sampleIdsArray() || [];
  return samples;
}
function getSamples(model, ids) {
  const meshes = model.meshes();
  const source = ids || meshes.sampleIdsArray();
  const idsSet = new Set(source);
  const samples = /* @__PURE__ */ new Map();
  const tempSample = new Sample();
  for (let i = 0; i < meshes.samplesLength(); i++) {
    const sampleLocalId = meshes.sampleIds(i);
    if (!idsSet.has(sampleLocalId)) {
      continue;
    }
    meshes.samples(i, tempSample);
    const sample = getSampleData(tempSample);
    sample.item = meshes.globalTransformIds(sample.item);
    sample.material = meshes.materialIds(sample.material);
    sample.representation = meshes.representationIds(sample.representation);
    sample.localTransform = meshes.localTransformIds(sample.localTransform);
    samples.set(sampleLocalId, sample);
  }
  return samples;
}
function getItemsIds(model) {
  return model.localIdsArray();
}
function getItems(model, itemIds) {
  let source = /* @__PURE__ */ new Set();
  if (itemIds) {
    source = new Set(itemIds);
  } else {
    for (let i = 0; i < model.localIdsLength(); i++) {
      source.add(i);
    }
  }
  const guidByLocalId = /* @__PURE__ */ new Map();
  for (let j = 0; j < model.guidsItemsLength(); j++) {
    guidByLocalId.set(model.guidsItems(j), model.guids(j));
  }
  const items = /* @__PURE__ */ new Map();
  for (const i of source) {
    const localId = model.localIds(i);
    const category = model.categories(i);
    const guid = guidByLocalId.get(localId);
    const attrsData = model.attributes(i);
    const data = {};
    for (let j = 0; j < attrsData.dataLength(); j++) {
      const attrString = attrsData.data(j);
      const [name, value, type] = JSON.parse(attrString);
      data[name] = { value, type };
    }
    items.set(
      localId,
      guid === void 0 ? { data, category } : { data, category, guid }
    );
  }
  return items;
}
function getGlobalTranformsIdsOfItems(model, ids) {
  const meshes = model.meshes();
  const source = new Set(ids);
  const globalIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < meshes.meshesItemsLength(); i++) {
    const localIdIndex = meshes.meshesItems(i);
    const localId = model.localIds(localIdIndex);
    if (source.has(localId)) {
      globalIds.add(meshes.globalTransformIds(i));
    }
  }
  return Array.from(globalIds);
}
function getElementsData(vModel, ids) {
  const model = vModel.data;
  const meshes = model.meshes();
  const result = {};
  const idSet = new Set(ids);
  const tempTransform = new Transform();
  const tempMaterial = new Material();
  const tempRepresentation = new Representation();
  const tempShell = new Shell();
  for (let i = 0; i < meshes.samplesLength(); i++) {
    const sample = meshes.samples(i);
    const gtIndex = sample.item();
    const idIndex = meshes.meshesItems(gtIndex);
    const localId = model.localIds(idIndex);
    if (!idSet.has(localId)) {
      continue;
    }
    if (!result[localId]) {
      result[localId] = {
        samples: {},
        localTransforms: {},
        globalTransforms: {},
        representations: {},
        materials: {}
      };
    }
    const current = result[localId];
    const ltIndex = sample.localTransform();
    const materialIndex = sample.material();
    const representationIndex = sample.representation();
    const sampleLocalId = meshes.sampleIds(i);
    const gtId = meshes.globalTransformIds(gtIndex);
    const ltId = meshes.localTransformIds(ltIndex);
    const materialId = meshes.materialIds(materialIndex);
    const reprId = meshes.representationIds(representationIndex);
    current.samples[sampleLocalId] = {
      item: gtId,
      localTransform: ltId,
      material: materialId,
      representation: reprId
    };
    meshes.localTransforms(ltIndex, tempTransform);
    current.localTransforms[ltId] = getTransformData(tempTransform);
    meshes.globalTransforms(gtIndex, tempTransform);
    const gTransform = getTransformData(tempTransform);
    current.globalTransforms[gtId] = { ...gTransform, itemId: localId };
    meshes.materials(materialIndex, tempMaterial);
    current.materials[materialId] = getMaterialData(tempMaterial);
    meshes.representations(representationIndex, tempRepresentation);
    const repr = getRepresentationData(tempRepresentation);
    if (repr.representationClass === RepresentationClass.SHELL) {
      meshes.shells(repr.id, tempShell);
      const shell = getShellData(tempShell);
      repr.geometry = shell;
    }
    current.representations[reprId] = repr;
  }
  const relIndicesById = /* @__PURE__ */ new Map();
  for (let i = 0; i < model.relationsItemsLength(); i++) {
    const relLocalId = model.relationsItems(i);
    relIndicesById.set(relLocalId, i);
  }
  const localIdsToIndex = /* @__PURE__ */ new Map();
  for (let i = 0; i < model.localIdsLength(); i++) {
    const localId = model.localIds(i);
    localIdsToIndex.set(localId, i);
  }
  return result;
}
function getItemSnapData(vModel, itemId) {
  const model = vModel.data;
  const meshes = model.meshes();
  const sampleIndices = vModel.boxes.sampleOf(itemId);
  if (!sampleIndices || sampleIndices.length === 0) return null;
  const result = {
    samples: {},
    localTransforms: {},
    globalTransforms: {},
    representations: {},
    materials: {}
  };
  const localIdIndex = meshes.meshesItems(itemId);
  const localId = localIdIndex !== null ? model.localIds(localIdIndex) ?? itemId : itemId;
  const tempTransform = new Transform();
  meshes.globalTransforms(itemId, tempTransform);
  const gTransform = getTransformData(tempTransform);
  const gtId = meshes.globalTransformIds(itemId);
  result.globalTransforms[gtId] = { ...gTransform, itemId: localId };
  const tempRepresentation = new Representation();
  const tempShell = new Shell();
  for (const sampleIndex of sampleIndices) {
    const sample = meshes.samples(sampleIndex);
    const ltIndex = sample.localTransform();
    const representationIndex = sample.representation();
    const sampleLocalId = meshes.sampleIds(sampleIndex);
    const ltId = meshes.localTransformIds(ltIndex);
    const reprId = meshes.representationIds(representationIndex);
    result.samples[sampleLocalId] = {
      item: gtId,
      localTransform: ltId,
      // Snap doesn't read material; keep the field shape but point
      // at a sentinel so callers see a stable type.
      material: 0,
      representation: reprId
    };
    meshes.localTransforms(ltIndex, tempTransform);
    result.localTransforms[ltId] = getTransformData(tempTransform);
    if (result.representations[reprId]) continue;
    meshes.representations(representationIndex, tempRepresentation);
    const repr = getRepresentationData(tempRepresentation);
    if (repr.representationClass === RepresentationClass.SHELL) {
      meshes.shells(repr.id, tempShell);
      const shell = getShellData(tempShell);
      repr.geometry = shell;
    }
    result.representations[reprId] = repr;
  }
  return result;
}
export {
  DELTA_MODEL_ID,
  getCircleExtrusionData,
  getElementsData,
  getGeometryIndicesFromRepresentations,
  getGlobalTranformsIdsOfItems,
  getGlobalTransforms,
  getGlobalTransformsIds,
  getItemSnapData,
  getItems,
  getItemsIds,
  getLocalTransforms,
  getLocalTransformsIds,
  getMaterialData,
  getMaterials,
  getMaterialsIds,
  getModelFromBuffer,
  getRelationData,
  getRepresentationData,
  getRepresentations,
  getRepresentationsIds,
  getRootModelId,
  getSampleData,
  getSamples,
  getSamplesIds,
  getSerializedAttributes,
  getShellData,
  getTransformData,
  itemDataToRawItemData
};
//# sourceMappingURL=fetch-functions.mjs.map
