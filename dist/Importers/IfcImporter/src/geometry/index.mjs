import * as THREE from "three";
import { IfcFileReader } from "./ifc-file-reader.mjs";
import { GeomsFbUtils } from "../../../../Utils/shells/index.mjs";
import { ifcCategoryMap } from "../../../../Utils/ifc-category-map.mjs";
import { Meshes } from "../../../../Schema/meshes.mjs";
import { Transform } from "../../../../Schema/transform.mjs";
import { RepresentationClass } from "../../../../Schema/representation-class.mjs";
import { ShellType } from "../../../../Schema/shell-type.mjs";
import { Shell } from "../../../../Schema/shell.mjs";
import { FloatVector } from "../../../../Schema/float-vector.mjs";
import { BigShellProfile } from "../../../../Schema/big-shell-profile.mjs";
import { ShellProfile } from "../../../../Schema/shell-profile.mjs";
import { BigShellHole } from "../../../../Schema/big-shell-hole.mjs";
import { ShellHole } from "../../../../Schema/shell-hole.mjs";
import { Axis } from "../../../../Schema/axis.mjs";
import { CircleCurve } from "../../../../Schema/circle-curve.mjs";
import { Wire } from "../../../../Schema/wire.mjs";
import { CircleExtrusion } from "../../../../Schema/circle-extrusion.mjs";
import { Representation } from "../../../../Schema/representation.mjs";
import { RenderedFaces } from "../../../../Schema/rendered-faces.mjs";
import { Material } from "../../../../Schema/material.mjs";
import { Sample } from "../../../../Schema/sample.mjs";
class IfcGeometryProcessor {
  wasm = {
    path: "../../../../node_modules/web-ifc/",
    absolute: false
  };
  webIfcSettings = {};
  /** Whether to keep the model open for the property step. */
  keepModelOpen = false;
  _serializer;
  constructor(_serializer) {
    this._serializer = _serializer;
  }
  async process(data) {
    const { builder } = data;
    let nextId = 0;
    const localIDs = [];
    let coordinates = {
      dxx: 1,
      dxy: 0,
      dxz: 0,
      dyx: 0,
      dyy: 1,
      dyz: 0,
      px: 0,
      py: 0,
      pz: 0
    };
    const geometries = [];
    const alignments = [];
    const grids = [];
    const items = [];
    const localTransforms = [];
    const itemIDMap = /* @__PURE__ */ new Map();
    const geometryIDMap = /* @__PURE__ */ new Map();
    const materialIDMap = /* @__PURE__ */ new Map();
    const reader = new IfcFileReader(this._serializer);
    reader.wasm = this.wasm;
    reader.webIfcSettings = this.webIfcSettings;
    reader.keepModelOpen = this.keepModelOpen;
    reader.onGeometryLoaded = (geometry) => {
      geometries.push(geometry);
    };
    reader.onElementLoaded = (element) => {
      items.push(element);
    };
    reader.onLocalTransformLoaded = (localTransform) => {
      localTransforms.push(localTransform);
    };
    reader.onCoordinatesLoaded = (coords) => {
      coordinates = coords;
    };
    reader.onNextIdFound = (foundNextId) => {
      nextId = foundNextId;
    };
    reader.onAlignmentsLoaded = (data2) => {
      for (const alignment of data2) {
        alignments.push(alignment);
      }
    };
    reader.onGridsLoaded = (data2) => {
      for (const grid of data2) {
        grids.push(grid);
      }
    };
    await reader.load(data);
    const geometriesItems = [];
    let itemCounter = 0;
    Meshes.startGlobalTransformsVector(builder, items.length);
    const gtLocalIds = [];
    const itemCategories = /* @__PURE__ */ new Map();
    const localIds = [];
    for (let i = 0; i < items.length; i++) {
      const currentItem = items[items.length - 1 - i];
      geometriesItems.push(itemCounter++);
      const { position, xDirection, yDirection } = currentItem;
      const [px, py, pz] = position;
      const [dxx, dxy, dxz] = xDirection;
      const [dyx, dyy, dyz] = yDirection;
      localIDs.push(items[i].element.id);
      const itemIndex = items.length - 1 - i;
      const categoryId = currentItem.element.type;
      const category = ifcCategoryMap[categoryId];
      if (!itemCategories.has(category)) {
        itemCategories.set(category, itemCategories.size);
      }
      gtLocalIds.unshift(nextId++);
      Transform.createTransform(
        builder,
        px,
        py,
        pz,
        dxx,
        dxy,
        dxz,
        dyx,
        dyy,
        dyz
      );
      itemCategories.get(category);
      localIds.unshift(currentItem.element.id);
      itemIDMap.set(currentItem.element.id, itemIndex);
    }
    const globalTransforms = builder.endVector();
    const shellsOffsets = [];
    for (let g = 0; g < geometries.length; g++) {
      const geometryData = geometries[g];
      if (geometryData.geometry.type !== RepresentationClass.SHELL) {
        continue;
      }
      const { points, profiles, holes, profilesFaceIds } = geometryData.geometry;
      const isBigShell = points.length > GeomsFbUtils.ushortMaxValue;
      const shellType = isBigShell ? ShellType.BIG : ShellType.NONE;
      Shell.startPointsVector(builder, points.length);
      for (let i = 0; i < points.length; i++) {
        const [x, y, z] = points[points.length - 1 - i];
        FloatVector.createFloatVector(builder, x, y, z);
      }
      const pointsOffset = builder.endVector();
      const profilesOffsets = [];
      const holesOffsets = [];
      const bigProfilesOffsets = [];
      const bigHolesOffsets = [];
      for (const [, indices] of profiles) {
        if (isBigShell) {
          const indicesOffset2 = BigShellProfile.createIndicesVector(
            builder,
            indices
          );
          const bigProfileOffset = BigShellProfile.createBigShellProfile(
            builder,
            indicesOffset2
          );
          bigProfilesOffsets.push(bigProfileOffset);
          continue;
        }
        const indicesOffset = ShellProfile.createIndicesVector(
          builder,
          indices
        );
        const profileOffset = ShellProfile.createShellProfile(
          builder,
          indicesOffset
        );
        profilesOffsets.push(profileOffset);
      }
      const bigShellProfilesOffset = Shell.createBigProfilesVector(
        builder,
        bigProfilesOffsets
      );
      const shellProfilesOffset = Shell.createProfilesVector(
        builder,
        profilesOffsets
      );
      for (const [holeId, indicesSets] of holes) {
        if (isBigShell) {
          for (const indices of indicesSets) {
            const indicesOffset = BigShellHole.createIndicesVector(
              builder,
              indices
            );
            const holeOffset = BigShellHole.createBigShellHole(
              builder,
              indicesOffset,
              holeId
            );
            bigHolesOffsets.push(holeOffset);
          }
          continue;
        }
        for (const indices of indicesSets) {
          const indicesOffset = ShellHole.createIndicesVector(
            builder,
            indices
          );
          const holeOffset = ShellHole.createShellHole(
            builder,
            indicesOffset,
            holeId
          );
          holesOffsets.push(holeOffset);
        }
      }
      const bigShellHolesOffset = Shell.createBigHolesVector(
        builder,
        bigHolesOffsets
      );
      const shellHolesOffset = Shell.createHolesVector(
        builder,
        holesOffsets
      );
      const shellFaceIdsOffset = Shell.createProfilesFaceIdsVector(
        builder,
        profilesFaceIds
      );
      const shellOffset = Shell.createShell(
        builder,
        shellProfilesOffset,
        shellHolesOffset,
        pointsOffset,
        bigShellProfilesOffset,
        bigShellHolesOffset,
        shellType,
        shellFaceIdsOffset
      );
      shellsOffsets.push(shellOffset);
    }
    const shells = Meshes.createShellsVector(builder, shellsOffsets);
    const circleExtrusionsOffsets = [];
    for (let g = 0; g < geometries.length; g++) {
      const geometryData = geometries[g];
      if (geometryData.geometry.type !== RepresentationClass.CIRCLE_EXTRUSION) {
        continue;
      }
      const axisOffsets = [];
      const { radius, indicesArray, typesArray, segments, circleCurveData } = geometryData.geometry;
      Axis.startCircleCurvesVector(builder, circleCurveData.length);
      for (let i = 0; i < circleCurveData.length; i++) {
        const [x1, y1, z1, radius2, angle, dx1, dy1, dz1, dx3, dy3, dz3] = circleCurveData[i];
        CircleCurve.createCircleCurve(
          builder,
          angle / 360 * 2 * Math.PI,
          x1,
          y1,
          z1,
          radius2,
          dx3,
          dy3,
          dz3,
          dx1,
          dy1,
          dz1
        );
      }
      const circleCurvesOffset = builder.endVector();
      Axis.startWiresVector(builder, segments.length);
      for (let i = 0; i < segments.length; i++) {
        const [x1, y1, z1, x2, y2, z2] = segments[i];
        Wire.createWire(builder, x1, y1, z1, x2, y2, z2);
      }
      const wiresOffset = builder.endVector();
      const ordersOffset = Axis.createOrderVector(builder, indicesArray);
      const axisPartsOffset = Axis.createPartsVector(builder, typesArray);
      Axis.startWireSetsVector(builder, 0);
      const wireSetOffset = builder.endVector();
      Axis.startAxis(builder);
      Axis.addCircleCurves(builder, circleCurvesOffset);
      Axis.addOrder(builder, ordersOffset);
      Axis.addWires(builder, wiresOffset);
      Axis.addWireSets(builder, wireSetOffset);
      Axis.addParts(builder, axisPartsOffset);
      const axisOffset = Axis.endAxis(builder);
      axisOffsets.push(axisOffset);
      const axisVectorOffset = CircleExtrusion.createAxesVector(
        builder,
        axisOffsets
      );
      const radiusOffset = CircleExtrusion.createRadiusVector(builder, [
        radius
      ]);
      CircleExtrusion.startCircleExtrusion(builder);
      CircleExtrusion.addAxes(builder, axisVectorOffset);
      CircleExtrusion.addRadius(builder, radiusOffset);
      const ceOffset = CircleExtrusion.endCircleExtrusion(builder);
      circleExtrusionsOffsets.push(ceOffset);
    }
    const circleExtrusions = Meshes.createCircleExtrusionsVector(
      builder,
      circleExtrusionsOffsets
    );
    const representationsLocalIds = [];
    Meshes.startRepresentationsVector(builder, geometries.length);
    const geometryClassesCounter = /* @__PURE__ */ new Map();
    for (let g = 0; g < geometries.length; g++) {
      const index = geometries.length - 1 - g;
      const currentGeometry = geometries[index];
      const geometryClass = currentGeometry.geometry.type;
      let previousCount = geometryClassesCounter.get(geometryClass);
      if (previousCount === void 0) {
        previousCount = -1;
      }
      geometryClassesCounter.set(geometryClass, previousCount + 1);
    }
    const tempMin = new THREE.Vector3();
    const tempMax = new THREE.Vector3();
    for (let g = 0; g < geometries.length; g++) {
      const index = geometries.length - 1 - g;
      const currentGeometry = geometries[index];
      const { bbox } = currentGeometry.geometry;
      geometryIDMap.set(currentGeometry.id, index);
      const geometryClass = currentGeometry.geometry.type;
      const geomIndex = geometryClassesCounter.get(geometryClass);
      if (geomIndex === void 0) {
        throw new Error("Fragments: Malformed geometry definition");
      }
      geometryClassesCounter.set(geometryClass, geomIndex - 1);
      tempMin.set(bbox.min.x, bbox.min.y, bbox.min.z);
      tempMax.set(bbox.max.x, bbox.max.y, bbox.max.z);
      const distance = tempMin.distanceTo(tempMax);
      if (distance > 999999) {
        console.log(`Infinity bounding box: ${currentGeometry.id}`);
        bbox.min.x = 0;
        bbox.min.y = 0;
        bbox.min.z = 0;
        bbox.max.x = 0.1;
        bbox.max.y = 0.1;
        bbox.max.z = 0.1;
      }
      representationsLocalIds.unshift(nextId++);
      Representation.createRepresentation(
        builder,
        geomIndex,
        bbox.min.x,
        bbox.min.y,
        bbox.min.z,
        bbox.max.x,
        bbox.max.y,
        bbox.max.z,
        currentGeometry.geometry.type
      );
    }
    const representationsOffsets = builder.endVector();
    let materialCounter = 0;
    for (const item of items) {
      for (const geometry of item.element.geometries) {
        const colorID = geometry.color.toString();
        if (!materialIDMap.has(colorID)) {
          const color = geometry.color.map((n) => n * 255);
          materialIDMap.set(colorID, { id: materialCounter++, color });
        }
      }
    }
    Meshes.startMaterialsVector(builder, materialIDMap.size);
    const materialsLocalIds = [];
    const materialMapKeys = Array.from(materialIDMap.keys());
    for (let i = 0; i < materialMapKeys.length; i++) {
      const key = materialMapKeys[materialMapKeys.length - 1 - i];
      const { color } = materialIDMap.get(key);
      const [r, g, b, a] = color;
      materialsLocalIds.push(nextId++);
      const renderedFaces = this._serializer.doubleSidedMaterials ? RenderedFaces.TWO : RenderedFaces.ONE;
      Material.createMaterial(builder, r, g, b, a, renderedFaces, 0);
    }
    const materials = builder.endVector();
    let sampleCount = 0;
    for (const item of items) {
      sampleCount += item.element.geometries.length;
    }
    Meshes.startSamplesVector(builder, sampleCount);
    const samplesLocalIds = [];
    for (let g = 0; g < items.length; g++) {
      const currentItem = items[items.length - 1 - g];
      const itemID = itemIDMap.get(currentItem.element.id);
      const geoms = currentItem.element.geometries;
      for (let i = 0; i < geoms.length; i++) {
        const geometry = geoms[geoms.length - i - 1];
        const geometryID = geometryIDMap.get(geometry.id);
        const materialID = materialIDMap.get(geometry.color.toString()).id;
        const transformID = geometry.localTransformID || 0;
        samplesLocalIds.push(nextId++);
        Sample.createSample(
          builder,
          itemID,
          materialID,
          geometryID,
          transformID
        );
      }
    }
    const samplesOffset = builder.endVector();
    Meshes.startLocalTransformsVector(builder, localTransforms.length);
    const localTransformsLocalIds = [];
    for (let i = 0; i < localTransforms.length; i++) {
      const transform = localTransforms[localTransforms.length - 1 - i];
      const [ox, oy, oz, x1, x2, x3, y1, y2, y3] = transform.data;
      localTransformsLocalIds.push(nextId++);
      Transform.createTransform(
        builder,
        ox,
        oy,
        oz,
        x1,
        x2,
        x3,
        y1,
        y2,
        y3
      );
    }
    const localTransformRef = builder.endVector();
    const meshesItemsOffset = Meshes.createMeshesItemsVector(
      builder,
      geometriesItems
    );
    const reprLocalIdsOffset = Meshes.createRepresentationIdsVector(
      builder,
      representationsLocalIds
    );
    const sampleLocalIdsOffset = Meshes.createSampleIdsVector(
      builder,
      samplesLocalIds
    );
    const materialLocalIdsOffset = Meshes.createMaterialIdsVector(
      builder,
      materialsLocalIds
    );
    const ltLocalIdsOffset = Meshes.createLocalTransformIdsVector(
      builder,
      localTransformsLocalIds
    );
    const gtLocalIdsOffset = Meshes.createGlobalTransformIdsVector(
      builder,
      gtLocalIds
    );
    const coordinatesOffset = Transform.createTransform(
      builder,
      coordinates.px,
      coordinates.py,
      coordinates.pz,
      coordinates.dxx,
      coordinates.dxy,
      coordinates.dxz,
      coordinates.dyx,
      coordinates.dyy,
      coordinates.dyz
    );
    Meshes.startMeshes(builder);
    Meshes.addCoordinates(builder, coordinatesOffset);
    Meshes.addGlobalTransforms(builder, globalTransforms);
    Meshes.addShells(builder, shells);
    Meshes.addRepresentations(builder, representationsOffsets);
    Meshes.addSamples(builder, samplesOffset);
    Meshes.addLocalTransforms(builder, localTransformRef);
    Meshes.addMaterials(builder, materials);
    Meshes.addCircleExtrusions(builder, circleExtrusions);
    Meshes.addMeshesItems(builder, meshesItemsOffset);
    Meshes.addRepresentationIds(builder, reprLocalIdsOffset);
    Meshes.addSampleIds(builder, sampleLocalIdsOffset);
    Meshes.addMaterialIds(builder, materialLocalIdsOffset);
    Meshes.addLocalTransformIds(builder, ltLocalIdsOffset);
    Meshes.addGlobalTransformIds(builder, gtLocalIdsOffset);
    const modelMesh = Meshes.endMeshes(builder);
    return {
      modelMesh,
      localIDs,
      maxLocalID: nextId,
      alignments,
      grids,
      ifcAPI: reader.takeIfcAPI()
    };
  }
}
export {
  IfcGeometryProcessor
};
//# sourceMappingURL=index.mjs.map
