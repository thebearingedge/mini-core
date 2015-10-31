
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var _bind = Function.prototype.bind;

var _get2 = function get(_x6, _x7, _x8) { var _again = true; _function: while (_again) { var object = _x6, property = _x7, receiver = _x8; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x6 = parent; _x7 = property; _x8 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

exports['default'] = miniCore;

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function miniCore(constants) {

  var resolving = {};
  var resolved = [];

  var core = {

    _parent: null,

    _started: false,

    _providers: {},

    _configQueue: [],

    _providerQueue: [],

    _runQueue: [],

    _children: [],

    _injector: {
      has: function has(id) {
        return core.has(id);
      },
      get: function get(id) {
        return core.get(id);
      },
      invoke: invoke
    },

    has: function has(id) {
      return !isUndefined(findProvider(id));
    },

    provide: function provide(id, fn) {
      id.endsWith('Provider') || (id += 'Provider');
      assertNotRegistered(id);
      var _providers = this._providers;
      var _injector = this._injector;

      var provider = fn(_injector);
      if (!isFunction(provider._get)) {
        throw new MiniCoreError('"' + id + '" needs a "_get" method');
      }
      provider.id = id;
      _providers[id] = provider;
      return this;
    },

    constant: function constant(id, val) {
      var _this = this;

      if (isObject(id)) {
        Object.keys(id).forEach(function (key) {
          return _this.constant(key, id[key]);
        });
      } else {
        assertNotRegistered(id);
        this._providers[id] = valueProvider(id, val);
      }
      return this;
    },

    value: function value(id, val) {
      var _this2 = this;

      if (isObject(id)) {
        Object.keys(id).forEach(function (key) {
          return _this2.value(key, id[key]);
        });
      } else {
        assertNotRegistered(id);
        this._providers[id] = null;
        this._providerQueue.push(valueProvider(id, val));
      }
      return this;
    },

    factory: function factory(id, fn) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      assertNotRegistered(id);
      fn._inject || (fn._inject = options.inject || []);
      this._providers[id] = null;
      this._providerQueue.push(factoryProvider(id, fn, options));
      return this;
    },

    'class': function _class(id, Class) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      Class._inject || (Class._inject = options.inject || []);
      options.withNew = true;
      return this.factory(id, Class, options);
    },

    get: function get(id) {
      if (resolving[id]) {
        var cycle = resolved.concat(id);
        throw new MiniCoreError('Cyclic dependency "' + cycle.join(' -> ') + '"');
      }
      resolving[id] = true;
      resolved.push(id);
      var provider = findProvider(id, this);
      if (!provider) {
        throw new MiniCoreError('Dependency "' + id + '" not found');
      }
      var result = provider._get();
      resolving[id] = false;
      resolved.splice(0);
      return result;
    },

    config: function config(fn) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      fn._inject || (fn._inject = options.inject || []);
      this._configQueue.push(fn);
      return this;
    },

    run: function run(fn) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      fn._inject || (fn._inject = options.inject || []);
      this._runQueue.push(fn);
      return this;
    },

    createChild: function createChild() {
      var core = miniCore.apply(undefined, arguments);
      core._parent = this;
      this._children.push(core);
      return core;
    },

    bootstrap: function bootstrap(fn) {
      var root = this;
      while (root._parent && !root._parent._started) {
        root = root._parent;
      }
      root._bootstrap();
      if (fn) invoke(fn);
    },

    _bootstrap: function _bootstrap() {
      this._configure();
      this._children.forEach(function (child) {
        return child._configure();
      });
      this._flushProviderQueue();
      this._children.forEach(function (child) {
        return child._flushProviderQueue();
      });
      this._flushRunQueue();
      this._children.forEach(function (child) {
        return child._flushRunQueue();
      });
    },

    _configure: function _configure() {
      var _configQueue = this._configQueue;

      while (_configQueue.length) {
        configure(_configQueue.shift());
      }
    },

    _flushProviderQueue: function _flushProviderQueue() {
      var _providerQueue = this._providerQueue;
      var _providers = this._providers;

      while (_providerQueue.length) {
        var provider = _providerQueue.shift();
        _providers[provider.id] = provider;
      }
    },

    _flushRunQueue: function _flushRunQueue() {
      var _runQueue = this._runQueue;

      while (_runQueue.length) {
        invoke(_runQueue.shift());
      }
      this._started = true;
    }

  };

  return core.constant(constants || {});

  function assertNotRegistered(id) {
    if (!isUndefined(core._providers[id])) {
      throw new MiniCoreError('"' + id + '" has already been registered');
    }
  }

  function invoke(fn) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? { withNew: false } : arguments[1];

    var Fn = fn;
    var deps = (fn._inject || []).map(function (id) {
      return core.get(id);
    });
    return options.withNew ? new (_bind.apply(Fn, [null].concat(_toConsumableArray(deps))))() : fn.apply(undefined, _toConsumableArray(deps));
  }

  function valueProvider(id, val) {
    return { id: id, _get: function _get() {
        return val;
      } };
  }

  function factoryProvider(id, fn, options) {
    var cache = options.cache;
    var withNew = options.withNew;

    return {
      id: id,
      _cache: null,
      _get: function _get() {
        if (this._cache) return this._cache;
        var result = invoke(fn, { withNew: withNew });
        return cache ? this._cache = result : result;
      }
    };
  }

  function findProvider(id) {
    var host = core;
    var provider = null;
    while (host && !provider) {
      provider = host._providers[id + 'Provider'] || host._providers[id];
      host = host._parent;
    }
    return provider;
  }

  function configure(config) {
    var deps = config._inject.map(function (id) {
      var provider = findProvider(id, core);
      if (!provider) {
        var message = '"config" dependency "' + id + '" not found or illegal';
        throw new MiniCoreError(message);
      }
      return id.endsWith('Provider') ? provider : provider._get();
    });
    config.apply(undefined, _toConsumableArray(deps));
  }
}

var MiniCoreError = (function (_Error) {
  _inherits(MiniCoreError, _Error);

  function MiniCoreError(message) {
    _classCallCheck(this, MiniCoreError);

    _get2(Object.getPrototypeOf(MiniCoreError.prototype), 'constructor', this).call(this, message);
    Error.captureStackTrace(this, this.constructor);
    this.message = '[MiniCoreError] ' + message;
  }

  return MiniCoreError;
})(Error);

function isUndefined(value) {
  return typeof value === 'undefined';
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFunction(value) {
  return typeof value === 'function';
}
module.exports = exports['default'];
