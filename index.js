
'use strict';

export default function miniCore(assets) {

  const values = {};
  const singletons = {};
  const registry = {};

  const core = {

    resolve,

    install(id, fn) {

      this.value(id, invoke(null, fn));

      return this;
    },

    singleton(id, asset) {

      singletons[id] = true;
      register(id, asset);

      return this;
    },

    value(id, asset) {

      if (isString(id)) {
        values[id] = true;
      }
      else if (isObject(id)) {
        asset = id;
        Object
          .keys(asset)
          .forEach(id => this.value(id, asset[id]));
        return this;
      }
      else {
        throw new Error(`"value" expects a string id and value or object`);
      }

      register(id, asset);

      return this;
    },

    factory(id, asset) {

      register(id, asset);

      return this;
    },

    config(fn) {

      invoke(null, fn);

      return this;
    }

  };

  return core.value(assets || {});


  function resolve(id) {

    const registered = registry[id];

    if (!registered) {
      throw new Error(`asset "${id}" is not registered.`);
    }

    if (values[id]) return registered;

    return invoke(id, registered);
  }


  function invoke(id, fn) {

    if (fn._instance) return fn._instance;

    const dependencies = (fn._inject || []).map(dep => resolve(dep));
    const isSingleton = singletons[id];
    const result = isSingleton
      ? new fn(...dependencies)
      : fn(...dependencies);

    if (isSingleton) {
      fn._instance = result;
    }

    return result;
  }


  function register(id, asset) {

    if (!isUndefined(registry[id])) {
      throw new Error(`asset: ${id} is already registry.`);
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
