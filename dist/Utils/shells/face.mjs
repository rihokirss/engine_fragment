class Face {
  edges = /* @__PURE__ */ new Map();
  openEdges = /* @__PURE__ */ new Set();
  id;
  plane;
  constructor(id, plane) {
    this.id = id;
    this.plane = plane;
  }
  add(triangle) {
    if (this.edges.size === 0) {
      for (const edge of triangle) {
        this.openEdges.add(edge.hash);
        this.edges.set(edge.hash, edge);
      }
      return;
    }
    for (const edge of triangle) {
      if (this.openEdges.has(edge.hash)) {
        this.openEdges.delete(edge.hash);
      } else {
        this.openEdges.add(edge.hash);
      }
      this.edges.set(edge.hash, edge);
    }
  }
  match(triangle, plane) {
    if (plane.id !== this.plane.id) {
      return false;
    }
    for (const edge of triangle) {
      if (this.openEdges.has(edge.hash)) {
        return true;
      }
    }
    return false;
  }
  getOpenEdges() {
    const openEdges = [];
    for (const edgeID of this.openEdges) {
      openEdges.push(this.edges.get(edgeID));
    }
    return openEdges;
  }
  merge(face) {
    for (const [edgeID, edge] of face.edges) {
      this.edges.set(edgeID, edge);
    }
    for (const edgeID of face.openEdges) {
      if (this.openEdges.has(edgeID)) {
        this.openEdges.delete(edgeID);
      } else {
        this.openEdges.add(edgeID);
      }
    }
  }
}
export {
  Face
};
//# sourceMappingURL=face.mjs.map
