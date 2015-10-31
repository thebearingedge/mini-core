
'use strict';

export default function miniCore(constants) {

  const resolving = {};
  const resolved = [];

  const core = {

    _parent: null,

    _started: false,

    _providers: {},

    _configQueue: [],

    _providerQueue: [],

    _runQueue: [],

    _children: [],

    _injector: {
      has: id => core.has(id),
      get: id => core.get(id),
      invoke
    },

    has(id) {
      return !isUndefined(findProvider(id));
    },

    provide(id, fn) {
      id.endsWith('Provider') || (id += 'Provider');
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

    factory(id, fn, options = {}) {
      assertNotRegistered(id);
      fn._inject || (fn._inject = options.inject || []);
      this._providers[id] = null;
      this._providerQueue.push(factoryProvider(id, fn, options));
      return this;
    },

    class(id, Class, options = {}) {
      Class._inject || (Class._inject = options.inject || []);
      options.withNew = true;
      return this.factory(id, Class, options);
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

    config(fn, options = {}) {
      fn._inject || (fn._inject = options.inject || []);
      this._configQueue.push(fn);
      return this;
    },

    run(fn, options = {}) {
      fn._inject || (fn._inject = options.inject || []);
      this._runQueue.push(fn);
      return this;
    },

    createChild() {
      const core = miniCore(...arguments);
      core._parent = this;
      this._children.push(core);
      return core;
    },

    bootstrap(fn) {
      let root = this;
      while (root._parent && !root._parent._started) {
        root = root._parent;
      }
      root._bootstrap();
      if (fn) invoke(fn);
    },

    _bootstrap() {
      this._configure();
      this._children.forEach(child => child._configure());
      this._flushProviderQueue();
      this._children.forEach(child => child._flushProviderQueue());
      this._flushRunQueue();
      this._children.forEach(child => child._flushRunQueue());
    },

    _configure() {
      const { _configQueue } = this;
      while (_configQueue.length) {
        configure(_configQueue.shift());
      }
    },

    _flushProviderQueue() {
      const { _providerQueue, _providers } = this;
      while (_providerQueue.length) {
        const provider = _providerQueue.shift();
        _providers[provider.id] = provider;
      }
    },

    _flushRunQueue() {
      const { _runQueue } = this;
      while (_runQueue.length) {
        invoke(_runQueue.shift());
      }
      this._started = true;
    }

  };

  return core.constant(constants || {});

  function assertNotRegistered(id) {
    if (!isUndefined(core._providers[id])) {
      throw new MiniCoreError(`"${id}" has already been registered`);
    }
  }

  function invoke(fn, options = { withNew: false }) {
    const Fn = fn;
    const deps = (fn._inject || []).map(id => core.get(id));
    return options.withNew ? new Fn(...deps) : fn(...deps);
  }

  function valueProvider(id, val) {
    return { id, _get: () => val };
  }

  function factoryProvider(id, fn, options) {
    const { cache, withNew } = options;
    return {
      id,
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

  function configure(config) {
    const deps = config._inject.map(id => {
      const provider = findProvider(id, core);
      if (!provider) {
        const message = `"config" dependency "${id}" not found or illegal`;
        throw new MiniCoreError(message);
      }
      return id.endsWith('Provider') ? provider : provider._get();
    });
    config(...deps);
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
