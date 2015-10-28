
'use strict';

export default function miniCore(constants) {

  const resolving = {};
  const resolved = [];

  const core = {

    MiniCoreError,

    _parent: null,

    _running: false,

    _providers: {},

    _providerQueue: [],

    _configQueue: [],

    _runQueue: [],

    _children: [],

    constant(id, val) {
      if (isObject(id)) {
        const obj = id;
        Object.keys(obj).forEach(key => this.constant(key, obj[key]));
      }
      else if (isString(id)) {
        assertNotRegistered(id);
        this._providers[id] = valueProvider(id, val);
      }
      else {
        const args = Array.from(arguments);
        throw new MiniCoreError(`Invalid "constant" parameters "${args}"`);
      }
      return this;
    },

    _injector: {
      has(id) {
        return core.has(id);
      },
      get(id) {
        return core.get(id);
      },
      resolve,
      invoke
    },

    get(id) {
      if (resolving[id]) {
        const cycle = resolved.concat(id);
        throw new MiniCoreError(`Cyclic dependency: ${cycle.join(' -> ')}`);
      }
      resolving[id] = true;
      resolved.push(id);
      const provider = findProvider(id, this);
      const result = provider._get();
      resolving[id] = false;
      resolved.splice(0);
      return result;
    },

    has(id) {
      let provider = this._providers[id];
      let core = this;
      while (isUndefined(provider) && core) {
        core = core._parent;
        provider = core._providers[id];
      }
      return !isUndefined(provider);
    },

    provide(id, fn) {
      assertNotRegistered(id);
      const { _providers, _injector } = this;
      const provider = fn(_injector);
      if (!isFunction(provider._get)) {
        throw new MiniCoreError(`Provider "${id}" needs a "_get" method`);
      }
      _providers[id] = provider;
      return this;
    },

    value(id, val) {
      if (isObject(id)) {
        const obj = id;
        Object.keys(obj).forEach(key => this.value(key, obj[key]));
      }
      else if (isString(id)) {
        assertNotRegistered(id);
        this._providers[id] = null;
        this._providerQueue.push(valueProvider(id, val));
      }
      else {
        const args = Array.from(arguments);
        throw new MiniCoreError(`Invalid "value" parameters "${args}"`);
      }
      return this;
    },

    factory(id, fn, options = {}) {
      assertNotRegistered(id);
      if (!isFunction(fn)) {
        const args = Array.from(arguments);
        throw new MiniCoreError(`Invalid "factory" parameters "${args}"`);
      }
      this._providers[id] = null;
      this._providerQueue.push(factoryProvider(id, fn, options));
      return this;
    },

    class(id, Class, options = {}) {
      assertNotRegistered(id);
      if (!isFunction(Class)) {
        const args = Array.from(arguments);
        throw new MiniCoreError(`Invalid "class" parameters "${args}"`);
      }
      this._providers[id] = null;
      this._providerQueue.push(classProvider(id, Class, options));
      return this;
    },

    bindFactory(id, fn) {
      assertNotRegistered(id);
      function bound() {
        const dependencies = resolve(fn._inject);
        const args = dependencies.concat(...arguments);
        return fn(...args);
      }
      copyName(bound, fn);
      return this.value(id, bound);
    },

    bindClass(id, Class) {
      assertNotRegistered(id);
      class Bound extends Class {
        constructor() {
          const dependencies = resolve(Class._inject);
          const args = dependencies.concat(...arguments);
          super(...args);
        }
      }
      copyName(Bound, Class);
      return this.value(id, Bound);
    },

    install(child) {
      child._parent = this;
      this._children.push(child);
      return this;
    },

    config(fn) {
      this._configQueue.push(fn);
      return this;
    },

    run(fn) {
      this._runQueue.push(fn);
      return this;
    },

    bootstrap(fn) {
      let root = this;
      while (root._parent && !root._parent._running) {
        root = root._parent;
      }
      root._bootstrap();
      fn && invoke(fn); // jshint ignore: line
    },

    _bootstrap() {
      const [
        _configQueue, _providers, _providerQueue,
        _runQueue, _children
      ] = this;
      while (_configQueue.length) {
        const config = _configQueue.shift();
        const dependencies = (config._inject || []).map(id => {
        const provider = findProvider(id, this);
          return id.slice(id.length - 8) === 'Provider'
            ? provider
            : provider._get();
        });
        config(...dependencies);
      }
      while (_providerQueue.length) {
        const provider = _providerQueue.shift();
        _providers[provider.id] = provider;
      }
      while (_runQueue.length) {
        invoke(_runQueue.shift());
      }
      _children.forEach(child => child._bootstrap());
      this._running = true;
    }

  };

  return core.constant(constants || {});


  function assertNotRegistered(id) {
    if (!isUndefined(core._providers[id])) {
      throw new MiniCoreError(`"${id}" has already been registered`);
    }
  }

  function resolve(dependencies = []) {
    return dependencies.map(id => core.get(id));
  }

  function invoke(fn, asNew = false) {
    const dependencies = resolve(fn._inject);
    return asNew
      ? new fn(...dependencies) // jshint ignore: line
      : fn(...dependencies);
  }

  function valueProvider(id, val) {
    return {
      id,
      _get() { return val; }
    };
  }

  function factoryProvider(id, fn, options) {
    return {
      id,
      _cache: null,
      _get() {
        if (this._cache) return this._cache;
        const result = invoke(fn);
        return options.cache ? (this._cache = result) : result;
      }
    };
  }

  function classProvider(id, Class, options) {
    return {
      id,
      _cache: null,
      _get() {
        if (core._cache) return core._cache;
        const instance = invoke(Class, true);
        return options.cache
          ? (core._cache = instance)
          : instance;
      }
    };
  }

}

class MiniCoreError extends Error {
  constructor() {
    super(...arguments);
    this.message = arguments[0];
  }
}

function isUndefined(value) {
  return typeof value === 'undefined';
}

function isString(value) {
  return typeof value === 'string';
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFunction(value) {
  return typeof value === 'function';
}

function copyName(to, from) {
  Object.defineProperty(to, 'name', {
    enumerable: false,
    writeable: false,
    configurable: true,
    value: from.name
  });
}

function findProvider(id, core) {
  let provider = null;
  while (core && !provider) {
    provider = core._providers[`${id}Provider`] || core._providers[id];
    core = core._parent;
  }
  if (!provider) {
    throw new MiniCoreError(`Dependency "${id}" not found`);
  }
  return provider;
}
