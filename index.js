
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
        throw new InvalidParameterError('constant', Array.from(arguments));
      }
      return this;
    },

    _injector: {
      get: id => core.get(id),
      has: id => core.has(id),
      resolve,
      invoke
    },

    get(id) {
      if (resolving[id]) {
        const cycle = resolved.concat(id);
        throw new MiniCoreError(`Cyclic dependency "${cycle.join(' -> ')}"`);
      }
      resolving[id] = true;
      resolved.push(id);
      const provider = findProvider(id, this);
      if (!provider) {
        throw new MiniCoreError(`Dependency "${id}" not found`);
      }
      const result = provider._get();
      resolving[id] = false;
      resolved.splice(0);
      return result;
    },

    has(id) {
      return !isUndefined(findProvider(id, this));
    },

    provide(id, fn) {
      if (!isProvider(id)) {
        id += 'Provider';
      }
      assertNotRegistered(id);
      const { _providers, _injector } = this;
      const provider = fn(_injector);
      if (!isFunction(provider._get)) {
        throw new MiniCoreError(`"${id}" needs a "_get" method`);
      }
      provider.id = id;
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
        throw new InvalidParameterError('value', Array.from(arguments));
      }
      return this;
    },

    factory(id, fn, options = {}) {
      assertNotRegistered(id);
      if (!isFunction(fn)) {
        throw new InvalidParameterError('factory', Array.from(arguments));
      }
      this._providers[id] = null;
      this._providerQueue.push(factoryProvider(id, fn, options));
      return this;
    },

    class(id, Class, options = {}) {
      assertNotRegistered(id);
      if (!isFunction(Class)) {
        throw new InvalidParameterError('class', Array.from(arguments));
      }
      this._providers[id] = null;
      this._providerQueue.push(classProvider(id, Class, options));
      return this;
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
      const {
        _configQueue, _providers, _providerQueue, _runQueue, _children
      } = this;
      while (_configQueue.length) {
        const config = _configQueue.shift();
        const dependencies = (config._inject || []).map(id => {
          const provider = findProvider(id, this);
          if (!provider) {
            const message = `"config" dependency "${id}" not found or illegal`;
            throw new MiniCoreError(message);
          }
          return isProvider(id)
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
    const Fn = fn;
    const dependencies = resolve(fn._inject);
    return asNew ? new Fn(...dependencies) : fn(...dependencies);
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
  constructor(message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.message = `[MiniCoreError] ${message}`;
  }
}

class InvalidParameterError extends MiniCoreError {
  constructor(method, params) {
    const args = params.map(arg => toString(arg));
    super(`Invalid parameters (${args.join(', ')}) for ${method} "${args[0]}"`);
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

function isNull(value) {
  return value === null;
}

function toString(value) {
  if (isNull(value)) return 'null';
  if (isUndefined(value)) return 'undefined';
  if (value.toString) return value.toString();
  return '';
}

function findProvider(id, core) {
  let provider = null;
  while (core && !provider) {
    provider = core._providers[`${id}Provider`] || core._providers[id];
    core = core._parent;
  }
  return provider;
}

function isProvider(id) {
  return id.slice(id.length - 8) === 'Provider';
}
