
'use strict';

export default function miniCore(constants) {

  const resolving = {};
  const resolved = [];

  const core = {

    _started: false,

    _parent: null,

    _children: [],

    _providers: {},

    _configQueue: [],

    _providerQueue: [],

    _runQueue: [],

    _injector: {
      has: id => core.has(id),
      get: id => core.get(id),
      invoke
    },

    has(id) {
      return !isUndefined(findProvider(id));
    },

    provide(id, fn) {
      assertNotRegistered(id);
      id.endsWith('Provider') || (id += 'Provider');
      const provider = fn(this._injector);
      if (!isFunction(provider._get)) {
        throw new MiniCoreError(`"${id}" needs a "_get" method`);
      }
      provider._id = id;
      this._providers[id] = provider;
      return this;
    },

    constant(id, val) {
      if (isObject(id)) {
        Object.keys(id).forEach(key => this.constant(key, id[key]));
      }
      else {
        assertNotRegistered(id);
        this._providers[id] = valueProvider(id, val);
      }
      return this;
    },

    value(id, val) {
      if (isObject(id)) {
        Object.keys(id).forEach(key => this.value(key, id[key]));
      }
      else {
        assertNotRegistered(id);
        this._providers[id] = null;
        this._providerQueue.push(valueProvider(id, val));
      }
      return this;
    },

    factory(id, fn, options = { inject: [], withNew: false, cache: false }) {
      assertNotRegistered(id);
      fn._inject || (fn._inject = options.inject);
      this._providers[id] = null;
      this._providerQueue.push(factoryProvider(id, fn, options));
      return this;
    },

    class(id, Fn, options = {}) {
      options.withNew = true;
      return this.factory(id, Fn, options);
    },

    get(id) {
      if (resolving[id]) {
        const cycle = resolved.concat(id);
        throw new MiniCoreError(`Cyclic dependency "${cycle.join(' -> ')}"`);
      }
      resolving[id] = true;
      const provider = findProvider(id, this);
      if (!provider) {
        throw new MiniCoreError(`Dependency "${id}" not found`);
      }
      resolved.push(id);
      const result = provider._get();
      resolving[id] = false;
      resolved.splice(0);
      return result;
    },

    config(fn, options = { inject: [] }) {
      fn._inject || (fn._inject = options.inject);
      this._configQueue.push(fn);
      return this;
    },

    run(fn, options = { inject: [] }) {
      fn._inject || (fn._inject = options.inject);
      this._runQueue.push(fn);
      return this;
    },

    createChild() {
      const core = miniCore(...arguments);
      core._parent = this;
      this._children.push(core);
      return core;
    },

    bootstrap(fn, options = { inject: [] }) {
      let root = this;
      while (root._parent && !root._parent._started) {
        root = root._parent;
      }
      root._bootstrap();
      options.withNew = false;
      if (fn) invoke(fn, options);
      return this;
    },

    _bootstrap() {
      this._configure();
      this._flushProviderQueue();
      this._flushRunQueue();
    },

    _configure() {
      while (this._configQueue.length) {
        configure(this._configQueue.shift());
      }
      this._children.forEach(child => child._configure());
    },

    _flushProviderQueue() {
      while (this._providerQueue.length) {
        const provider = this._providerQueue.shift();
        this._providers[provider._id] = provider;
      }
      this._children.forEach(child => child._flushProviderQueue());
    },

    _flushRunQueue() {
      while (this._runQueue.length) {
        invoke(this._runQueue.shift());
      }
      this._started = true;
      this._children.forEach(child => child._flushRunQueue());
    }

  };

  return core.constant(constants || {});

  function assertNotRegistered(id) {
    if (!isUndefined(core._providers[id])) {
      throw new MiniCoreError(`"${id}" has already been registered`);
    }
  }

  function invoke(fn, options = { withNew: false, inject: [] }) {
    const Fn = fn;
    const deps = (fn._inject || options.inject || []).map(id => core.get(id));
    return options.withNew ? new Fn(...deps) : fn(...deps);
  }

  function valueProvider(id, val) {
    return { _id: id, _get: () => val };
  }

  function factoryProvider(id, fn, options) {
    const { cache, withNew } = options;
    return {
      _id: id,
      _cache: null,
      _get() {
        if (this._cache) return this._cache;
        const result = invoke(fn, { withNew });
        return cache ? (this._cache = result) : result;
      }
    };
  }

  function findProvider(id) {
    let host = core;
    let provider = null;
    while (host && !provider) {
      provider = host._providers[`${id}Provider`] || host._providers[id];
      host = host._parent;
    }
    return provider;
  }

  function configure(configFn) {
    const deps = configFn._inject.map(id => {
      const provider = findProvider(id, core);
      if (!provider) {
        const message = `"config" dependency "${id}" not found or illegal`;
        throw new MiniCoreError(message);
      }
      return provider._id.endsWith('Provider') ? provider : provider._get();
    });
    configFn(...deps);
  }

}

class MiniCoreError extends Error {
  constructor(message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.message = `[MiniCoreError] ${message}`;
  }
}

function isUndefined(value) {
  return typeof value === 'undefined';
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFunction(value) {
  return typeof value === 'function';
}
