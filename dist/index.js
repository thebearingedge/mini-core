
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var _bind = Function.prototype.bind;
exports['default'] = miniCore;

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function miniCore(assets) {

  var core = {

    _values: {},

    _singletons: {},

    _registry: {},

    _classes: {},

    resolve: resolve,

    install: function install(id, fn) {

      this.value(id, invoke(null, fn));

      return this;
    },

    singleton: function singleton(id, asset) {

      this._singletons[id] = this._classes[id] = true;
      register(id, asset);

      return this;
    },

    value: function value(id, asset) {
      var _this = this;

      if (isObject(id)) {
        asset = id;
        Object.keys(asset).forEach(function (id) {
          return _this.value(id, asset[id]);
        });
      } else if (isString(id)) {
        this._values[id] = true;
        register(id, asset);
      } else {
        throw new Error('"value" expects a string id and value or object');
      }

      return this;
    },

    factory: function factory(id, asset) {

      register(id, asset);

      return this;
    },

    'class': function _class(id, Asset) {

      this._classes[id] = true;
      register(id, Asset);

      return this;
    },

    config: function config(fn) {

      invoke(null, fn);

      return this;
    },

    use: function use(namespace, core) {

      if (isString(namespace)) {
        namespace += '.';
      } else if (isObject(namespace)) {
        core = namespace;
        namespace = '';
      } else {
        throw new Error('"use" expects a namespace and core or core only');
      }

      return merge(namespace, this, core);
    },

    wrap: function wrap(id, fn) {

      this.value(id, function () {
        return invoke(null, fn);
      });

      return this;
    }

  };

  return core.value(assets || {});

  function resolve(id) {
    var _registry = core._registry;
    var _values = core._values;

    var registered = _registry[id];

    if (!registered) {
      throw new Error('asset "' + id + '" is not registered.');
    }

    if (_values[id]) return registered;

    return invoke(id, registered);
  }

  function invoke(id, fn) {

    if (fn._instance) return fn._instance;

    var dependencies = (fn._inject || []).map(function (dep) {
      return resolve(dep);
    });
    var result = core._classes[id] ? new (_bind.apply(fn, [null].concat(_toConsumableArray(dependencies))))() : fn.apply(undefined, _toConsumableArray(dependencies));

    if (core._singletons[id]) {
      fn._instance = result;
    }

    return result;
  }

  function register(id, asset) {
    var _registry = core._registry;

    if (!isUndefined(_registry[id])) {
      throw new Error('asset: ' + id + ' is already registered.');
    }

    _registry[id] = asset;
  }

  function merge(namespace, target, core) {

    var properties = ['_registry', '_singletons', '_values'];

    properties.forEach(function (property) {
      Object.keys(core[property]).reduce(function (target, key) {
        target[property][namespace + key] = core[property][key];
        return target;
      }, target);
    });

    return target;
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
