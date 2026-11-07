import * as THREE from "three";
import { Points } from "./points.mjs";
import { Faces } from "./faces.mjs";
import { Profiles } from "./profiles.mjs";
import { Edge } from "./edge.mjs";
import { Plane } from "./plane.mjs";
import { ShellType } from "../../Schema/shell-type.mjs";
import { RepresentationClass } from "../../Schema/representation-class.mjs";
class GeomsFbUtils {
  // It's 65535, but we leave some margin
  static ushortMaxValue = 65e3;
  static round(value, precision) {
    return Math.round(value * precision) / precision;
  }
  static floor(value, precision) {
    return Math.floor(value * precision) / precision;
  }
  static ceil(value, precision) {
    return Math.ceil(value * precision) / precision;
  }
  static getAABB(vertices, precision) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    return precision ? {
      min: {
        x: this.floor(minX, precision),
        y: this.floor(minY, precision),
        z: this.floor(minZ, precision)
      },
      max: {
        x: this.ceil(maxX, precision),
        y: this.ceil(maxY, precision),
        z: this.ceil(maxZ, precision)
      }
    } : {
      min: {
        x: minX,
        y: minY,
        z: minZ
      },
      max: {
        x: maxX,
        y: maxY,
        z: maxZ
      }
    };
  }
  static transformFromMatrix(matrix, transform = {
    position: [0, 0, 0],
    xDirection: [1, 0, 0],
    yDirection: [0, 1, 0]
  }) {
    const posX = matrix.elements[12];
    const posY = matrix.elements[13];
    const posZ = matrix.elements[14];
    const xDirX = matrix.elements[0];
    const xDirY = matrix.elements[1];
    const xDirZ = matrix.elements[2];
    const yDirX = matrix.elements[4];
    const yDirY = matrix.elements[5];
    const yDirZ = matrix.elements[6];
    transform.position[0] = posX;
    transform.position[1] = posY;
    transform.position[2] = posZ;
    transform.xDirection[0] = xDirX;
    transform.xDirection[1] = xDirY;
    transform.xDirection[2] = xDirZ;
    transform.yDirection[0] = yDirX;
    transform.yDirection[1] = yDirY;
    transform.yDirection[2] = yDirZ;
    return transform;
  }
  static matrixFromTransform(transform) {
    const localTransform = new THREE.Matrix4();
    const [px, py, pz] = transform.position;
    const [xx, xy, xz] = transform.xDirection;
    const [yx, yy, yz] = transform.yDirection;
    const vx = new THREE.Vector3(xx, xy, xz);
    const vy = new THREE.Vector3(yx, yy, yz);
    const { x: zx, y: zy, z: zz } = vx.cross(vy);
    localTransform.fromArray([
      xx,
      xy,
      xz,
      0,
      yx,
      yy,
      yz,
      0,
      zx,
      zy,
      zz,
      0,
      px,
      py,
      pz,
      1
    ]);
    return localTransform;
  }
  static bboxFromCircleExtrusion(data) {
    const bbox = new THREE.Box3();
    const points = [];
    for (const axis of data.axes) {
      for (const wire of axis.wires) {
        for (let i = 0; i < wire.length - 2; i += 3) {
          const x = wire[i];
          const y = wire[i + 1];
          const z = wire[i + 2];
          points.push(new THREE.Vector3(x, y, z));
        }
      }
    }
    bbox.setFromPoints(points);
    const minX = bbox.min.x;
    const minY = bbox.min.y;
    const minZ = bbox.min.z;
    const maxX = bbox.max.x;
    const maxY = bbox.max.y;
    const maxZ = bbox.max.z;
    return [minX, minY, minZ, maxX, maxY, maxZ];
  }
  static representationFromGeometry(newRepresentation, repr = {
    bbox: [0, 0, 0, 0, 0, 0],
    representationClass: RepresentationClass.SHELL,
    geometry: {
      points: [],
      type: ShellType.NONE,
      profiles: /* @__PURE__ */ new Map(),
      holes: /* @__PURE__ */ new Map(),
      bigHoles: /* @__PURE__ */ new Map(),
      bigProfiles: /* @__PURE__ */ new Map(),
      profilesFaceIds: []
    }
  }, settings = {
    threshold: 3e3,
    precision: 1e6,
    normalPrecision: 1e7,
    planePrecision: 1e3,
    faceThreshold: 0.6,
    forceTransparentSpaces: true
  }) {
    const positionAttr = newRepresentation.getAttribute("position");
    const position = positionAttr.array;
    const normalsAttr = newRepresentation.getAttribute("normal");
    const normals = normalsAttr.array;
    const indexAttr = newRepresentation.index;
    const index = indexAttr.array;
    const newShell = GeomsFbUtils.getShellData({
      position,
      normals,
      index,
      raw: false,
      settings
    });
    const { min, max } = newShell.bbox;
    repr.bbox = [min.x, min.y, min.z, max.x, max.y, max.z];
    if (repr.representationClass === RepresentationClass.CIRCLE_EXTRUSION) {
      throw new Error("Circle extrusions can't be represented as shells");
    }
    const shellData = repr.geometry;
    const points = newShell.points;
    const isBigShell = points.length > GeomsFbUtils.ushortMaxValue;
    shellData.type = isBigShell ? ShellType.BIG : ShellType.NONE;
    shellData.points = points;
    shellData.profilesFaceIds = newShell.profilesFaceIds;
    if (isBigShell) {
      shellData.profiles = /* @__PURE__ */ new Map();
      shellData.holes = /* @__PURE__ */ new Map();
      shellData.bigHoles = newShell.holes;
      shellData.bigProfiles = newShell.profiles;
    } else {
      shellData.profiles = newShell.profiles;
      shellData.holes = newShell.holes;
      shellData.bigHoles = /* @__PURE__ */ new Map();
      shellData.bigProfiles = /* @__PURE__ */ new Map();
    }
    return repr;
  }
  static getRawShellData(index, position, bbox, settings, category) {
    const pointsMap = /* @__PURE__ */ new Map();
    const profiles = /* @__PURE__ */ new Map();
    const { precision } = settings;
    const getPointIndex = (x, y, z) => {
      const key = `${x},${y},${z}`;
      if (pointsMap.has(key)) {
        return pointsMap.get(key)[0];
      }
      const index2 = pointsMap.size;
      pointsMap.set(key, [
        index2,
        this.round(x, precision),
        this.round(y, precision),
        this.round(z, precision)
      ]);
      return index2;
    };
    for (let i = 0; i < index.length - 2; i += 3) {
      const v1Index = index[i];
      const v2Index = index[i + 1];
      const v3Index = index[i + 2];
      const p1x = position[v1Index * 3];
      const p1y = position[v1Index * 3 + 1];
      const p1z = position[v1Index * 3 + 2];
      const p2x = position[v2Index * 3];
      const p2y = position[v2Index * 3 + 1];
      const p2z = position[v2Index * 3 + 2];
      const p3x = position[v3Index * 3];
      const p3y = position[v3Index * 3 + 1];
      const p3z = position[v3Index * 3 + 2];
      const i1 = getPointIndex(p1x, p1y, p1z);
      const i2 = getPointIndex(p2x, p2y, p2z);
      const i3 = getPointIndex(p3x, p3y, p3z);
      profiles.set(profiles.size, [i1, i2, i3]);
    }
    const points = [];
    for (const [, [, x, y, z]] of pointsMap) {
      points.push([x, y, z]);
    }
    const result = {
      bbox,
      type: RepresentationClass.SHELL,
      profiles,
      holes: /* @__PURE__ */ new Map(),
      points,
      profilesFaceIds: []
    };
    if (category && settings.categoryFaceThresholds?.has(category)) {
      this.computeShellFaceIds(result, settings, category);
    } else {
      for (let i = 0; i < profiles.size; i++) {
        result.profilesFaceIds.push(0);
      }
    }
    return result;
  }
  static getShellData(geometry) {
    const { position, normals, index, raw, settings, category } = geometry;
    const { threshold, precision, normalPrecision, planePrecision } = settings;
    const vertexCount = position.length / 3;
    const tooBigToShell = vertexCount > threshold;
    const bbox = this.getAABB(position, precision);
    if (bbox.min.x === 0 && bbox.min.y === 0 && bbox.min.z === 0 && bbox.max.x === 0 && bbox.max.y === 0 && bbox.max.z === 0) {
      throw new Error("Fragments: Bbox is not valid");
    }
    if (raw || tooBigToShell) {
      return this.getRawShellData(index, position, bbox, settings, category);
    }
    const tempPlane = new THREE.Plane();
    const tempNormal = new THREE.Vector3();
    const tempPoint = new THREE.Vector3();
    const coplanarTriangles = /* @__PURE__ */ new Map();
    for (let i = 0; i < index.length - 2; i += 3) {
      const v1Index = index[i];
      tempNormal.set(
        normals[v1Index * 3],
        normals[v1Index * 3 + 1],
        normals[v1Index * 3 + 2]
      );
      tempPoint.set(
        position[v1Index * 3],
        position[v1Index * 3 + 1],
        position[v1Index * 3 + 2]
      );
      tempPlane.setFromNormalAndCoplanarPoint(tempNormal, tempPoint);
      const plane = new Plane(tempPlane, planePrecision, normalPrecision);
      if (!coplanarTriangles.has(plane.id)) {
        coplanarTriangles.set(plane.id, plane);
      }
      coplanarTriangles.get(plane.id).faces.push(i);
    }
    const points = new Points(precision);
    const faces = new Faces();
    for (const [, plane] of coplanarTriangles) {
      for (const triangleIndex of plane.faces) {
        const v1Index = index[triangleIndex];
        const v2Index = index[triangleIndex + 1];
        const v3Index = index[triangleIndex + 2];
        if (!points.isValidTriangle(position, v1Index, v2Index, v3Index)) {
          continue;
        }
        const p1 = points.create(position, v1Index);
        const p2 = points.create(position, v2Index);
        const p3 = points.create(position, v3Index);
        const e1 = new Edge(p1, p2);
        const e2 = new Edge(p2, p3);
        const e3 = new Edge(p3, p1);
        const triangle = [e1, e2, e3];
        faces.add(triangle, plane);
      }
    }
    const profiles = /* @__PURE__ */ new Map();
    const holes = /* @__PURE__ */ new Map();
    let faceCounter = 0;
    for (const [, face] of faces.list) {
      const profile = new Profiles(face.plane);
      const openEdges = face.getOpenEdges();
      if (openEdges.length === 0) {
        return this.getRawShellData(index, position, bbox, settings, category);
      }
      for (const edge of openEdges) {
        profile.add(edge);
      }
      const resultProfiles = profile.getProfiles();
      profiles.set(faceCounter, resultProfiles?.profile || []);
      holes.set(faceCounter, resultProfiles?.holes || []);
      faceCounter++;
    }
    let profileCounter = 0;
    const profileIndexMap = /* @__PURE__ */ new Map();
    const filteredProfiles = /* @__PURE__ */ new Map();
    for (const [id, profile] of profiles) {
      if (profile.length) {
        profileIndexMap.set(id, profileCounter);
        filteredProfiles.set(profileCounter, profile);
        profileCounter++;
      }
    }
    const filteredHoles = /* @__PURE__ */ new Map();
    for (const [id, hole] of holes) {
      if (hole.length) {
        const newHoleId = profileIndexMap.get(id);
        filteredHoles.set(newHoleId, hole);
      }
    }
    const result = {
      bbox,
      type: RepresentationClass.SHELL,
      profiles: filteredProfiles,
      holes: filteredHoles,
      points: points.get(),
      profilesFaceIds: []
    };
    this.computeShellFaceIds(result, settings, category);
    return result;
  }
  static computeShellFaceIds(shell, settings, category) {
    let faceThreshold = settings.faceThreshold;
    if (category && settings.categoryFaceThresholds?.has(category)) {
      faceThreshold = settings.categoryFaceThresholds.get(category);
    }
    const faceIdPerProfile = /* @__PURE__ */ new Map();
    let nextFaceId = 0;
    const edgeFacePair = /* @__PURE__ */ new Map();
    const edgesPerProfile = /* @__PURE__ */ new Map();
    const profilesNormal = /* @__PURE__ */ new Map();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    const n = new THREE.Vector3();
    const tempTriangle = new THREE.Triangle();
    const profilesLength = shell.profiles.size;
    for (let i = 0; i < profilesLength; i++) {
      const profile = shell.profiles.get(i);
      const indicesLength = profile.length;
      for (let j = 0; j < indicesLength; j++) {
        const p1Index = profile[j];
        const isLast = j === indicesLength - 1;
        const p2Index = isLast ? profile[0] : profile[j + 1];
        const minIndex = Math.min(p1Index, p2Index);
        const maxIndex = Math.max(p1Index, p2Index);
        const edgeId = minIndex + this.makeDecimal(maxIndex);
        if (!edgesPerProfile.has(i)) {
          edgesPerProfile.set(i, [edgeId]);
        } else {
          edgesPerProfile.get(i).push(edgeId);
        }
        if (!edgeFacePair.has(edgeId)) {
          edgeFacePair.set(edgeId, [i]);
        } else {
          edgeFacePair.get(edgeId).push(i);
        }
      }
      let index1 = 0;
      let index2 = 1;
      let index3 = 2;
      while (index3 < indicesLength) {
        const p1Index = profile[index1];
        const p2Index = profile[index2];
        const p3Index = profile[index3];
        p1.set(
          shell.points[p1Index][0],
          shell.points[p1Index][1],
          shell.points[p1Index][2]
        );
        p2.set(
          shell.points[p2Index][0],
          shell.points[p2Index][1],
          shell.points[p2Index][2]
        );
        p3.set(
          shell.points[p3Index][0],
          shell.points[p3Index][1],
          shell.points[p3Index][2]
        );
        tempTriangle.set(p1, p2, p3);
        tempTriangle.getNormal(n);
        if (n.x !== 0 || n.y !== 0 || n.z !== 0) {
          break;
        }
        index1++;
        index2++;
        index3++;
      }
      profilesNormal.set(i, [n.x, n.y, n.z]);
    }
    for (const [profile, edges] of edgesPerProfile) {
      let faceId = faceIdPerProfile.get(profile);
      if (faceId === void 0) {
        faceId = nextFaceId++;
        faceIdPerProfile.set(profile, faceId);
      }
      const [nx1, ny1, nz1] = profilesNormal.get(profile);
      for (const edge of edges) {
        const facePair = edgeFacePair.get(edge);
        for (const currentProfile of facePair) {
          if (currentProfile === profile) continue;
          const [nx2, ny2, nz2] = profilesNormal.get(currentProfile);
          const dot = Math.abs(nx1 * nx2 + ny1 * ny2 + nz1 * nz2);
          const isHard = dot < faceThreshold;
          if (faceIdPerProfile.has(currentProfile)) {
            if (!isHard) {
              const currentFaceId = faceIdPerProfile.get(currentProfile);
              for (const [key, value] of faceIdPerProfile) {
                if (value === currentFaceId) {
                  faceIdPerProfile.set(key, faceId);
                }
              }
            }
          } else {
            const newFaceId = isHard ? nextFaceId++ : faceId;
            faceIdPerProfile.set(currentProfile, newFaceId);
          }
        }
      }
    }
    for (let i = 0; i < shell.profiles.size; i++) {
      if (!faceIdPerProfile.has(i)) {
        throw new Error(`Face id not found for profile ${i}`);
      }
    }
    const sortedKeys = Array.from(faceIdPerProfile.keys()).sort(
      (a, b) => a - b
    );
    for (const key of sortedKeys) {
      const faceId = faceIdPerProfile.get(key);
      shell.profilesFaceIds.push(faceId);
    }
  }
  static makeDecimal(value) {
    let num = 1;
    while (num <= value) {
      num *= 10;
    }
    return value / num;
  }
}
export {
  GeomsFbUtils
};
//# sourceMappingURL=index.mjs.map
