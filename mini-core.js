
'use strict'

export default function miniCore(constants) {

  let resolving = {}
  const resolved = []

  const core = {

    _started: false,

    _parent: null,

    _children: [],

    _providers: {},

    _configQueue: [],

    _providerQueue: [],

    _runQueue: [],

    has(id) {
      return !isUndefined(findProvider(id))
    },

    provide(id, fn, { inject = [] } = {}) {
      assertNotRegistered(id)
      const _id = id.endsWith('Provider') ? id : id + 'Provider'
      const provider = this.invoke(fn, { inject })
      if (!isFunction(provider._get)) {
        throw new MiniCoreError(`"${_id}" needs a "_get" method`)
      }
      const _inject = provider._get._inject || []
      const _get = provider._get.bind(provider)
      _get._inject = _inject
      Object.assign(provider, { _id, _get })
      Object.assign(this._providers, { [_id]: provider })
      return this
    },

    invoke(fn, { withNew = false, inject = [] } = {}) {
      inject = fn._inject || inject
      const Fn = fn
      const deps = inject.map(id => this.get(id))
      return withNew ? new Fn(...deps) : fn(...deps)
    },

    constant(id, val) {
      if (isObject(id)) {
        Object.keys(id).forEach(key => this.constant(key, id[key]))
      }
      else if (isString(id)) {
        assertNotRegistered(id)
        this._providers[id] = valueProvider(id, val)
      }
      else {
        const message = `Invalid "constant" arguments: (${id}, ${val})`
        throw new MiniCoreError(message)
      }
      return this;
    },

    value(id, val) {
      if (isObject(id)) {
        Object.keys(id).forEach(key => this.value(key, id[key]))
      }
      else if (isString(id)) {
        assertNotRegistered(id)
        this._providers[id] = null
        this._providerQueue.push(valueProvider(id, val))
      }
      else {
        const message = `Invalid "value" arguments: (${id}, ${val})`
        throw new MiniCoreError(message)
      }
      return this;
    },

    factory(id, fn, { inject = [], withNew = false, cache = false } = {}) {
      assertNotRegistered(id)
      fn._inject = fn._inject || inject
      this._providers[id] = null
      this._providerQueue.push(factoryProvider(id, fn, { withNew, cache }))
      return this
    },

    class(id, Fn, { inject = [], cache = false } = {}) {
      const withNew = true
      return this.factory(id, Fn, { inject, withNew, cache })
    },

    wrap(fn, { inject = [], withNew = false } = {}) {
      inject = fn._inject || inject
      const deps = () => inject.map(id => core.get(id))
      const wrapped = withNew
        ? class Wrapped extends fn {
            constructor() {
              super(...(deps().concat(...arguments)))
            }
          }
        : function wrapped() {
            return fn(...(deps().concat(...arguments)))
          };
      return Object
        .defineProperty(wrapped, 'name', {
          writable: false,
          enumerable: false,
          configurable: true,
          value: fn.name
        });
    },

    get(id) {
      if (resolving[id]) {
        const cycle = resolved.concat(id)
        resolving = {}
        resolved.splice(0)
        throw new MiniCoreError(`Cyclic dependency "${cycle.join(' -> ')}"`)
      }
      resolving[id] = true
      const provider = findProvider(id, this)
      if (!provider) {
        resolving = {}
        resolved.splice(0)
        throw new MiniCoreError(`Dependency "${id}" not found`)
      }
      resolved.push(id);
      const result = this.invoke(provider._get)
      resolving[id] = false
      resolved.splice(0)
      return result
    },

    config(fn, { inject = [] } = {}) {
      fn._inject = fn._inject || inject
      this._configQueue.push(fn)
      return this
    },

    run(fn, { inject = [] } = {}) {
      fn._inject = fn._inject || inject
      this._runQueue.push(fn)
      return this
    },

    createChild() {
      const core = miniCore(...arguments)
      core._parent = this
      this._children.push(core)
      return core
    },

    bootstrap(fn, { inject = [] } = {}) {
      let root = this
      while (root._parent && !root._parent._started) root = root._parent
      root._bootstrap()
      const withNew = false
      if (fn) this.invoke(fn, { withNew, inject })
      return this
    },

    _bootstrap() {
      this._configure()
      this._flushProviderQueue()
      this._flushRunQueue()
    },

    _configure() {
      const { _configQueue, _children } = this
      while (_configQueue.length) configure(_configQueue.shift())
      _children.forEach(child => child._configure())
    },

    _flushProviderQueue() {
      const { _providerQueue, _providers, _children } = this
      while (_providerQueue.length) {
        const provider = _providerQueue.shift()
        _providers[provider._id] = provider
      }
      _children.forEach(child => child._flushProviderQueue())
    },

    _flushRunQueue() {
      const { _runQueue, _children } = this
      while (_runQueue.length) this.invoke(_runQueue.shift())
      this._started = true
      _children.forEach(child => child._flushRunQueue())
    }

  };

  return core
    .constant('injector', {
      wrap: (...args) => core.wrap(...args),
      invoke: (...args) => core.invoke(...args),
      has: id => core.has(id),
      get: id => core.get(id)
    })
    .constant(constants || {})

  function assertNotRegistered(id) {
    if (!isUndefined(core._providers[id])) {
      throw new MiniCoreError(`"${id}" has already been registered`)
    }
  }

  function valueProvider(id, val) {
    return { _id: id, _get: () => val }
  }

  function factoryProvider(id, fn, options) {
    const { cache, withNew } = options
    return {
      _id: id,
      _cache: null,
      _get() {
        if (this._cache) return this._cache
        const result = core.invoke(fn, { withNew })
        return cache ? (this._cache = result) : result
      }
    };
  }

  function findProvider(id) {
    let host = core
    let provider = null
    while (host && !provider) {
      provider = host._providers[`${id}Provider`] || host._providers[id]
      host = host._parent
    }
    return provider;
  }

  function configure(configFn) {
    const deps = configFn._inject.map(id => {
      const provider = findProvider(id, core)
      if (!provider) {
        const message = `"config" dependency "${id}" not found or illegal`
        throw new MiniCoreError(message)
      }
      return provider._id.endsWith('Provider')
        ? provider
        : core.invoke(provider._get)
    });
    configFn(...deps)
  }

}

class MiniCoreError extends Error {

  constructor(message) {
    super()
    Error.captureStackTrace(this, this.constructor)
    this.message = `[MiniCoreError] ${message}`
  }

}

function isUndefined(value) {
  return typeof value === 'undefined'
}

function isObject(value) {
  return typeof value === 'object' && !!value && !Array.isArray(value)
}

function isString(value) {
  return typeof value === 'string'
}

function isFunction(value) {
  return typeof value === 'function'
}
