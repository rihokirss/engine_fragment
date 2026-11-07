import * as THREE from "three";
import { Extrusion } from "./src/extrusion.mjs";
import { Profile } from "./src/profile.mjs";
import { ProfileType } from "./src/profile.mjs";
import { BooleanOperation } from "./src/boolean-operation.mjs";
import { Arc } from "./src/arc.mjs";
import { Bbox } from "./src/bbox.mjs";
import { Clothoid } from "./src/clothoid.mjs";
import { CircularSweep } from "./src/circular-sweep.mjs";
import { CylindricalRevolve } from "./src/cylindrical-revolve.mjs";
import { Revolve } from "./src/revolve.mjs";
import { Parabola } from "./src/parabola.mjs";
import { Sweep } from "./src/sweep.mjs";
import { Wall } from "./src/wall.mjs";
class GeometryEngine {
  /**
   * The WebIFC API instance that contains the geometry engine.
   */
  api;
  _arc;
  _parabola;
  _extrusion;
  _profile;
  _booleanOperation;
  _bbox;
  _circularSweep;
  _clothoid;
  _cylindricalRevolve;
  _revolve;
  _sweep;
  _wall;
  /**
   * Creates a new geometry engine instance.
   * @param api - The WebIFC API instance that contains the geometry engine.
   */
  constructor(api) {
    this.api = api;
    this._extrusion = new Extrusion(api);
    this._profile = new Profile(api);
    this._booleanOperation = new BooleanOperation(api);
    this._arc = new Arc(api);
    this._bbox = new Bbox(api);
    this._clothoid = new Clothoid(api);
    this._circularSweep = new CircularSweep(api);
    this._cylindricalRevolve = new CylindricalRevolve(api);
    this._revolve = new Revolve(api);
    this._parabola = new Parabola(api);
    this._sweep = new Sweep(api);
    this._wall = new Wall(api);
  }
  /**
   * Generates an extrusion geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the extrusion.
   */
  getExtrusion(geometry, data) {
    const buffers = this._extrusion.get(this.api, data);
    this.applyMesh(geometry, buffers);
  }
  /**
   * Generates a sweep geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the sweep.
   */
  getSweep(geometry, data) {
    const buffers = this._sweep.get(this.api, data);
    this.applyMesh(geometry, buffers);
  }
  /**
   * Generates a wall geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the wall.
   */
  getWall(geometry, data) {
    const buffers = this._wall.get(this.api, data);
    this.applyMesh(geometry, buffers);
  }
  /**
   * Generates a profile geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the profile.
   */
  getProfile(geometry, data) {
    const buffers = this._profile.get(this.api, data);
    this.applyCurve(geometry, buffers);
  }
  /**
   * Generates a boolean operation geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the boolean operation.
   */
  getBooleanOperation(geometry, data) {
    const buffers = this._booleanOperation.get(this.api, data);
    this.applyMesh(geometry, buffers);
  }
  /**
   * Generates a bounding box geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the bounding box.
   */
  getBbox(geometry, data) {
    const buffers = this._bbox.get(data);
    this.applyMesh(geometry, buffers);
  }
  /**
   * Generates a circular sweep geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the circular sweep.
   */
  getCircularSweep(geometry, data) {
    const buffers = this._circularSweep.get(this.api, data);
    this.applyMesh(geometry, buffers);
  }
  /**
   * Generates a revolve geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the revolve.
   */
  getRevolve(geometry, data) {
    const buffers = this._revolve.get(this.api, data);
    this.applyMesh(geometry, buffers);
  }
  /**
   * Generates a cylindrical revolve geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the cylindrical revolve.
   */
  getCylindricalRevolve(geometry, data) {
    const buffers = this._cylindricalRevolve.get(this.api, data);
    this.applyMesh(geometry, buffers);
  }
  /**
   * Generates an arc geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the arc.
   */
  getArc(geometry, data) {
    const buffers = this._arc.get(this.api, data);
    this.applyCurve(geometry, buffers);
  }
  /**
   * Generates a parabola geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the parabola.
   */
  getParabola(geometry, data) {
    const buffers = this._parabola.get(data);
    this.applyCurve(geometry, buffers);
  }
  /**
   * Generates a clothoid geometry from the given data.
   * @param geometry - The geometry to store the result.
   * @param data - The data to generate the clothoid.
   */
  getClothoid(geometry, data) {
    const buffers = this._clothoid.get(data);
    this.applyCurve(geometry, buffers);
  }
  /**
   * Generates profile points from the given data.
   * @param data - The data to generate the profile points.
   * @returns The profile points.
   */
  getProfilePoints(data) {
    const buffers = this._profile.get(this.api, data);
    const vertexSize = buffers.fvertexData.size();
    const points = [];
    for (let i = 0; i < vertexSize; i++) {
      const value = buffers.fvertexData.get(i);
      points.push(value);
    }
    return points;
  }
  /**
   * Transforms points from the given data.
   * @param points - The points to transform.
   * @param transform - The transform to apply to the points.
   * @returns The transformed points.
   */
  transformPoints(points, transform) {
    const rotatedPoints = [];
    const tempPoint = new THREE.Vector3();
    for (let i = 0; i < points.length; i += 3) {
      tempPoint.set(points[i], points[i + 1], points[i + 2]);
      tempPoint.applyMatrix4(transform);
      rotatedPoints.push(tempPoint.x, tempPoint.y, tempPoint.z);
    }
    return rotatedPoints;
  }
  applyMesh(geometry, buffers) {
    const vertexSize = buffers.fvertexData.size();
    const vertices = new Float32Array(vertexSize);
    for (let i = 0; i < vertexSize; i++) {
      vertices[i] = buffers.fvertexData.get(i);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    const indexSize = buffers.indexData.size();
    const indices = [];
    for (let i = 0; i < indexSize; i++) {
      indices[i] = buffers.indexData.get(i);
    }
    geometry.setIndex(indices);
    const normalArray = new Float32Array(vertexSize).fill(0);
    geometry.setAttribute("normal", new THREE.BufferAttribute(normalArray, 3));
    geometry.computeVertexNormals();
  }
  applyCurve(geometry, buffers) {
    const vertexSize = buffers.fvertexData.size();
    const vertices = new Float32Array(vertexSize);
    for (let i = 0; i < vertexSize; i++) {
      vertices[i] = buffers.fvertexData.get(i);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    const indices = [];
    for (let i = 0; i < vertexSize / 3 - 1; i++) {
      indices.push(i, i + 1);
    }
    geometry.setIndex(indices);
  }
}
export {
  Arc,
  Bbox,
  BooleanOperation,
  CircularSweep,
  Clothoid,
  CylindricalRevolve,
  Extrusion,
  GeometryEngine,
  Parabola,
  Profile,
  ProfileType,
  Revolve,
  Sweep,
  Wall
};
//# sourceMappingURL=index.mjs.map
