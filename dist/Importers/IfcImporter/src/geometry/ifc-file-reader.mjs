import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { CivilReader } from "./ifc/civil-reader.mjs";
import { GridReader } from "./grid-reader.mjs";
import { SpaceBoundaryReader } from "./space-boundary-reader.mjs";
import { Hasher } from "./geometry-hash.mjs";
import { ifcCategoryMap } from "../../../../Utils/ifc-category-map.mjs";
import { GeomsFbUtils } from "../../../../Utils/shells/index.mjs";
import { AxisPartClass } from "../../../../Schema/axis-part-class.mjs";
import { RepresentationClass } from "../../../../Schema/representation-class.mjs";
function logGridReadError(error) {
  switch (error.kind) {
    case "noPlacement":
      console.warn(
        `Fragments: IFCGRID #${error.gridId} has no ObjectPlacement. Using the identity placement for it.`
      );
      break;
    case "unsupportedAxes": {
      const skipped = error.axes.map(({ tag, curveType }) => `"${tag}" (${curveType})`).join(", ");
      console.warn(
        `Fragments: IFCGRID #${error.gridId} has axes with unsupported curve types that will not be displayed: ${skipped}.`
      );
      break;
    }
    case "unreadableGrid":
      console.warn(
        `Fragments: skipping IFCGRID #${error.gridId} because it could not be read:`,
        error.cause
      );
      break;
    case "unreadableModel":
      console.error(error.cause);
      break;
  }
}
class IfcFileReader {
  constructor(_serializer) {
    this._serializer = _serializer;
  }
  _serializer;
  _ifcAPI = null;
  _hasher = null;
  wasm = {
    path: "../../../../node_modules/web-ifc/",
    absolute: false
  };
  webIfcSettings = {};
  _tempObject1 = new THREE.Object3D();
  _tempObject2 = new THREE.Object3D();
  _tempMatrix1 = new THREE.Matrix4();
  _previousGeometries = /* @__PURE__ */ new Map();
  _previousGeometriesIDs = /* @__PURE__ */ new Map();
  _previousGeometriesScales = /* @__PURE__ */ new Map();
  _previousLocalTransforms = /* @__PURE__ */ new Map();
  _problematicGeometries = /* @__PURE__ */ new Set();
  _problematicGeometriesHashes = /* @__PURE__ */ new Set();
  _coordinatesInitialized = false;
  _civilReader = new CivilReader();
  _spaceBoundaryReader = new SpaceBoundaryReader();
  _nextId = 0;
  _rawCategories = /* @__PURE__ */ new Set([
    WEBIFC.IFCEARTHWORKSFILL,
    WEBIFC.IFCEARTHWORKSCUT
  ]);
  scene = null;
  isolatedMeshes = null;
  /**
   * Whether to keep the web-ifc model open after {@link load}.
   * @remarks Instead of being disposed, the instance is handed over through
   * {@link takeIfcAPI}, so the model can be read again without a second parse.
   */
  keepModelOpen = false;
  _openIfcAPI = null;
  /**
   * Returns the web-ifc instance kept by {@link keepModelOpen}, or null.
   * @remarks Its model has ID 0. The caller becomes responsible for disposing
   * the instance.
   */
  takeIfcAPI() {
    const ifcAPI = this._openIfcAPI;
    this._openIfcAPI = null;
    return ifcAPI;
  }
  onElementLoaded = () => {
  };
  onGeometryLoaded = () => {
  };
  onLocalTransformLoaded = () => {
  };
  onNextIdFound = () => {
  };
  onCoordinatesLoaded = () => {
  };
  onAlignmentsLoaded = () => {
  };
  onGridsLoaded = () => {
  };
  async load(data) {
    data.progressCallback?.(0, {
      process: "conversion",
      state: "start"
    });
    this._previousGeometriesIDs.clear();
    const ifcAPI = new WEBIFC.IfcAPI();
    ifcAPI.SetWasmPath(this.wasm.path, this.wasm.absolute);
    const [, hasher] = await Promise.all([ifcAPI.Init(), Hasher.init()]);
    this._ifcAPI = ifcAPI;
    this._hasher = hasher;
    let modelID = 0;
    if (data.readFromCallback && data.readCallback) {
      modelID = this._ifcAPI.OpenModelFromCallback(
        data.readCallback,
        this.webIfcSettings
      );
    } else if (data.bytes) {
      modelID = await this._ifcAPI.OpenModel(data.bytes, this.webIfcSettings);
    } else {
      throw new Error("Fragments: No data provided");
    }
    this._ifcAPI.SetLogLevel(WEBIFC.LogLevel.LOG_LEVEL_OFF);
    this._nextId = this._ifcAPI.GetMaxExpressID(modelID) + 1;
    this.onLocalTransformLoaded({
      id: 0,
      data: [0, 0, 0, 1, 0, 0, 0, 1, 0]
    });
    const tempPosition = new THREE.Vector3();
    let currentCategory = 0;
    const callback = (mesh) => {
      if (this._ifcAPI === null) {
        throw new Error("Fragments: IfcAPI not initialized");
      }
      if (!this._coordinatesInitialized) {
        const coordinates = this._ifcAPI.GetCoordinationMatrix(modelID);
        this._tempMatrix1.fromArray(coordinates);
        const coordinatesData = this.decompose(this._tempMatrix1);
        this.onCoordinatesLoaded(coordinatesData);
        this._coordinatesInitialized = true;
      }
      const properties = this._ifcAPI.GetLine(0, mesh.expressID);
      const element = {
        id: mesh.expressID,
        type: properties.type,
        guid: properties.GlobalId.value,
        geometries: []
      };
      const geometryCount = mesh.geometries.size();
      const firstGeometryRef = mesh.geometries.get(0);
      const transformArray = firstGeometryRef.flatTransformation;
      const { transformWithoutScale } = this.removeScale(transformArray);
      const distanceThreshold = this._serializer.distanceThreshold;
      if (distanceThreshold !== null) {
        tempPosition.set(0, 0, 0);
        tempPosition.applyMatrix4(transformWithoutScale);
        if (tempPosition.x > distanceThreshold || tempPosition.y > distanceThreshold || tempPosition.z > distanceThreshold) {
          console.log(
            `Fragments: Object ${element.id} is more than ${distanceThreshold} meters away from the origin and will be skipped.`
          );
          return;
        }
      }
      for (let i = 0; i < geometryCount; i++) {
        let geometryMode = "Shell";
        if (element.type === WEBIFC.IFCREINFORCINGBAR) {
          if (this.hasSweptDiskDirectrix(modelID, mesh, i))
            geometryMode = "CircleExtrusion";
        }
        if (geometryMode === "Shell") {
          this.loadShellGeometry(
            modelID,
            element,
            mesh,
            i,
            transformWithoutScale.elements,
            currentCategory
          );
        } else if (geometryMode === "CircleExtrusion") {
          this.loadCircleExtrusionGeometry(
            modelID,
            element,
            mesh,
            i,
            transformWithoutScale.elements
          );
        }
      }
      const { dxx, dxy, dxz, dyx, dyy, dyz, px, py, pz } = this.decompose(
        transformWithoutScale
      );
      if (element.geometries.length > 0) {
        this.onElementLoaded({
          element,
          position: [px, py, pz],
          xDirection: [dxx, dxy, dxz],
          yDirection: [dyx, dyy, dyz]
        });
      }
    };
    if (this.isolatedMeshes?.size) {
      this._ifcAPI.StreamMeshes(
        modelID,
        Array.from(this.isolatedMeshes),
        callback
      );
    } else {
      const modelClasses = this._ifcAPI.GetAllTypesOfModel(modelID).map((entry) => entry.typeID);
      const toProcess = modelClasses.filter(
        (type) => this._serializer.classes.elements.has(type)
      );
      if (toProcess.includes(WEBIFC.IFCANNOTATION)) {
        toProcess.splice(toProcess.indexOf(WEBIFC.IFCANNOTATION), 1);
        toProcess.push(WEBIFC.IFCANNOTATION);
      }
      const categoryPercentage = 0.5 / toProcess.length;
      for (const [index, category] of toProcess.entries()) {
        currentCategory = category;
        const state = (() => {
          if (index === 0) return "start";
          if (index + 1 === toProcess.length) return "finish";
          return "inProgress";
        })();
        const idsVector = this._ifcAPI.GetLineIDsWithType(modelID, category);
        const ids = [];
        for (let i = 0; i < idsVector.size(); i++) {
          ids.push(idsVector.get(i));
        }
        if (ids.length > 0) {
          this._ifcAPI.StreamMeshes(modelID, ids, callback);
          data.progressCallback?.(categoryPercentage * (index + 1), {
            process: "geometries",
            state,
            class: ifcCategoryMap[category],
            entitiesProcessed: ids.length
          });
        }
      }
    }
    const alignments = this._civilReader.read(this._ifcAPI);
    this.onAlignmentsLoaded(alignments);
    const grids = new GridReader(this._ifcAPI, modelID).read();
    grids.errors.forEach(logGridReadError);
    this.onGridsLoaded(grids.value);
    if (this._serializer.geometryProcessSettings.processIfcRelSpaceBoundarySecondLevel) {
      this._spaceBoundaryReader.read(
        this._ifcAPI,
        this._serializer,
        (data2) => this.onGeometryLoaded(data2),
        (data2) => this.onElementLoaded(data2),
        () => this._nextId++
      );
    }
    this.onNextIdFound(this._nextId);
    if (this.keepModelOpen) {
      this._openIfcAPI = this._ifcAPI;
    } else {
      this._ifcAPI.Dispose();
    }
    this._ifcAPI = null;
    this._previousGeometries.clear();
    this._previousGeometriesIDs.clear();
    this._previousGeometriesScales.clear();
    this._nextId = 0;
    this._previousLocalTransforms.clear();
    this._problematicGeometries.clear();
    this._problematicGeometriesHashes.clear();
  }
  // @ts-ignore
  loadCircleExtrusionGeometry(modelID, element, mesh, geometryIndex, elementTransform) {
    if (this._ifcAPI === null) {
      throw new Error("Fragments: IfcAPI not initialized");
    }
    const geometryRef = mesh.geometries.get(geometryIndex);
    const transformArray = geometryRef.flatTransformation;
    const { units } = this.removeScale(transformArray);
    const { x, y, z, w } = geometryRef.color;
    const geometryData = {
      id: geometryRef.geometryExpressID,
      color: [x, y, z, w],
      localTransformID: null
    };
    element.geometries.push(geometryData);
    const { transformWithoutScale } = this.removeScale(
      geometryRef.flatTransformation
    );
    if (this._previousGeometriesIDs.has(geometryData.id)) {
      this.getLocalTransform(
        elementTransform,
        transformWithoutScale,
        geometryData
      );
      geometryData.id = this._previousGeometriesIDs.get(geometryData.id);
      return;
    }
    this.getLocalTransform(
      elementTransform,
      transformWithoutScale,
      geometryData
    );
    const geometry = this._ifcAPI.GetGeometry(modelID, geometryData.id);
    const circleExtrusion = geometry.GetSweptDiskSolid();
    const circleCurves = [];
    const axisPoints = [];
    const axisSize = circleExtrusion.axis.size();
    for (let i = 0; i < axisSize; i++) {
      const axis = circleExtrusion.axis.get(i);
      const circleCurveTemp = [];
      for (let j = 0; j < axis.arcSegments.size(); j++) {
        circleCurveTemp.push(axis.arcSegments.get(j));
      }
      circleCurves.push(circleCurveTemp);
      const axisTemp = [];
      for (let j = 0; j < axis.points.size(); j++) {
        const p = axis.points.get(j);
        axisTemp.push({ x: p.x * units.x, y: p.y * units.y, z: p.z * units.z });
      }
      axisPoints.push(axisTemp);
    }
    const indicesArray = [];
    const typesArray = [];
    const segments = [];
    const circleCurveData = [];
    for (let i = 0; i < axisPoints.length; i++) {
      const axisPointsList = axisPoints[i];
      const curves = circleCurves[i];
      const pointsSize = axisPointsList.length;
      for (let j = 0; j < pointsSize - 1; j++) {
        let startCircleCurve = -1;
        let endCircleCurve = -1;
        for (let k = 0; k < curves.length; k += 2) {
          if (curves[k] === j) {
            startCircleCurve = j;
            endCircleCurve = curves[k + 1];
            break;
          }
        }
        if (startCircleCurve === -1) {
          const newSegment = [];
          const currentPoint = axisPointsList[j];
          const nextPoint = axisPointsList[j + 1];
          const currentX = currentPoint.x;
          const currentY = currentPoint.y;
          const currentZ = currentPoint.z;
          const nextX = nextPoint.x;
          const nextY = nextPoint.y;
          const nextZ = nextPoint.z;
          indicesArray.push(segments.length);
          newSegment.push(currentX, currentY, currentZ, nextX, nextY, nextZ);
          segments.push(newSegment);
          typesArray.push(AxisPartClass.WIRE);
        } else {
          const newCircleCurve = [];
          const firstPointIndex = startCircleCurve;
          const midPointIndex = Math.round(
            (startCircleCurve + endCircleCurve) / 2
          );
          const lastPointIndex = endCircleCurve;
          const point1 = axisPointsList[firstPointIndex];
          const point2 = axisPointsList[midPointIndex];
          const point3 = axisPointsList[lastPointIndex];
          const circleCurveProperties = this.computeCircleCurveProperties(
            point1,
            point2,
            point3
          );
          const dx = point1.x - circleCurveProperties.center.x;
          const dy = point1.y - circleCurveProperties.center.y;
          const dz = point1.z - circleCurveProperties.center.z;
          let dd = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dd === 0) {
            dd = 1;
          }
          const dx1 = dx / dd;
          const dy1 = dy / dd;
          const dz1 = dz / dd;
          const dxb = point2.x - circleCurveProperties.center.x;
          const dyb = point2.y - circleCurveProperties.center.y;
          const dzb = point2.z - circleCurveProperties.center.z;
          let dd2 = Math.sqrt(dxb * dxb + dyb * dyb + dzb * dzb);
          if (dd2 === 0) {
            dd2 = 1;
          }
          const dx2 = dxb / dd2;
          const dy2 = dyb / dd2;
          const dz2 = dzb / dd2;
          let v3 = this.crossProduct(
            { x: dx1, y: dy1, z: dz1 },
            { x: dx2, y: dy2, z: dz2 }
          );
          dd = Math.sqrt(v3.x * v3.x + v3.y * v3.y + v3.z * v3.z);
          if (dd === 0) {
            dd = 1;
          }
          v3 = { x: v3.x / dd, y: v3.y / dd, z: v3.z / dd };
          indicesArray.push(circleCurveData.length);
          newCircleCurve.push(
            circleCurveProperties.center.x,
            circleCurveProperties.center.y,
            circleCurveProperties.center.z,
            circleCurveProperties.radius,
            circleCurveProperties.angle,
            dx1,
            dy1,
            dz1,
            v3.x,
            v3.y,
            v3.z
          );
          circleCurveData.push(newCircleCurve);
          typesArray.push(AxisPartClass.CIRCLE_CURVE);
          j = lastPointIndex - 1;
        }
      }
    }
    const buffers = this.getGeometryBuffers(modelID, geometryRef);
    if (buffers === null) {
      element.geometries.pop();
      this._problematicGeometries.add(geometryData.id);
      return;
    }
    const { position } = buffers;
    for (let i = 0; i < position.length - 2; i += 3) {
      position[i] *= units.x;
      position[i + 1] *= units.y;
      position[i + 2] *= units.z;
    }
    const bbox = GeomsFbUtils.getAABB(position);
    const radius = circleExtrusion.profileRadius * units.x;
    this._previousGeometriesIDs.set(geometryData.id, geometryData.id);
    this.onGeometryLoaded({
      id: geometryData.id,
      geometry: {
        type: RepresentationClass.CIRCLE_EXTRUSION,
        indicesArray,
        typesArray,
        segments,
        circleCurveData,
        radius,
        bbox
      }
    });
    geometry.delete();
  }
  loadShellGeometry(modelID, element, mesh, geometryIndex, elementTransform, category) {
    if (this._ifcAPI === null) {
      throw new Error("Fragments: IfcAPI not initialized");
    }
    if (this._hasher === null) {
      throw new Error("Fragments: Hasher not initialized");
    }
    const geometryRef = mesh.geometries.get(geometryIndex);
    const transformArray = geometryRef.flatTransformation;
    const { units } = this.removeScale(transformArray);
    if (this._problematicGeometries.has(geometryRef.geometryExpressID)) {
      console.log(
        `Fragments: Problematic geometry: ${geometryRef.geometryExpressID}`
      );
      return;
    }
    const { x, y, z } = geometryRef.color;
    let w = geometryRef.color.w;
    if (this._serializer.geometryProcessSettings.forceTransparentSpaces && category === WEBIFC.IFCSPACE && w === 1) {
      w = 0.5;
    }
    const geometryData = {
      id: geometryRef.geometryExpressID,
      color: [x, y, z, w],
      localTransformID: null
    };
    element.geometries.push(geometryData);
    const { transformWithoutScale } = this.removeScale(
      geometryRef.flatTransformation
    );
    if (this._previousGeometriesIDs.has(geometryData.id)) {
      const scaleHash = this.getScaleHash(units);
      const previousScaleHash = this._previousGeometriesScales.get(
        geometryData.id
      );
      const sameScale = previousScaleHash === scaleHash;
      if (sameScale) {
        this.getLocalTransform(
          elementTransform,
          transformWithoutScale,
          geometryData
        );
        geometryData.id = this._previousGeometriesIDs.get(geometryData.id);
        return;
      }
      const newId = this._nextId++;
      this._previousGeometriesScales.set(newId, scaleHash);
      geometryData.id = newId;
    }
    const buffers = this.getGeometryBuffers(modelID, geometryRef);
    if (buffers === null) {
      element.geometries.pop();
      this._problematicGeometries.add(geometryData.id);
      return;
    }
    const { position, normals, index } = buffers;
    for (let i = 0; i < position.length - 2; i += 3) {
      position[i] *= units.x;
      position[i + 1] *= units.y;
      position[i + 2] *= units.z;
    }
    const vertexCount = position.length / 3;
    const triangleCount = index.length / 3;
    let biggestArea = 0;
    let areaSum = 0;
    const triangle = new THREE.Triangle();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const v3 = new THREE.Vector3();
    const volume = this.getVolume(index, position);
    const centroid = new THREE.Vector3();
    for (let i = 0; i < index.length - 2; i += 3) {
      const i1 = index[i];
      const i2 = index[i + 1];
      const i3 = index[i + 2];
      v1.set(position[i1 * 3], position[i1 * 3 + 1], position[i1 * 3 + 2]);
      v2.set(position[i2 * 3], position[i2 * 3 + 1], position[i2 * 3 + 2]);
      v3.set(position[i3 * 3], position[i3 * 3 + 1], position[i3 * 3 + 2]);
      centroid.add(v1);
      centroid.add(v2);
      centroid.add(v3);
      triangle.set(v1, v2, v3);
      const area = triangle.getArea();
      if (area > biggestArea) {
        biggestArea = area;
      }
      areaSum += area;
    }
    centroid.divideScalar(index.length);
    const p = 1e4;
    const hashAreaSum = GeomsFbUtils.round(areaSum, p);
    const hashBigArea = GeomsFbUtils.round(biggestArea, p);
    const hashVolume = GeomsFbUtils.round(volume, p);
    const aabb = GeomsFbUtils.getAABB(position);
    const minX = GeomsFbUtils.round(aabb.min.x, p);
    const minY = GeomsFbUtils.round(aabb.min.y, p);
    const minZ = GeomsFbUtils.round(aabb.min.z, p);
    const maxX = GeomsFbUtils.round(aabb.max.x, p);
    const maxY = GeomsFbUtils.round(aabb.max.y, p);
    const maxZ = GeomsFbUtils.round(aabb.max.z, p);
    const cx = GeomsFbUtils.round(centroid.x, p);
    const cy = GeomsFbUtils.round(centroid.y, p);
    const cz = GeomsFbUtils.round(centroid.z, p);
    const vertexKey = this._hasher.hashCoordinates(position, p);
    const hash = `${vertexCount}-${triangleCount}-${hashAreaSum}-${hashBigArea}-${hashVolume}-${cx}-${cy}-${cz}-${minX}-${minY}-${minZ}-${maxX}-${maxY}-${maxZ}-${vertexKey}`;
    if (this._problematicGeometriesHashes.has(hash)) {
      console.log(`Fragments: Problematic geometry: ${geometryData.id}`);
      element.geometries.pop();
      this._problematicGeometries.add(geometryData.id);
      this._problematicGeometriesHashes.add(hash);
      return;
    }
    const isNewGeometry = !this._previousGeometries.has(hash);
    const geomID = geometryData.id;
    if (isNewGeometry) {
      this._previousGeometries.set(hash, geomID);
      this._previousGeometriesIDs.set(geomID, geomID);
    } else {
      const previousGeometryID = this._previousGeometries.get(hash);
      if (previousGeometryID === void 0) {
        throw new Error("Fragments: Previous geometry not found");
      }
      this._previousGeometriesIDs.set(geomID, previousGeometryID);
      geometryData.id = previousGeometryID;
    }
    this.getLocalTransform(
      elementTransform,
      transformWithoutScale,
      geometryData
    );
    const raw = this._rawCategories.has(element.type);
    if (isNewGeometry) {
      try {
        const geomData = GeomsFbUtils.getShellData({
          position,
          normals,
          index,
          raw,
          settings: this._serializer.geometryProcessSettings,
          category
        });
        this.onGeometryLoaded({
          id: geometryData.id,
          geometry: geomData
        });
      } catch (error) {
        console.log(`Fragments: Problematic geometry: ${geometryData.id}`);
        element.geometries.pop();
        this._problematicGeometries.add(geometryData.id);
        this._problematicGeometriesHashes.add(hash);
      }
    }
  }
  getScaleHash(units) {
    return `${units.x}-${units.y}-${units.z}`;
  }
  getLocalTransform(elementTransform, transformWithoutScale, geometryData) {
    this._tempObject1.position.set(0, 0, 0);
    this._tempObject1.rotation.set(0, 0, 0);
    this._tempObject1.scale.set(1, 1, 1);
    this._tempObject1.updateMatrix();
    this._tempMatrix1.fromArray(elementTransform);
    this._tempObject1.applyMatrix4(this._tempMatrix1);
    this._tempObject2.position.set(0, 0, 0);
    this._tempObject2.rotation.set(0, 0, 0);
    this._tempObject2.scale.set(1, 1, 1);
    this._tempObject2.updateMatrix();
    this._tempObject2.applyMatrix4(transformWithoutScale);
    this._tempObject1.attach(this._tempObject2);
    const { px, py, pz, dxx, dxy, dxz, dyx, dyy, dyz } = this.decompose(
      this._tempObject2.matrix
    );
    this._tempObject2.removeFromParent();
    const isOrigin = px === 0 && py === 0 && pz === 0 && dxx === 1 && dxy === 0 && dxz === 0 && dyx === 0 && dyy === 1 && dyz === 0;
    if (!isOrigin) {
      const hash = `${px}-${py}-${pz}-${dxx}-${dxy}-${dxz}-${dyx}-${dyy}-${dyz}`;
      const previousLocalTransform = this._previousLocalTransforms.get(hash);
      if (previousLocalTransform) {
        geometryData.localTransformID = previousLocalTransform.id;
      } else {
        const id = this._previousLocalTransforms.size + 1;
        const localTransform = {
          id,
          data: [px, py, pz, dxx, dxy, dxz, dyx, dyy, dyz]
        };
        this._previousLocalTransforms.set(hash, localTransform);
        geometryData.localTransformID = localTransform.id;
        this.onLocalTransformLoaded(localTransform);
      }
    }
  }
  removeScale(elements) {
    const matrix = new THREE.Matrix4().fromArray(elements);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);
    const units = scale;
    const transformWithoutScale = new THREE.Matrix4();
    transformWithoutScale.compose(
      position,
      quaternion,
      new THREE.Vector3(1, 1, 1)
    );
    return { units, transformWithoutScale };
  }
  decompose(transform) {
    const p = 1e3;
    const ap = 1e5;
    const dxx = GeomsFbUtils.round(transform.elements[0], p);
    const dxy = GeomsFbUtils.round(transform.elements[1], p);
    const dxz = GeomsFbUtils.round(transform.elements[2], p);
    const dyx = GeomsFbUtils.round(transform.elements[4], ap);
    const dyy = GeomsFbUtils.round(transform.elements[5], ap);
    const dyz = GeomsFbUtils.round(transform.elements[6], ap);
    const dzx = GeomsFbUtils.round(transform.elements[8], ap);
    const dzy = GeomsFbUtils.round(transform.elements[9], ap);
    const dzz = GeomsFbUtils.round(transform.elements[10], ap);
    const px = GeomsFbUtils.round(transform.elements[12], ap);
    const py = GeomsFbUtils.round(transform.elements[13], ap);
    const pz = GeomsFbUtils.round(transform.elements[14], ap);
    return { dxx, dxy, dxz, dyx, dyy, dyz, dzx, dzy, dzz, px, py, pz };
  }
  // https://stackoverflow.com/a/1568551
  getVolume(index, pos) {
    let volume = 0;
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    for (let i = 0; i < index.length - 2; i += 3) {
      const i1 = index[i] * 3;
      const i2 = index[i + 1] * 3;
      const i3 = index[i + 2] * 3;
      p1.set(pos[i1], pos[i1 + 1], pos[i1 + 2]);
      p2.set(pos[i2], pos[i2 + 1], pos[i2 + 2]);
      p3.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      volume += this.getSignedVolumeOfTriangle(p1, p2, p3);
    }
    return Math.abs(volume);
  }
  getSignedVolumeOfTriangle(p1, p2, p3) {
    const v321 = p3.x * p2.y * p1.z;
    const v231 = p2.x * p3.y * p1.z;
    const v312 = p3.x * p1.y * p2.z;
    const v132 = p1.x * p3.y * p2.z;
    const v213 = p2.x * p1.y * p3.z;
    const v123 = p1.x * p2.y * p3.z;
    return 1 / 6 * (-v321 + v231 + v312 - v132 - v213 + v123);
  }
  getGeometryBuffers(modelID, geometryRef) {
    if (!this._ifcAPI) {
      throw new Error("Fragments: IfcAPI not initialized");
    }
    const geometry = this._ifcAPI.GetGeometry(
      modelID,
      geometryRef.geometryExpressID
    );
    const index = this._ifcAPI.GetIndexArray(
      geometry.GetIndexData(),
      geometry.GetIndexDataSize()
    );
    const vertexData = this._ifcAPI.GetVertexArray(
      geometry.GetVertexData(),
      geometry.GetVertexDataSize()
    );
    if (index.length === 0 || vertexData.length === 0) {
      geometry.delete();
      return null;
    }
    const position = new Float32Array(vertexData.length / 2);
    const normals = new Float32Array(vertexData.length / 2);
    for (let i = 0; i < vertexData.length; i += 6) {
      position[i / 2] = vertexData[i];
      position[i / 2 + 1] = vertexData[i + 1];
      position[i / 2 + 2] = vertexData[i + 2];
      normals[i / 2] = vertexData[i + 3];
      normals[i / 2 + 1] = vertexData[i + 4];
      normals[i / 2 + 2] = vertexData[i + 5];
    }
    geometry.delete();
    return { position, normals, index };
  }
  // private exportGeometry(
  //   position: Float32Array,
  //   normals: Float32Array,
  //   index: Uint32Array,
  // ) {
  //   // Create Three.js geometry and mesh
  //   const geometry = new THREE.BufferGeometry();
  //   geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  //   geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  //   geometry.setIndex(new THREE.BufferAttribute(index, 1));
  //   const material = new THREE.MeshStandardMaterial();
  //   const mesh = new THREE.Mesh(geometry, material);
  //   // Export to GLTF
  //   const exporter = new GLTFExporter();
  //   exporter.parse(
  //     mesh,
  //     (gltf) => {
  //       const output = JSON.stringify(gltf, null, 2);
  //       const blob = new Blob([output], { type: "application/json" });
  //       const url = URL.createObjectURL(blob);
  //       // Create download link
  //       const link = document.createElement("a");
  //       link.href = url;
  //       link.download = `geometry.gltf`;
  //       link.click();
  //       URL.revokeObjectURL(url);
  //     },
  //     { binary: false },
  //   );
  // }
  // Function to compute cross product
  crossProduct(v1, v2) {
    return {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };
  }
  computeCircleCurveProperties(point1, point2, point3) {
    function computeCircleCenter(point12, point22, point32) {
      const D21x = point22.x - point12.x;
      const D21y = point22.y - point12.y;
      const D21z = point22.z - point12.z;
      const D31x = point32.x - point12.x;
      const D31y = point32.y - point12.y;
      const D31z = point32.z - point12.z;
      const F2 = 0.5 * (D21x ** 2 + D21y ** 2 + D21z ** 2);
      const F3 = 0.5 * (D31x ** 2 + D31y ** 2 + D31z ** 2);
      const M23xy = D21x * D31y - D21y * D31x;
      const M23yz = D21y * D31z - D21z * D31y;
      const M23xz = D21z * D31x - D21x * D31z;
      const F23x = F2 * D31x - F3 * D21x;
      const F23y = F2 * D31y - F3 * D21y;
      const F23z = F2 * D31z - F3 * D21z;
      const m23magsq = M23xy ** 2 + M23yz ** 2 + M23xz ** 2;
      if (m23magsq === 0) {
        throw new Error(
          "Fragments: Points are collinear, no unique circle exists."
        );
      }
      const Cx = point12.x + (M23xy * F23y - M23xz * F23z) / m23magsq;
      const Cy = point12.y + (M23yz * F23z - M23xy * F23x) / m23magsq;
      const Cz = point12.z + (M23xz * F23x - M23yz * F23y) / m23magsq;
      return { x: Cx, y: Cy, z: Cz };
    }
    function subtract(p1, p2) {
      return { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
    }
    function length(v) {
      return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }
    const dirAB = subtract(point2, point1);
    const dirBC = subtract(point3, point2);
    const normal = this.crossProduct(dirAB, dirBC);
    const center = computeCircleCenter(point1, point2, point3);
    const dirAcen = subtract(point1, center);
    const dirBcen = subtract(point3, center);
    const radius = length(subtract(center, point1));
    const initialTangent = subtract(point1, center);
    const tangentMagnitude = length(initialTangent);
    initialTangent.x /= tangentMagnitude;
    initialTangent.y /= tangentMagnitude;
    initialTangent.z /= tangentMagnitude;
    const lenA = length(dirAcen);
    const lenB = length(dirBcen);
    const denom = lenA * lenB;
    const rawCos = denom === 0 ? 1 : (dirAcen.x * dirBcen.x + dirAcen.y * dirBcen.y + dirAcen.z * dirBcen.z) / denom;
    const cos = Math.max(-1, Math.min(1, rawCos));
    const angle = Math.acos(cos);
    return {
      center,
      radius,
      normal,
      initialTangent,
      angle: angle * 180 / Math.PI
      // Convert to degrees
    };
  }
  hasSweptDiskDirectrix(modelID, mesh, geometryIndex) {
    try {
      if (!this._ifcAPI) return false;
      const geometryRef = mesh.geometries.get(geometryIndex);
      if (!geometryRef) return false;
      const geometry = this._ifcAPI.GetGeometry(
        modelID,
        geometryRef.geometryExpressID
      );
      if (!geometry?.GetSweptDiskSolid) return false;
      const swept = geometry.GetSweptDiskSolid();
      return !!swept?.axis && swept.axis.size() > 0;
    } catch {
      return false;
    }
  }
}
export {
  IfcFileReader
};
//# sourceMappingURL=ifc-file-reader.mjs.map
