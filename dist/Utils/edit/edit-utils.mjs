import { edit } from "./edit-function.mjs";
import { newModel } from "./new-model-function.mjs";
import { getModelFromBuffer, getSampleData, getTransformData, getRelationData, getMaterialData, getRepresentationData, getShellData, getMaterialsIds, getMaterials, getRepresentationsIds, getRepresentations, getLocalTransformsIds, getLocalTransforms, getGlobalTransformsIds, getGlobalTransforms, getSamplesIds, getSamples, getItemsIds, getItems, getGlobalTranformsIdsOfItems, getElementsData, getItemSnapData, getGeometryIndicesFromRepresentations, getRootModelId, getSerializedAttributes, itemDataToRawItemData, DELTA_MODEL_ID } from "./fetch-functions.mjs";
import { solveIds } from "./id-solver.mjs";
import { applyChangesToRawData, applyChangesToSpecialData, applyChangesToIds } from "./request-filterer.mjs";
class EditUtils {
  static edit = edit;
  static solveIds = solveIds;
  static newModel = newModel;
  static applyChangesToRawData = applyChangesToRawData;
  static applyChangesToSpecialData = applyChangesToSpecialData;
  static applyChangesToIds = applyChangesToIds;
  static getModelFromBuffer = getModelFromBuffer;
  static getSampleData = getSampleData;
  static getTransformData = getTransformData;
  static getRelationData = getRelationData;
  static getMaterialData = getMaterialData;
  static getRepresentationData = getRepresentationData;
  static getShellData = getShellData;
  static getMaterialsIds = getMaterialsIds;
  static getMaterials = getMaterials;
  static getRepresentationsIds = getRepresentationsIds;
  static getRepresentations = getRepresentations;
  static getLocalTransformsIds = getLocalTransformsIds;
  static getLocalTransforms = getLocalTransforms;
  static getGlobalTransformsIds = getGlobalTransformsIds;
  static getGlobalTransforms = getGlobalTransforms;
  static getSamplesIds = getSamplesIds;
  static getSamples = getSamples;
  static getItemsIds = getItemsIds;
  static getItems = getItems;
  static getGlobalTranformsIdsOfItems = getGlobalTranformsIdsOfItems;
  static getElementsData = getElementsData;
  static getItemSnapData = getItemSnapData;
  static getGeometryIndicesFromRepresentations = getGeometryIndicesFromRepresentations;
  static getRootModelId = getRootModelId;
  static getSerializedAttributes = getSerializedAttributes;
  static itemDataToRawItemData = itemDataToRawItemData;
  static DELTA_MODEL_ID = DELTA_MODEL_ID;
}
export {
  EditUtils
};
//# sourceMappingURL=edit-utils.mjs.map
