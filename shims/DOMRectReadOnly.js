/**
 * Shim for DOMRectReadOnly without private class fields.
 * The original uses #x, #y, #width, #height which Windows hermesc doesn't support.
 */

import {setPlatformObject} from 'react-native/src/private/webapis/webidl/PlatformObjects';

function castToNumber(value) {
  return value ? Number(value) : 0;
}

export default class DOMRectReadOnly {
  constructor(x, y, width, height) {
    this.__setInternalX(x);
    this.__setInternalY(y);
    this.__setInternalWidth(width);
    this.__setInternalHeight(height);
  }

  get x() { return this._x; }
  get y() { return this._y; }
  get width() { return this._width; }
  get height() { return this._height; }

  get top() {
    return this._height < 0 ? this._y + this._height : this._y;
  }
  get right() {
    return this._width < 0 ? this._x : this._x + this._width;
  }
  get bottom() {
    return this._height < 0 ? this._y : this._y + this._height;
  }
  get left() {
    return this._width < 0 ? this._x + this._width : this._x;
  }

  toJSON() {
    const {x, y, width, height, top, left, bottom, right} = this;
    return {x, y, width, height, top, left, bottom, right};
  }

  static fromRect(rect) {
    if (!rect) return new DOMRectReadOnly();
    return new DOMRectReadOnly(rect.x, rect.y, rect.width, rect.height);
  }

  __getInternalX() { return this._x; }
  __getInternalY() { return this._y; }
  __getInternalWidth() { return this._width; }
  __getInternalHeight() { return this._height; }

  __setInternalX(x) { this._x = castToNumber(x); }
  __setInternalY(y) { this._y = castToNumber(y); }
  __setInternalWidth(width) { this._width = castToNumber(width); }
  __setInternalHeight(height) { this._height = castToNumber(height); }
}

setPlatformObject(DOMRectReadOnly, {
  clone: rect => new DOMRectReadOnly(rect.x, rect.y, rect.width, rect.height),
});
