import { decodeStepString, extractArgsString, extractLineMeta, extractRefs, parseHashRef, parseStepArguments, splitIfcArgs } from "./Utils/ifc-parsing-utils.mjs";
import { IfcDecoderStream, IfcParserStream, streamAsyncIterator } from "./Utils/ifc-stream.mjs";
import { ELEMENT_TYPES, IfcSplitter, SPATIAL_TYPES, listIdxByType } from "./Utils/ifc-splitter/index.mjs";
import { FragmentsModels } from "./FragmentsModels/index.mjs";
import { GeometryEngine } from "./GeometryEngine/index.mjs";
import { ALIGNMENT_CATEGORY, AlignmentCurveType, CurrentLod, GRID_CATEGORY, ItemConfigClass, LoadAbortedError, LodMode, MultiThreadingRequestClass, ObjectClass, SnappingClass, TileRequestClass, limitOf2Bytes } from "./FragmentsModels/src/model/model-types.mjs";
import { Arc } from "./GeometryEngine/src/arc.mjs";
import { AsyncEvent } from "./Utils/async-event.mjs";
import { Attribute } from "./Schema/attribute.mjs";
import { Axis } from "./Schema/axis.mjs";
import { AxisPartClass } from "./Schema/axis-part-class.mjs";
import { Bbox } from "./GeometryEngine/src/bbox.mjs";
import { BigShellHole } from "./Schema/big-shell-hole.mjs";
import { BigShellProfile } from "./Schema/big-shell-profile.mjs";
import { BooleanOperation } from "./GeometryEngine/src/boolean-operation.mjs";
import { BoundingBox } from "./Schema/bounding-box.mjs";
import { CircleCurve } from "./Schema/circle-curve.mjs";
import { CircleExtrusion } from "./Schema/circle-extrusion.mjs";
import { CircularSweep } from "./GeometryEngine/src/circular-sweep.mjs";
import { Clothoid } from "./GeometryEngine/src/clothoid.mjs";
import { CylindricalRevolve } from "./GeometryEngine/src/cylindrical-revolve.mjs";
import { DataMap } from "./Utils/data-map.mjs";
import { DataSet } from "./Utils/data-set.mjs";
import { DoubleVector } from "./Schema/double-vector.mjs";
import { EditRequestType, EditRequestTypeNames, isIndexRequest } from "./Utils/edit/edit-types.mjs";
import { EditUtils } from "./Utils/edit/edit-utils.mjs";
import { Editor } from "./FragmentsModels/src/edit/editor.mjs";
import { Element } from "./FragmentsModels/src/edit/element.mjs";
import { Event } from "./Utils/event.mjs";
import { Extrusion } from "./GeometryEngine/src/extrusion.mjs";
import { FRAGMENTS_GENERATOR, FRAGMENTS_VERSION, getProvenanceMetadata } from "./Utils/version.mjs";
import { FloatVector } from "./Schema/float-vector.mjs";
import { FragmentsIfcUtils } from "./Utils/ifc-utils.mjs";
import { FragmentsModel } from "./FragmentsModels/src/model/fragments-model.mjs";
import { GeomsFbUtils } from "./Utils/shells/index.mjs";
import { GridReader } from "./Importers/IfcImporter/src/geometry/grid-reader.mjs";
import { IfcImporter } from "./Importers/IfcImporter/index.mjs";
import { Material } from "./Schema/material.mjs";
import { Meshes } from "./Schema/meshes.mjs";
import { Model } from "./Schema/model.mjs";
import { ModelIndex } from "./Schema/model-index.mjs";
import { Parabola } from "./GeometryEngine/src/parabola.mjs";
import { Profile, ProfileType } from "./GeometryEngine/src/profile.mjs";
import { Relation } from "./Schema/relation.mjs";
import { RenderedFaces } from "./Schema/rendered-faces.mjs";
import { Representation } from "./Schema/representation.mjs";
import { RepresentationClass } from "./Schema/representation-class.mjs";
import { Revolve } from "./GeometryEngine/src/revolve.mjs";
import { Sample } from "./Schema/sample.mjs";
import { Shell } from "./Schema/shell.mjs";
import { ShellHole } from "./Schema/shell-hole.mjs";
import { ShellProfile } from "./Schema/shell-profile.mjs";
import { ShellType } from "./Schema/shell-type.mjs";
import { SingleThreadedFragmentsModel } from "./FragmentsModels/src/single-threading/index.mjs";
import { SpatialStructure } from "./Schema/spatial-structure.mjs";
import { Stroke } from "./Schema/stroke.mjs";
import { Sweep } from "./GeometryEngine/src/sweep.mjs";
import { Transform } from "./Schema/transform.mjs";
import { Wall } from "./GeometryEngine/src/wall.mjs";
import { Wire } from "./Schema/wire.mjs";
import { WireSet } from "./Schema/wire-set.mjs";
import { geometryTypes, ifcGeometriesMap } from "./Utils/ifc-geometries-map.mjs";
import { getObject } from "./Utils/flatbuffers-json-converter.mjs";
import { ifcCategoryMap } from "./Utils/ifc-category-map.mjs";
import { ifcClasses } from "./Importers/IfcImporter/src/classes.mjs";
import { ifcRelationsMap } from "./Utils/ifc-relations-map.mjs";
import { isRawBuffer } from "./FragmentsModels/src/utils/misc/buffer.mjs";
import { toClassicWorker } from "./Utils/worker-utils.mjs";
export {
  ALIGNMENT_CATEGORY,
  AlignmentCurveType,
  Arc,
  AsyncEvent,
  Attribute,
  Axis,
  AxisPartClass,
  Bbox,
  BigShellHole,
  BigShellProfile,
  BooleanOperation,
  BoundingBox,
  CircleCurve,
  CircleExtrusion,
  CircularSweep,
  Clothoid,
  CurrentLod,
  CylindricalRevolve,
  DataMap,
  DataSet,
  DoubleVector,
  ELEMENT_TYPES,
  EditRequestType,
  EditRequestTypeNames,
  EditUtils,
  Editor,
  Element,
  Event,
  Extrusion,
  FRAGMENTS_GENERATOR,
  FRAGMENTS_VERSION,
  FloatVector,
  FragmentsIfcUtils,
  FragmentsModel,
  FragmentsModels,
  GRID_CATEGORY,
  GeometryEngine,
  GeomsFbUtils,
  GridReader,
  IfcDecoderStream,
  IfcImporter,
  IfcParserStream,
  IfcSplitter,
  ItemConfigClass,
  LoadAbortedError,
  LodMode,
  Material,
  Meshes,
  Model,
  ModelIndex,
  MultiThreadingRequestClass,
  ObjectClass,
  Parabola,
  Profile,
  ProfileType,
  Relation,
  RenderedFaces,
  Representation,
  RepresentationClass,
  Revolve,
  SPATIAL_TYPES,
  Sample,
  Shell,
  ShellHole,
  ShellProfile,
  ShellType,
  SingleThreadedFragmentsModel,
  SnappingClass,
  SpatialStructure,
  Stroke,
  Sweep,
  TileRequestClass,
  Transform,
  Wall,
  Wire,
  WireSet,
  decodeStepString,
  extractArgsString,
  extractLineMeta,
  extractRefs,
  geometryTypes,
  getObject,
  getProvenanceMetadata,
  ifcCategoryMap,
  ifcClasses,
  ifcGeometriesMap,
  ifcRelationsMap,
  isIndexRequest,
  isRawBuffer,
  limitOf2Bytes,
  listIdxByType,
  parseHashRef,
  parseStepArguments,
  splitIfcArgs,
  streamAsyncIterator,
  toClassicWorker
};
//# sourceMappingURL=index.mjs.map
