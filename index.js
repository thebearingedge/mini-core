
'use strict';

export default function miniCore(assets) {

  const core = {

    _values: {},

    _singletons: {},

    _registry: {},

    _classes: {},

    resolve,

    install(id, fn) {

      this.value(id, invoke(null, fn));

      return this;
    },

    singleton(id, asset) {

      this._singletons[id] = this._classes[id] = true;
      register(id, asset);

      return this;
    },

    value(id, asset) {

      if (isObject(id)) {
        asset = id;
        Object
          .keys(asset)
          .forEach(id => this.value(id, asset[id]));
      }
      else if (isString(id)) {
        this._values[id] = true;
        register(id, asset);
      }
      else {
        throw new Error('"value" expects a string id and value or object');
      }

      return this;
    },

    factory(id, asset) {

      register(id, asset);

      return this;
    },

    class(id, Asset) {

      this._classes[id] = true;
      register(id, Asset);

      return this;
    },

    config(fn) {

      invoke(null, fn);

      return this;
    },

    use(namespace, core) {

      if (isString(namespace)) {
        namespace += '.';
      }
      else if (isObject(namespace)) {
        core = namespace;
        namespace = '';
      }
      else {
        throw new Error('"use" expects a namespace and core or core only');
      }

      return merge(namespace, this, core);
    },

    wrap(id, fn) {

      this.value(id, () => invoke(null, fn));

      return this;
    }

  };

  return core.value(assets || {});


  function resolve(id) {

    const { _registry, _values } = core;
    const registered = _registry[id];

    if (!registered) {
      throw new Error(`asset "${id}" is not registered.`);
    }

    if (_values[id]) return registered;

    return invoke(id, registered);
  }


  function invoke(id, fn) {

    if (fn._instance) return fn._instance;

    const dependencies = (fn._inject || []).map(dep => resolve(dep));
    const result = core._classes[id]
      ? new fn(...dependencies)
      : fn(...dependencies);

    if (core._singletons[id]) {
      fn._instance = result;
    }

    return result;
  }


  function register(id, asset) {

    const { _registry } = core;

    if (!isUndefined(_registry[id])) {
      throw new Error(`asset: ${id} is already registered.`);
    }

    _registry[id] = asset;
  }

  function merge(namespace, target, core) {

    const properties = ['_registry', '_singletons', '_values'];

    properties
      .forEach(property => {
        Object
          .keys(core[property])
          .reduce((target, key) => {
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
