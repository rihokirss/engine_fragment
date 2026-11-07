import * as THREE from "three";
import { AlignmentCurveType } from "../../../../../FragmentsModels/src/model/model-types.mjs";
class CivilReader {
  read(webIfc) {
    try {
      const alignments = webIfc.GetAllAlignments(0);
      const allAlignments = [];
      for (const alignment of alignments) {
        const currentAlignment = {
          absolute: [],
          horizontal: [],
          vertical: []
        };
        allAlignments.push(currentAlignment);
        const noVertical = alignment.vertical.length === 0;
        let worldMatrix = null;
        if (noVertical && alignment.FlattenedWorldTransformMatrix) {
          worldMatrix = new THREE.Matrix4();
          worldMatrix.fromArray(alignment.FlattenedWorldTransformMatrix);
        }
        let pointsCounter = 0;
        const points3d = alignment.curve3D[0]?.points;
        for (let i = 0; i < alignment.horizontal.length; i++) {
          const curveHorizontal = alignment.horizontal[i];
          const result3d = [];
          const resultHorizontal = [];
          const type = this.getCurveType(curveHorizontal.data[1]);
          const points3DReversed = [];
          const pointsHorizontalReversed = [];
          const tempVec = new THREE.Vector3();
          for (const point of curveHorizontal.points) {
            if (noVertical) {
              tempVec.set(point.x, point.y, 0);
              if (worldMatrix) tempVec.applyMatrix4(worldMatrix);
              points3DReversed.push([tempVec.x, tempVec.z, -tempVec.y]);
            } else {
              const point3d = points3d?.[pointsCounter++];
              if (point3d) {
                points3DReversed.push([point3d.x, point3d.y, point3d.z]);
              } else {
                console.log("Problem reading alignment 3D points");
              }
            }
            pointsHorizontalReversed.push([point.x, point.y]);
          }
          for (const [x, y, z] of points3DReversed) {
            result3d.push(x, y, z);
          }
          for (const [x, y] of pointsHorizontalReversed) {
            resultHorizontal.push(x, 0, -y);
          }
          if (result3d.length) {
            currentAlignment.absolute.push({
              points: result3d,
              type
            });
          }
          currentAlignment.horizontal.push({
            points: resultHorizontal,
            type
          });
        }
        for (let i = 0; i < alignment.vertical.length; i++) {
          const curveVertical = alignment.vertical[i];
          const resultVertical = [];
          const type = this.getCurveType(curveVertical.data[1]);
          const pointsVerticalReversed = [];
          for (const point of curveVertical.points) {
            pointsVerticalReversed.push([point.x, point.y]);
          }
          for (const [x, y] of pointsVerticalReversed) {
            resultVertical.push(x, y, 0);
          }
          currentAlignment.vertical.push({
            points: resultVertical,
            type
          });
        }
      }
      return allAlignments;
    } catch (error) {
      console.error("CivilReader error:", error);
      return [];
    }
  }
  getCurveType(data) {
    if (data.includes("CIRCULARARC")) {
      return AlignmentCurveType.ELLIPSE_ARC;
    }
    if (data.includes("LINE") || data.includes("GRADIENT")) {
      return AlignmentCurveType.LINES;
    }
    if (data.includes("CLOTHOID")) {
      return AlignmentCurveType.CLOTHOID;
    }
    if (data.includes("PARABOLICARC")) {
      return AlignmentCurveType.PARABOLA;
    }
    throw new Error(`Fragments: Unknown curve type: ${data}`);
  }
}
export {
  CivilReader
};
//# sourceMappingURL=civil-reader.mjs.map
