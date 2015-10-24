
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var _bind = Function.prototype.bind;
exports['default'] = miniCore;

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function miniCore(assets) {

  var values = {};
  var singletons = {};
  var registry = {};

  var core = {

    resolve: resolve,

    install: function install(id, fn) {

      this.value(id, invoke(null, fn));

      return this;
    },

    singleton: function singleton(id, asset) {

      singletons[id] = true;
      register(id, asset);

      return this;
    },

    value: function value(id, asset) {
      var _this = this;

      if (isString(id)) {
        values[id] = true;
      } else if (isObject(id)) {
        asset = id;
        Object.keys(asset).forEach(function (id) {
          return _this.value(id, asset[id]);
        });
        return this;
      } else {
        throw new Error('"value" expects a string id and value or object');
      }

      register(id, asset);

      return this;
    },

    factory: function factory(id, asset) {

      register(id, asset);

      return this;
    },

    config: function config(fn) {

      invoke(null, fn);

      return this;
    }

  };

  return core.value(assets || {});

  function resolve(id) {

    var registered = registry[id];

    if (!registered) {
      throw new Error('asset "' + id + '" is not registered.');
    }

    if (values[id]) return registered;

    return invoke(id, registered);
  }

  function invoke(id, fn) {

    if (fn._instance) return fn._instance;

    var dependencies = (fn._inject || []).map(function (dep) {
      return resolve(dep);
    });
    var isSingleton = singletons[id];
    var result = isSingleton ? new (_bind.apply(fn, [null].concat(_toConsumableArray(dependencies))))() : fn.apply(undefined, _toConsumableArray(dependencies));

    if (isSingleton) {
      fn._instance = result;
    }

    return result;
  }

  function register(id, asset) {

    if (!isUndefined(registry[id])) {
      throw new Error('asset: ' + id + ' is already registry.');
    }

    registry[id] = asset;
  }
}

function isUndefined(val) {
  return typeof val === 'undefined';
}

function isString(val) {
  return typeof val === 'string';
}

function isObject(val) {
  return val != null && typeof val === 'object';
}
module.exports = exports['default'];
