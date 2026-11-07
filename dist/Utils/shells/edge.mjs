class Edge {
  p1;
  p2;
  hash;
  constructor(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
    const points = [this.p1, this.p2];
    points.sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
    this.hash = `${points[0].hash}_${points[1].hash}`;
  }
}
export {
  Edge
};
//# sourceMappingURL=edge.mjs.map
