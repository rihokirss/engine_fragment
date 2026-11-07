import { Face } from "./face.mjs";
class Faces {
  list = /* @__PURE__ */ new Map();
  nextFaceID = 0;
  add(triangle, plane) {
    const matches = this.match(triangle, plane);
    if (matches.length === 0) {
      const newFaceID = this.nextFaceID++;
      const face = new Face(newFaceID, plane);
      face.add(triangle);
      this.list.set(face.id, face);
      return;
    }
    if (matches.length === 1) {
      const face = this.list.get(matches[0]);
      face.add(triangle);
      return;
    }
    if (matches.length > 1) {
      const baseFace = this.list.get(matches[0]);
      baseFace.add(triangle);
      for (let i = 1; i < matches.length; i++) {
        const faceToMergeID = matches[i];
        const faceToMerge = this.list.get(faceToMergeID);
        baseFace.merge(faceToMerge);
        this.list.delete(faceToMergeID);
      }
    }
  }
  match(triangle, plane) {
    let matchedFaceIDs = [];
    for (const face of this.list.values()) {
      if (face.match(triangle, plane)) {
        matchedFaceIDs.push(face.id);
      }
    }
    return matchedFaceIDs;
  }
}
export {
  Faces
};
//# sourceMappingURL=faces.mjs.map
