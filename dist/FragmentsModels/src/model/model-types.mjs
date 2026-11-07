const limitOf2Bytes = 65536;
var ObjectClass = /* @__PURE__ */ ((ObjectClass2) => {
  ObjectClass2[ObjectClass2["LINE"] = 0] = "LINE";
  ObjectClass2[ObjectClass2["SHELL"] = 1] = "SHELL";
  return ObjectClass2;
})(ObjectClass || {});
var TileRequestClass = /* @__PURE__ */ ((TileRequestClass2) => {
  TileRequestClass2[TileRequestClass2["UPDATE"] = 0] = "UPDATE";
  TileRequestClass2[TileRequestClass2["CREATE"] = 1] = "CREATE";
  TileRequestClass2[TileRequestClass2["DELETE"] = 2] = "DELETE";
  TileRequestClass2[TileRequestClass2["FINISH"] = 3] = "FINISH";
  return TileRequestClass2;
})(TileRequestClass || {});
var CurrentLod = /* @__PURE__ */ ((CurrentLod2) => {
  CurrentLod2[CurrentLod2["GEOMETRY"] = 0] = "GEOMETRY";
  CurrentLod2[CurrentLod2["WIRES"] = 1] = "WIRES";
  CurrentLod2[CurrentLod2["INVISIBLE"] = 2] = "INVISIBLE";
  return CurrentLod2;
})(CurrentLod || {});
var MultiThreadingRequestClass = /* @__PURE__ */ ((MultiThreadingRequestClass2) => {
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["CREATE_MODEL"] = 0] = "CREATE_MODEL";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["DELETE_MODEL"] = 1] = "DELETE_MODEL";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["EXECUTE"] = 2] = "EXECUTE";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["RAYCAST"] = 3] = "RAYCAST";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["FETCH_BOXES"] = 4] = "FETCH_BOXES";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["REFRESH_VIEW"] = 5] = "REFRESH_VIEW";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["RECOMPUTE_MESHES"] = 6] = "RECOMPUTE_MESHES";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["CREATE_MATERIAL"] = 7] = "CREATE_MATERIAL";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["THROW_ERROR"] = 8] = "THROW_ERROR";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["LOAD_PROGRESS"] = 9] = "LOAD_PROGRESS";
  MultiThreadingRequestClass2[MultiThreadingRequestClass2["ABORT_MODEL"] = 10] = "ABORT_MODEL";
  return MultiThreadingRequestClass2;
})(MultiThreadingRequestClass || {});
class LoadAbortedError extends Error {
  constructor(modelId) {
    super(`Fragments: Load of model "${modelId}" was aborted.`);
    this.name = "LoadAbortedError";
  }
}
var ItemConfigClass = /* @__PURE__ */ ((ItemConfigClass2) => {
  ItemConfigClass2[ItemConfigClass2["VISIBLE"] = 0] = "VISIBLE";
  return ItemConfigClass2;
})(ItemConfigClass || {});
var SnappingClass = /* @__PURE__ */ ((SnappingClass2) => {
  SnappingClass2[SnappingClass2["POINT"] = 0] = "POINT";
  SnappingClass2[SnappingClass2["LINE"] = 1] = "LINE";
  SnappingClass2[SnappingClass2["FACE"] = 2] = "FACE";
  return SnappingClass2;
})(SnappingClass || {});
const ALIGNMENT_CATEGORY = "ThatOpenAlignment";
const GRID_CATEGORY = "ThatOpenGrid";
var AlignmentCurveType = /* @__PURE__ */ ((AlignmentCurveType2) => {
  AlignmentCurveType2[AlignmentCurveType2["NONE"] = 0] = "NONE";
  AlignmentCurveType2[AlignmentCurveType2["LINES"] = 1] = "LINES";
  AlignmentCurveType2[AlignmentCurveType2["CLOTHOID"] = 2] = "CLOTHOID";
  AlignmentCurveType2[AlignmentCurveType2["ELLIPSE_ARC"] = 3] = "ELLIPSE_ARC";
  AlignmentCurveType2[AlignmentCurveType2["PARABOLA"] = 4] = "PARABOLA";
  return AlignmentCurveType2;
})(AlignmentCurveType || {});
var LodMode = /* @__PURE__ */ ((LodMode2) => {
  LodMode2[LodMode2["DEFAULT"] = 0] = "DEFAULT";
  LodMode2[LodMode2["ALL_VISIBLE"] = 1] = "ALL_VISIBLE";
  LodMode2[LodMode2["ALL_GEOMETRY"] = 2] = "ALL_GEOMETRY";
  return LodMode2;
})(LodMode || {});
export {
  ALIGNMENT_CATEGORY,
  AlignmentCurveType,
  CurrentLod,
  GRID_CATEGORY,
  ItemConfigClass,
  LoadAbortedError,
  LodMode,
  MultiThreadingRequestClass,
  ObjectClass,
  SnappingClass,
  TileRequestClass,
  limitOf2Bytes
};
//# sourceMappingURL=model-types.mjs.map
