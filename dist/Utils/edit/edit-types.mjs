var EditRequestType = /* @__PURE__ */ ((EditRequestType2) => {
  EditRequestType2[EditRequestType2["CREATE_MATERIAL"] = 0] = "CREATE_MATERIAL";
  EditRequestType2[EditRequestType2["CREATE_REPRESENTATION"] = 1] = "CREATE_REPRESENTATION";
  EditRequestType2[EditRequestType2["CREATE_SAMPLE"] = 2] = "CREATE_SAMPLE";
  EditRequestType2[EditRequestType2["CREATE_GLOBAL_TRANSFORM"] = 3] = "CREATE_GLOBAL_TRANSFORM";
  EditRequestType2[EditRequestType2["CREATE_LOCAL_TRANSFORM"] = 4] = "CREATE_LOCAL_TRANSFORM";
  EditRequestType2[EditRequestType2["CREATE_ITEM"] = 5] = "CREATE_ITEM";
  EditRequestType2[EditRequestType2["CREATE_RELATION"] = 6] = "CREATE_RELATION";
  EditRequestType2[EditRequestType2["UPDATE_MATERIAL"] = 7] = "UPDATE_MATERIAL";
  EditRequestType2[EditRequestType2["UPDATE_REPRESENTATION"] = 8] = "UPDATE_REPRESENTATION";
  EditRequestType2[EditRequestType2["UPDATE_SAMPLE"] = 9] = "UPDATE_SAMPLE";
  EditRequestType2[EditRequestType2["UPDATE_GLOBAL_TRANSFORM"] = 10] = "UPDATE_GLOBAL_TRANSFORM";
  EditRequestType2[EditRequestType2["UPDATE_LOCAL_TRANSFORM"] = 11] = "UPDATE_LOCAL_TRANSFORM";
  EditRequestType2[EditRequestType2["UPDATE_ITEM"] = 12] = "UPDATE_ITEM";
  EditRequestType2[EditRequestType2["UPDATE_MAX_LOCAL_ID"] = 13] = "UPDATE_MAX_LOCAL_ID";
  EditRequestType2[EditRequestType2["UPDATE_RELATION"] = 14] = "UPDATE_RELATION";
  EditRequestType2[EditRequestType2["UPDATE_METADATA"] = 15] = "UPDATE_METADATA";
  EditRequestType2[EditRequestType2["UPDATE_SPATIAL_STRUCTURE"] = 16] = "UPDATE_SPATIAL_STRUCTURE";
  EditRequestType2[EditRequestType2["DELETE_MATERIAL"] = 17] = "DELETE_MATERIAL";
  EditRequestType2[EditRequestType2["DELETE_REPRESENTATION"] = 18] = "DELETE_REPRESENTATION";
  EditRequestType2[EditRequestType2["DELETE_SAMPLE"] = 19] = "DELETE_SAMPLE";
  EditRequestType2[EditRequestType2["DELETE_GLOBAL_TRANSFORM"] = 20] = "DELETE_GLOBAL_TRANSFORM";
  EditRequestType2[EditRequestType2["DELETE_LOCAL_TRANSFORM"] = 21] = "DELETE_LOCAL_TRANSFORM";
  EditRequestType2[EditRequestType2["DELETE_ITEM"] = 22] = "DELETE_ITEM";
  EditRequestType2[EditRequestType2["DELETE_RELATION"] = 23] = "DELETE_RELATION";
  EditRequestType2[EditRequestType2["CREATE_INDEX"] = 24] = "CREATE_INDEX";
  EditRequestType2[EditRequestType2["UPDATE_INDEX"] = 25] = "UPDATE_INDEX";
  EditRequestType2[EditRequestType2["DELETE_INDEX"] = 26] = "DELETE_INDEX";
  return EditRequestType2;
})(EditRequestType || {});
const EditRequestTypeNames = {
  [
    0
    /* CREATE_MATERIAL */
  ]: "Create Material",
  [
    1
    /* CREATE_REPRESENTATION */
  ]: "Create Representation",
  [
    2
    /* CREATE_SAMPLE */
  ]: "Create Sample",
  [
    3
    /* CREATE_GLOBAL_TRANSFORM */
  ]: "Create Global Transform",
  [
    4
    /* CREATE_LOCAL_TRANSFORM */
  ]: "Create Local Transform",
  [
    5
    /* CREATE_ITEM */
  ]: "Create Item",
  [
    6
    /* CREATE_RELATION */
  ]: "Create Relation",
  [
    7
    /* UPDATE_MATERIAL */
  ]: "Update Material",
  [
    8
    /* UPDATE_REPRESENTATION */
  ]: "Update Representation",
  [
    9
    /* UPDATE_SAMPLE */
  ]: "Update Sample",
  [
    10
    /* UPDATE_GLOBAL_TRANSFORM */
  ]: "Update Global Transform",
  [
    11
    /* UPDATE_LOCAL_TRANSFORM */
  ]: "Update Local Transform",
  [
    12
    /* UPDATE_ITEM */
  ]: "Update Item",
  [
    13
    /* UPDATE_MAX_LOCAL_ID */
  ]: "Update Max Local Id",
  [
    14
    /* UPDATE_RELATION */
  ]: "Update Relation",
  [
    15
    /* UPDATE_METADATA */
  ]: "Update Metadata",
  [
    16
    /* UPDATE_SPATIAL_STRUCTURE */
  ]: "Update Spatial Structure",
  [
    17
    /* DELETE_MATERIAL */
  ]: "Delete Material",
  [
    18
    /* DELETE_REPRESENTATION */
  ]: "Delete Representation",
  [
    19
    /* DELETE_SAMPLE */
  ]: "Delete Sample",
  [
    20
    /* DELETE_GLOBAL_TRANSFORM */
  ]: "Delete Global Transform",
  [
    21
    /* DELETE_LOCAL_TRANSFORM */
  ]: "Delete Local Transform",
  [
    22
    /* DELETE_ITEM */
  ]: "Delete Item",
  [
    23
    /* DELETE_RELATION */
  ]: "Delete Relation",
  [
    24
    /* CREATE_INDEX */
  ]: "Create Index",
  [
    25
    /* UPDATE_INDEX */
  ]: "Update Index",
  [
    26
    /* DELETE_INDEX */
  ]: "Delete Index"
};
function isIndexRequest(request) {
  return request.type === 24 || request.type === 25 || request.type === 26;
}
export {
  EditRequestType,
  EditRequestTypeNames,
  isIndexRequest
};
//# sourceMappingURL=edit-types.mjs.map
