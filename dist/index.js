
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var _bind = Function.prototype.bind;

var _get2 = function get(_x9, _x10, _x11) { var _again = true; _function: while (_again) { var object = _x9, property = _x10, receiver = _x11; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x9 = parent; _x10 = property; _x11 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

exports['default'] = miniCore;

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function miniCore(constants) {

  var resolving = {};
  var resolved = [];

  var core = {

    _started: false,

    _parent: null,

    _children: [],

    _providers: {},

    _configQueue: [],

    _providerQueue: [],

    _runQueue: [],

    has: function has(id) {
      return !isUndefined(findProvider(id));
    },

    provide: function provide(id, fn) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? { inject: [] } : arguments[2];

      assertNotRegistered(id);
      var _id = id.endsWith('Provider') ? id : id + 'Provider';
      var provider = this.invoke(fn, options);
      if (!isFunction(provider._get)) {
        throw new MiniCoreError('"' + _id + '" needs a "_get" method');
      }
      var _inject = provider._get._inject || [];
      var _get = provider._get.bind(provider);
      _get._inject = _inject;
      Object.assign(provider, { _id: _id, _get: _get });
      this._providers[_id] = provider;
      return this;
    },

    invoke: function invoke(fn) {
      var _this = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? { withNew: false, inject: [] } : arguments[1];

      var inject = fn._inject || options.inject || [];
      var Fn = fn;
      var deps = inject.map(function (id) {
        return _this.get(id);
      });
      return options.withNew ? new (_bind.apply(Fn, [null].concat(_toConsumableArray(deps))))() : fn.apply(undefined, _toConsumableArray(deps));
    },

    constant: function constant(id, val) {
      var _this2 = this;

      if (isObject(id)) {
        Object.keys(id).forEach(function (key) {
          return _this2.constant(key, id[key]);
        });
      } else {
        assertNotRegistered(id);
        this._providers[id] = valueProvider(id, val);
      }
      return this;
    },

    value: function value(id, val) {
      var _this3 = this;

      if (isObject(id)) {
        Object.keys(id).forEach(function (key) {
          return _this3.value(key, id[key]);
        });
      } else {
        assertNotRegistered(id);
        this._providers[id] = null;
        this._providerQueue.push(valueProvider(id, val));
      }
      return this;
    },

    factory: function factory(id, fn) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? { inject: [], withNew: false, cache: false } : arguments[2];

      assertNotRegistered(id);
      fn._inject || (fn._inject = options.inject);
      this._providers[id] = null;
      this._providerQueue.push(factoryProvider(id, fn, options));
      return this;
    },

    'class': function _class(id, Fn) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      options.withNew = true;
      return this.factory(id, Fn, options);
    },

    wrap: function wrap(fn) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? { inject: [], withNew: false } : arguments[1];

      var inject = fn._inject || options.inject || [];
      var wrapped = options.withNew ? (function (_fn) {
        _inherits(Wrapped, _fn);

        function Wrapped() {
          var _inject$map;

          _classCallCheck(this, Wrapped);

          var args = (_inject$map = inject.map(function (id) {
            return core.get(id);
          })).concat.apply(_inject$map, arguments);
          _get2(Object.getPrototypeOf(Wrapped.prototype), 'constructor', this).apply(this, args);
        }

        return Wrapped;
      })(fn) : function wrapped() {
        var _inject$map2;

        var args = (_inject$map2 = inject.map(function (id) {
          return core.get(id);
        })).concat.apply(_inject$map2, arguments);
        return fn.apply(undefined, _toConsumableArray(args));
      };
      Object.defineProperty(wrapped, 'name', {
        writable: false,
        enumerable: false,
        configurable: true,
        value: fn.name
      });
      return wrapped;
    },

    get: function get(id) {
      if (resolving[id]) {
        var cycle = resolved.concat(id);
        throw new MiniCoreError('Cyclic dependency "' + cycle.join(' -> ') + '"');
      }
      resolving[id] = true;
      var provider = findProvider(id, this);
      if (!provider) {
        throw new MiniCoreError('Dependency "' + id + '" not found');
      }
      resolved.push(id);
      var result = this.invoke(provider._get);
      resolving[id] = false;
      resolved.splice(0);
      return result;
    },

    config: function config(fn) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? { inject: [] } : arguments[1];

      fn._inject || (fn._inject = options.inject);
      this._configQueue.push(fn);
      return this;
    },

    run: function run(fn) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? { inject: [] } : arguments[1];

      fn._inject || (fn._inject = options.inject);
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
      var options = arguments.length <= 1 || arguments[1] === undefined ? { inject: [] } : arguments[1];

      var root = this;
      while (root._parent && !root._parent._started) {
        root = root._parent;
      }
      root._bootstrap();
      options.withNew = false;
      if (fn) this.invoke(fn, options);
      return this;
    },

    _bootstrap: function _bootstrap() {
      this._configure();
      this._flushProviderQueue();
      this._flushRunQueue();
    },

    _configure: function _configure() {
      while (this._configQueue.length) {
        configure(this._configQueue.shift());
      }
      this._children.forEach(function (child) {
        return child._configure();
      });
    },

    _flushProviderQueue: function _flushProviderQueue() {
      while (this._providerQueue.length) {
        var provider = this._providerQueue.shift();
        this._providers[provider._id] = provider;
      }
      this._children.forEach(function (child) {
        return child._flushProviderQueue();
      });
    },

    _flushRunQueue: function _flushRunQueue() {
      while (this._runQueue.length) {
        this.invoke(this._runQueue.shift());
      }
      this._started = true;
      this._children.forEach(function (child) {
        return child._flushRunQueue();
      });
    }

  };

  return core.constant('injector', {
    wrap: function wrap() {
      return core.wrap.apply(core, arguments);
    },
    invoke: function invoke() {
      return core.invoke.apply(core, arguments);
    },
    has: function has(id) {
      return core.has(id);
    },
    get: function get(id) {
      return core.get(id);
    }
  }).constant(constants || {});

  function assertNotRegistered(id) {
    if (!isUndefined(core._providers[id])) {
      throw new MiniCoreError('"' + id + '" has already been registered');
    }
  }

  function valueProvider(id, val) {
    return { _id: id, _get: function _get() {
        return val;
      } };
  }

  function factoryProvider(id, fn, options) {
    var cache = options.cache;
    var withNew = options.withNew;

    return {
      _id: id,
      _cache: null,
      _get: function _get() {
        if (this._cache) return this._cache;
        var result = core.invoke(fn, { withNew: withNew });
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

  function configure(configFn) {
    var deps = configFn._inject.map(function (id) {
      var provider = findProvider(id, core);
      if (!provider) {
        var message = '"config" dependency "' + id + '" not found or illegal';
        throw new MiniCoreError(message);
      }
      return provider._id.endsWith('Provider') ? provider : core.invoke(provider._get);
    });
    configFn.apply(undefined, _toConsumableArray(deps));
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
