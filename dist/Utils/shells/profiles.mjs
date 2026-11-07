import { Profile } from "./profile.mjs";
class Profiles {
  list = /* @__PURE__ */ new Map();
  plane;
  nextProfileID = 0;
  constructor(plane) {
    this.plane = plane;
  }
  add(edge) {
    const matches = this.match(edge);
    if (matches.length === 0) {
      const profileId = this.nextProfileID++;
      const profile = new Profile(this.plane);
      profile.add(edge);
      this.list.set(profileId, profile);
      return;
    }
    if (matches.length === 1) {
      const profile = this.list.get(matches[0]);
      profile.add(edge);
      return;
    }
    if (matches.length > 1) {
      const profile = this.list.get(matches[0]);
      profile.add(edge);
      const profileToMerge = this.list.get(matches[1]);
      profile.merge(profileToMerge);
      this.list.delete(matches[1]);
    }
  }
  getProfiles() {
    let biggestProfile = null;
    let biggestProfileSize = 0;
    for (const [profileId, profile2] of this.list) {
      const area = profile2.getArea();
      if (area > biggestProfileSize) {
        biggestProfileSize = area;
        biggestProfile = profileId;
      }
    }
    if (biggestProfile === null) {
      return null;
    }
    const profile = this.list.get(biggestProfile).getIndices();
    const holes = [];
    for (const [profileId, profile2] of this.list) {
      if (profileId === biggestProfile) continue;
      holes.push(profile2.getIndices());
    }
    return { profile, holes };
  }
  match(edge) {
    const ids = [];
    for (const [id, profile] of this.list) {
      if (profile.match(edge) > 0) {
        ids.push(id);
      }
    }
    return ids;
  }
}
export {
  Profiles
};
//# sourceMappingURL=profiles.mjs.map
