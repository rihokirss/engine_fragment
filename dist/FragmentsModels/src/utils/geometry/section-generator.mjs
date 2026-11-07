import * as THREE from "three";
import earcut from "../../../../vendor/earcut/src/earcut.mjs";
class SectionGenerator {
  _inverseMatrix = new THREE.Matrix4();
  _localPlane = new THREE.Plane();
  _tempLine = new THREE.Line3();
  _tempVector = new THREE.Vector3();
  _plane;
  _plane2DCoordinateSystem = new THREE.Matrix4();
  _precission = 1e4;
  // Used if the plane is orthogonal to the cartesian planes
  // private _planeAxis?: "x" | "y" | "z";
  get plane() {
    if (!this._plane) {
      throw new Error("Fragments: Plane not set");
    }
    return this._plane;
  }
  set plane(plane) {
    this._plane = plane;
  }
  // This assumes that the mesh that contains the posAttr is aligned with the current plane
  createEdges(data) {
    const { meshes, posAttr } = data;
    let index = 0;
    posAttr.array.fill(0);
    const indexes = [];
    let lastIndex = 0;
    const tempMesh = new THREE.Mesh();
    for (const mesh of meshes) {
      if (!mesh.geometry) {
        continue;
      }
      if (!mesh.geometry.boundsTree) {
        mesh.geometry.computeBoundsTree();
      }
      if (!mesh.geometry.boundsTree) {
        throw new Error(
          "Fragments: Bounds tree not found for edges generation."
        );
      }
      if (mesh instanceof THREE.InstancedMesh) {
        if (mesh.count === 0) {
          continue;
        }
        const instanced = mesh;
        for (let i = 0; i < instanced.count; i++) {
          tempMesh.geometry = mesh.geometry;
          tempMesh.matrix.copy(mesh.matrix);
          const tempMatrix = new THREE.Matrix4();
          instanced.getMatrixAt(i, tempMatrix);
          tempMesh.applyMatrix4(tempMatrix);
          tempMesh.applyMatrix4(mesh.matrixWorld);
          tempMesh.updateMatrix();
          tempMesh.updateMatrixWorld();
          this._inverseMatrix.copy(tempMesh.matrixWorld).invert();
          this._localPlane.copy(this.plane).applyMatrix4(this._inverseMatrix);
          index = this.shapecast(tempMesh, posAttr, index);
          if (index !== lastIndex) {
            indexes.push(index);
            lastIndex = index;
          }
        }
      } else {
        this._inverseMatrix.copy(mesh.matrixWorld).invert();
        this._localPlane.copy(this.plane).applyMatrix4(this._inverseMatrix);
        index = this.shapecast(mesh, posAttr, index);
        if (index !== lastIndex) {
          indexes.push(index);
          lastIndex = index;
        }
      }
    }
    return { indexes, index };
  }
  createFills(buffer, trianglesIndices) {
    this.updatePlane2DCoordinateSystem();
    const allIndices = [];
    let currentTriangle = 0;
    for (let i = 0; i < trianglesIndices.length; i++) {
      const nextTriangle = trianglesIndices[i];
      const vertices = [];
      for (let j = currentTriangle; j < nextTriangle; j += 2) {
        vertices.push(j * 3);
      }
      const indices = this.computeFill(vertices, buffer);
      for (const index of indices) {
        allIndices.push(index);
      }
      currentTriangle = nextTriangle;
    }
    return allIndices;
  }
  computeFill(vertices, buffer) {
    const indices = /* @__PURE__ */ new Map();
    const all2DVertices = {};
    const shapes = /* @__PURE__ */ new Map();
    let nextShapeID = 0;
    const shapesEnds = /* @__PURE__ */ new Map();
    const shapesStarts = /* @__PURE__ */ new Map();
    const openShapes = /* @__PURE__ */ new Set();
    const p = this._precission;
    for (let i = 0; i < vertices.length; i++) {
      const startVertexIndex = vertices[i];
      let x1 = 0;
      let y1 = 0;
      let x2 = 0;
      let y2 = 0;
      const globalX1 = buffer[startVertexIndex];
      const globalY1 = buffer[startVertexIndex + 1];
      const globalZ1 = buffer[startVertexIndex + 2];
      const globalX2 = buffer[startVertexIndex + 3];
      const globalY2 = buffer[startVertexIndex + 4];
      const globalZ2 = buffer[startVertexIndex + 5];
      this._tempVector.set(globalX1, globalY1, globalZ1);
      this._tempVector.applyMatrix4(this._plane2DCoordinateSystem);
      x1 = Math.trunc(this._tempVector.x * p) / p;
      y1 = Math.trunc(this._tempVector.y * p) / p;
      this._tempVector.set(globalX2, globalY2, globalZ2);
      this._tempVector.applyMatrix4(this._plane2DCoordinateSystem);
      x2 = Math.trunc(this._tempVector.x * p) / p;
      y2 = Math.trunc(this._tempVector.y * p) / p;
      if (x1 === x2 && y1 === y2) {
        continue;
      }
      const startCode = `${x1}|${y1}`;
      const endCode = `${x2}|${y2}`;
      if (!indices.has(startCode)) {
        indices.set(startCode, startVertexIndex / 3);
      }
      if (!indices.has(endCode)) {
        indices.set(endCode, startVertexIndex / 3 + 1);
      }
      const start = indices.get(startCode);
      const end = indices.get(endCode);
      all2DVertices[start] = [x1, y1];
      all2DVertices[end] = [x2, y2];
      const startMatchesStart = shapesStarts.has(start);
      const startMatchesEnd = shapesEnds.has(start);
      const endMatchesStart = shapesStarts.has(end);
      const endMatchesEnd = shapesEnds.has(end);
      const noMatches = !startMatchesStart && !startMatchesEnd && !endMatchesStart && !endMatchesEnd;
      if (noMatches) {
        shapesStarts.set(start, nextShapeID);
        shapesEnds.set(end, nextShapeID);
        openShapes.add(nextShapeID);
        shapes.set(nextShapeID, [start, end]);
        nextShapeID++;
      } else if (startMatchesStart && endMatchesEnd) {
        const startIndex = shapesStarts.get(start);
        const endIndex = shapesEnds.get(end);
        const isShapeMerge = startIndex !== endIndex;
        if (isShapeMerge) {
          const endShape = shapes.get(endIndex);
          const startShape = shapes.get(startIndex);
          if (!endShape || !startShape) {
            continue;
          }
          shapes.delete(startIndex);
          openShapes.delete(startIndex);
          shapesEnds.set(startShape[startShape.length - 1], endIndex);
          shapesEnds.delete(endShape[endShape.length - 1]);
          for (const index of startShape) {
            endShape.push(index);
          }
        } else {
          openShapes.delete(endIndex);
        }
        shapesStarts.delete(start);
        shapesEnds.delete(end);
      } else if (startMatchesEnd && endMatchesStart) {
        const startIndex = shapesStarts.get(end);
        const endIndex = shapesEnds.get(start);
        const isShapeMerge = startIndex !== endIndex;
        if (isShapeMerge) {
          const endShape = shapes.get(endIndex);
          const startShape = shapes.get(startIndex);
          if (!endShape || !startShape) {
            continue;
          }
          shapes.delete(startIndex);
          openShapes.delete(startIndex);
          shapesEnds.set(startShape[startShape.length - 1], endIndex);
          shapesEnds.delete(endShape[endShape.length - 1]);
          for (const index of startShape) {
            endShape.push(index);
          }
        } else {
          openShapes.delete(endIndex);
        }
        shapesStarts.delete(end);
        shapesEnds.delete(start);
      } else if (startMatchesStart && endMatchesStart) {
        const startIndex1 = shapesStarts.get(end);
        const startIndex2 = shapesStarts.get(start);
        const startShape2 = shapes.get(startIndex2);
        const startShape1 = shapes.get(startIndex1);
        if (!startShape2 || !startShape1) {
          continue;
        }
        shapes.delete(startIndex1);
        openShapes.delete(startIndex1);
        shapesStarts.delete(startShape2[0]);
        shapesStarts.delete(startShape1[0]);
        shapesEnds.delete(startShape1[startShape1.length - 1]);
        shapesStarts.set(startShape1[startShape1.length - 1], startIndex2);
        startShape1.reverse();
        startShape2.splice(0, 0, ...startShape1);
      } else if (startMatchesEnd && endMatchesEnd) {
        const endIndex1 = shapesEnds.get(end);
        const endIndex2 = shapesEnds.get(start);
        const endShape2 = shapes.get(endIndex2);
        const endShape1 = shapes.get(endIndex1);
        if (!endShape2 || !endShape1) {
          continue;
        }
        shapes.delete(endIndex1);
        openShapes.delete(endIndex1);
        shapesEnds.delete(endShape2[endShape2.length - 1]);
        shapesEnds.delete(endShape1[endShape1.length - 1]);
        shapesStarts.delete(endShape1[0]);
        shapesEnds.set(endShape1[0], endIndex2);
        endShape1.reverse();
        endShape2.push(...endShape1);
      } else if (startMatchesStart) {
        const shapeIndex = shapesStarts.get(start);
        const shape = shapes.get(shapeIndex);
        if (!shape) {
          continue;
        }
        shape.unshift(end);
        shapesStarts.delete(start);
        shapesStarts.set(end, shapeIndex);
      } else if (startMatchesEnd) {
        const shapeIndex = shapesEnds.get(start);
        const shape = shapes.get(shapeIndex);
        if (!shape) {
          continue;
        }
        shape.push(end);
        shapesEnds.delete(start);
        shapesEnds.set(end, shapeIndex);
      } else if (endMatchesStart) {
        const shapeIndex = shapesStarts.get(end);
        const shape = shapes.get(shapeIndex);
        if (!shape) {
          continue;
        }
        shape.unshift(start);
        shapesStarts.delete(end);
        shapesStarts.set(start, shapeIndex);
      } else if (endMatchesEnd) {
        const shapeIndex = shapesEnds.get(end);
        const shape = shapes.get(shapeIndex);
        if (!shape) {
          continue;
        }
        shape.push(start);
        shapesEnds.delete(end);
        shapesEnds.set(start, shapeIndex);
      }
    }
    const trueIndices = [];
    for (const [id, shape] of shapes) {
      if (openShapes.has(id)) {
        continue;
      }
      const vertices2 = [];
      const indexMap = /* @__PURE__ */ new Map();
      let counter = 0;
      for (const index of shape) {
        const vertex = all2DVertices[index];
        vertices2.push(vertex[0], vertex[1]);
        indexMap.set(counter++, index);
      }
      const result = earcut(vertices2);
      for (const index of result) {
        const trueIndex = indexMap.get(index);
        if (trueIndex === void 0) {
          throw new Error("Fragments: Map error!");
        }
        trueIndices.push(trueIndex);
      }
    }
    return trueIndices;
  }
  updatePlane2DCoordinateSystem() {
    this._plane2DCoordinateSystem = new THREE.Matrix4();
    const zAxis = this.plane.normal;
    const pos = new THREE.Vector3();
    this.plane.coplanarPoint(pos);
    let xAxis;
    let yAxis;
    if (Math.abs(zAxis.z) > 0.99) {
      xAxis = new THREE.Vector3(1, 0, 0);
      yAxis = new THREE.Vector3(0, 1, 0);
    } else if (Math.abs(zAxis.x) > 0.99) {
      xAxis = new THREE.Vector3(0, 1, 0);
      yAxis = new THREE.Vector3(0, 0, 1);
    } else if (Math.abs(zAxis.y) > 0.99) {
      xAxis = new THREE.Vector3(1, 0, 0);
      yAxis = new THREE.Vector3(0, 0, 1);
    } else {
      const tempVector = Math.abs(zAxis.x) < 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      xAxis = new THREE.Vector3();
      xAxis.crossVectors(tempVector, zAxis).normalize();
      yAxis = new THREE.Vector3();
      yAxis.crossVectors(zAxis, xAxis).normalize();
    }
    this._plane2DCoordinateSystem.fromArray([
      xAxis.x,
      xAxis.y,
      xAxis.z,
      0,
      yAxis.x,
      yAxis.y,
      yAxis.z,
      0,
      zAxis.x,
      zAxis.y,
      zAxis.z,
      0,
      pos.x,
      pos.y,
      pos.z,
      1
    ]);
    this._plane2DCoordinateSystem.invert();
  }
  shapecast(mesh, posAttr, index) {
    mesh.geometry.boundsTree.shapecast({
      intersectsBounds: (box) => {
        return this._localPlane.intersectsBox(box);
      },
      // @ts-ignore
      intersectsTriangle: (tri) => {
        let count = 0;
        this._tempLine.start.copy(tri.a);
        this._tempLine.end.copy(tri.b);
        if (this._localPlane.intersectLine(this._tempLine, this._tempVector)) {
          const result = this._tempVector.applyMatrix4(mesh.matrixWorld);
          posAttr.setXYZ(index, result.x, result.y, result.z);
          count++;
          index++;
        }
        this._tempLine.start.copy(tri.b);
        this._tempLine.end.copy(tri.c);
        if (this._localPlane.intersectLine(this._tempLine, this._tempVector)) {
          const result = this._tempVector.applyMatrix4(mesh.matrixWorld);
          posAttr.setXYZ(index, result.x, result.y, result.z);
          count++;
          index++;
        }
        this._tempLine.start.copy(tri.c);
        this._tempLine.end.copy(tri.a);
        if (this._localPlane.intersectLine(this._tempLine, this._tempVector)) {
          const result = this._tempVector.applyMatrix4(mesh.matrixWorld);
          posAttr.setXYZ(index, result.x, result.y, result.z);
          count++;
          index++;
        }
        if (count !== 2) {
          index -= count;
        }
      }
    });
    return index;
  }
}
export {
  SectionGenerator
};
//# sourceMappingURL=section-generator.mjs.map
