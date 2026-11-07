class MultiBufferData {
  static _stash = [];
  _first;
  static _tempData = { position: 0, size: 0 };
  static _inf = 4294967295;
  constructor(size, firstElement) {
    this._first = this.newData(size, firstElement);
  }
  static getComplementary(data, callback) {
    let past = 0;
    const length = data.position.length;
    past = this.makeBufferComplementary(length, data, past, callback);
    if (past !== Infinity) {
      callback(past, Infinity);
    }
  }
  static get(data, positions, filter, callback) {
    const { filtered, position, size } = this.getData(data, filter);
    this.setAllBufferData(filtered, positions, position, size, callback);
    return { position, size };
  }
  fullOf(data) {
    const followingItem = this._first.following;
    const first = this._first.data;
    const noFollowing = followingItem === null;
    const sameData = first === data;
    return noFollowing && sameData;
  }
  update(position, data) {
    const input = this.getBufferData(position);
    const isSame = input.data === data;
    if (!isSame) {
      const { a, c, b } = this.newBuffers(position, input, data);
      this.setupInputData(input, a, c);
      this.setupUpdateBuffers(a, b, c);
    }
  }
  size(filter) {
    let index = 0;
    let data = this._first;
    while (data !== null) {
      const filterPass = this.doesFilterPass(filter, data);
      if (filterPass) {
        index++;
      }
      data = data.following;
    }
    return index;
  }
  static setAllBufferData(filtered, positions, position, size, callback) {
    for (let i = 0; i < filtered.length; ++i) {
      const input = filtered[i];
      this.transform(input, positions);
      this.setBuffers(position, size, i);
      if (callback) {
        callback(i, input.data);
      }
    }
  }
  static makeBufferComplementary(length, data, past, callback) {
    for (let i = 0; i < length; ++i) {
      const input = this.getBuffers(data, i);
      const { position, size } = input;
      if (position > past) {
        callback(past, position - past);
      }
      past = position + size;
    }
    return past;
  }
  static setBuffers(position, size, i) {
    position[i] = this._tempData.position;
    const isInf = this._tempData.size === Infinity;
    if (isInf) {
      size[i] = this._inf;
    } else {
      size[i] = this._tempData.size;
    }
  }
  add(position, size, data) {
    const stashExists = MultiBufferData._stash.length;
    if (!stashExists) {
      return this.newData(size, data, position);
    }
    const stashed = MultiBufferData._stash.pop();
    if (!stashed) {
      throw new Error("Fragments: No stash found");
    }
    stashed.position = position;
    stashed.size = size;
    stashed.data = data;
    return stashed;
  }
  remove(data) {
    if (data) {
      data.following = null;
      data.past = null;
      MultiBufferData._stash.push(data);
    }
  }
  static getData(data, filter) {
    const filtered = data.filter(filter);
    const length = filtered.length;
    const position = new Uint32Array(length);
    const size = new Uint32Array(length);
    return { filtered, position, size };
  }
  filter(filter) {
    const found = [];
    let data = this._first;
    while (data !== null) {
      const filterPass = this.doesFilterPass(filter, data);
      if (filterPass) {
        found.push(data);
      }
      data = data.following;
    }
    return found;
  }
  static transform(input, positions) {
    const result = this.getTempData();
    const finalPosition = input.position + input.size;
    const isFinal = finalPosition === positions.length;
    result.position = positions[input.position];
    if (isFinal) {
      result.size = Infinity;
    } else {
      const total = positions[finalPosition];
      result.size = total - result.position;
    }
    return result;
  }
  static getBuffers(data, i) {
    const position = data.position[i];
    const isInf = data.size[i] === this._inf;
    let size;
    if (isInf) {
      size = Infinity;
    } else {
      size = data.size[i];
    }
    return { position, size };
  }
  static getTempData() {
    if (!this._tempData) {
      return { position: 0, size: 0 };
    }
    return this._tempData;
  }
  doesFilterPass(filter, data) {
    const noFilter = !filter;
    const filterPass = noFilter || filter(data.data);
    return filterPass;
  }
  setupUpdateBuffers(a, b, c) {
    this.chainBuffers(a, b, c);
    this.setupFirstBuffer(a, b);
    this.setupLastBuffer(c, b);
    this.setupMiddleBufferStart(b);
    this.setupMiddleBufferEnd(b);
  }
  setupMiddleBufferEnd(b) {
    if (b.following?.data === b.data) {
      if (!b.following) {
        return;
      }
      const newSize = b.following.size + b.size;
      const following = b.following.following;
      b.size = newSize;
      this.remove(b.following);
      b.following = following;
      if (b.following) {
        b.following.past = b;
      }
    }
  }
  setupFirstBuffer(a, b) {
    if (!a.size) {
      if (a.past) {
        a.past.following = b;
      } else {
        this._first = b;
      }
      b.past = a.past;
      this.remove(a);
    }
  }
  setupMiddleBufferStart(b) {
    if (b.past?.data === b.data) {
      if (!b.past) {
        return;
      }
      b.size = b.past.size + b.size;
      b.position = b.past.position;
      const past = b.past.past;
      this.remove(b.past);
      b.past = past;
      if (b.past) {
        b.past.following = b;
      } else {
        this._first = b;
      }
    }
  }
  chainBuffers(a, b, c) {
    a.following = b;
    b.past = a;
    b.following = c;
    c.past = b;
  }
  setupLastBuffer(c, b) {
    if (!c.size) {
      if (c.following) {
        c.following.past = b;
      }
      b.following = c.following;
      this.remove(c);
    }
  }
  newBuffers(position, input, data) {
    const aSize = position - input.position;
    const a = this.add(input.position, aSize, input.data);
    const b = this.add(position, 1, data);
    const cSize = input.size - a.size - 1;
    const c = this.add(position + 1, cSize, input.data);
    return { a, c, b };
  }
  setupInputData(input, a, c) {
    if (input.past) {
      input.past.following = a;
      a.past = input.past;
    } else {
      this._first = a;
    }
    if (input.following) {
      input.following.past = c;
      c.following = input.following;
    }
    this.remove(input);
  }
  newData(size, data, position = 0) {
    return {
      position,
      size,
      past: null,
      following: null,
      data
    };
  }
  getBufferData(index) {
    let found = this._first;
    while (true) {
      const notFound = found === null;
      const lessThanIndex = found.position <= index;
      const inScope = index < found.position + found.size;
      const scoped = lessThanIndex && inScope;
      if (notFound || scoped) {
        return found;
      }
      found = found.following;
    }
  }
}
export {
  MultiBufferData
};
//# sourceMappingURL=multi-buffer-data.mjs.map
