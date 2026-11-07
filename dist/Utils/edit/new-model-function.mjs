import "../../vendor/flatbuffers/mjs/utils.mjs";
import "../../vendor/flatbuffers/mjs/encoding.mjs";
import { Builder } from "../../vendor/flatbuffers/mjs/builder.mjs";
import * as THREE from "three";
import pako from "../../vendor/pako/dist/pako.esm.mjs";
import { createTransform } from "./transfom-functions.mjs";
import { getProvenanceMetadata } from "../version.mjs";
import { Meshes } from "../../Schema/meshes.mjs";
import { Model } from "../../Schema/model.mjs";
function newModel(config) {
  const builder = new Builder(1024);
  Meshes.startGlobalTransformsVector(builder, 0);
  const globalTransformsRef = builder.endVector();
  const shells = Meshes.createShellsVector(builder, []);
  Meshes.startRepresentationsVector(builder, 0);
  const representationsRef = builder.endVector();
  Meshes.startSamplesVector(builder, 0);
  const samplesOffset = builder.endVector();
  Meshes.startLocalTransformsVector(builder, 0);
  const localTransformRef = builder.endVector();
  Meshes.startMaterialsVector(builder, 0);
  const materialsRef = builder.endVector();
  const circleExtrusions = Meshes.createCircleExtrusionsVector(builder, []);
  const meshesItemsOffset = Meshes.createMeshesItemsVector(builder, []);
  const reprLocalIdsOffset = Meshes.createRepresentationIdsVector(
    builder,
    []
  );
  const sampleLocalIdsOffset = Meshes.createSampleIdsVector(builder, []);
  const materialLocalIdsOffset = Meshes.createMaterialIdsVector(
    builder,
    []
  );
  const ltLocalIdsOffset = Meshes.createLocalTransformIdsVector(
    builder,
    []
  );
  const gtLocalIdsOffset = Meshes.createGlobalTransformIdsVector(
    builder,
    []
  );
  Meshes.startMeshes(builder);
  const coordinatesRef = createTransform(
    {
      position: [0, 0, 0],
      xDirection: [1, 0, 0],
      yDirection: [0, 1, 0]
    },
    builder
  );
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
  const metadataOffset = builder.createString(
    JSON.stringify(getProvenanceMetadata())
  );
  const attributesVector = Model.createAttributesVector(builder, []);
  const uniqueAttributesVector = Model.createUniqueAttributesVector(
    builder,
    []
  );
  const relNamesVector = Model.createRelationNamesVector(builder, []);
  const localIdsVector = Model.createLocalIdsVector(builder, []);
  const categoriesVector = Model.createCategoriesVector(builder, []);
  const relIndicesVector = Model.createRelationsItemsVector(builder, []);
  const relsVector = Model.createRelationsVector(builder, []);
  const guidsItemsVector = Model.createGuidsItemsVector(builder, []);
  const guidsVector = Model.createGuidsVector(builder, []);
  const guidRef = builder.createString(THREE.MathUtils.generateUUID());
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
  Model.addGuid(builder, guidRef);
  Model.addMaxLocalId(builder, 1);
  const outData = Model.endModel(builder);
  builder.finish(outData);
  const outBytes = builder.asUint8Array();
  builder.clear();
  const result = config.raw ? outBytes : pako.deflate(outBytes);
  return result;
}
export {
  newModel
};
//# sourceMappingURL=new-model-function.mjs.map
