
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = miniCore;

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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
      var _ref = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var _ref$inject = _ref.inject;
      var inject = _ref$inject === undefined ? [] : _ref$inject;

      assertNotRegistered(id);
      var _id = id.endsWith('Provider') ? id : id + 'Provider';
      var provider = this.invoke(fn, { inject: inject });
      if (!isFunction(provider._get)) {
        throw new MiniCoreError('"' + _id + '" needs a "_get" method');
      }
      var _inject = provider._get._inject || [];
      var _get = provider._get.bind(provider);
      _get._inject = _inject;
      Object.assign(provider, { _id: _id, _get: _get });
      Object.assign(this._providers, _defineProperty({}, _id, provider));
      return this;
    },
    invoke: function invoke(fn) {
      var _this = this;

      var _ref2 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var _ref2$withNew = _ref2.withNew;
      var withNew = _ref2$withNew === undefined ? false : _ref2$withNew;
      var _ref2$inject = _ref2.inject;
      var inject = _ref2$inject === undefined ? [] : _ref2$inject;

      inject = fn._inject || inject;
      var Fn = fn;
      var deps = inject.map(function (id) {
        return _this.get(id);
      });
      return withNew ? new (Function.prototype.bind.apply(Fn, [null].concat(_toConsumableArray(deps))))() : fn.apply(undefined, _toConsumableArray(deps));
    },
    constant: function constant(id, val) {
      var _this2 = this;

      if (isObject(id)) {
        Object.keys(id).forEach(function (key) {
          return _this2.constant(key, id[key]);
        });
      } else if (isString(id)) {
        assertNotRegistered(id);
        this._providers[id] = valueProvider(id, val);
      } else {
        var message = 'Invalid "constant" arguments: (' + id + ', ' + val + ')';
        throw new MiniCoreError(message);
      }
      return this;
    },
    value: function value(id, val) {
      var _this3 = this;

      if (isObject(id)) {
        Object.keys(id).forEach(function (key) {
          return _this3.value(key, id[key]);
        });
      } else if (isString(id)) {
        assertNotRegistered(id);
        this._providers[id] = null;
        this._providerQueue.push(valueProvider(id, val));
      } else {
        var message = 'Invalid "value" arguments: (' + id + ', ' + val + ')';
        throw new MiniCoreError(message);
      }
      return this;
    },
    factory: function factory(id, fn) {
      var _ref3 = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var _ref3$inject = _ref3.inject;
      var inject = _ref3$inject === undefined ? [] : _ref3$inject;
      var _ref3$withNew = _ref3.withNew;
      var withNew = _ref3$withNew === undefined ? false : _ref3$withNew;
      var _ref3$cache = _ref3.cache;
      var cache = _ref3$cache === undefined ? false : _ref3$cache;

      assertNotRegistered(id);
      fn._inject = fn._inject || inject;
      this._providers[id] = null;
      this._providerQueue.push(factoryProvider(id, fn, { withNew: withNew, cache: cache }));
      return this;
    },
    class: function _class(id, Fn) {
      var _ref4 = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var _ref4$inject = _ref4.inject;
      var inject = _ref4$inject === undefined ? [] : _ref4$inject;
      var _ref4$cache = _ref4.cache;
      var cache = _ref4$cache === undefined ? false : _ref4$cache;

      var withNew = true;
      return this.factory(id, Fn, { inject: inject, withNew: withNew, cache: cache });
    },
    wrap: function wrap(fn) {
      var _ref5 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var _ref5$inject = _ref5.inject;
      var inject = _ref5$inject === undefined ? [] : _ref5$inject;
      var _ref5$withNew = _ref5.withNew;
      var withNew = _ref5$withNew === undefined ? false : _ref5$withNew;

      inject = fn._inject || inject;
      var deps = function deps() {
        return inject.map(function (id) {
          return core.get(id);
        });
      };
      var wrapped = withNew ? (function (_fn) {
        _inherits(Wrapped, _fn);

        function Wrapped() {
          var _Object$getPrototypeO, _deps;

          _classCallCheck(this, Wrapped);

          return _possibleConstructorReturn(this, (_Object$getPrototypeO = Object.getPrototypeOf(Wrapped)).call.apply(_Object$getPrototypeO, [this].concat(_toConsumableArray((_deps = deps()).concat.apply(_deps, arguments)))));
        }

        return Wrapped;
      })(fn) : function wrapped() {
        var _deps2;

        return fn.apply(undefined, _toConsumableArray((_deps2 = deps()).concat.apply(_deps2, arguments)));
      };
      return Object.defineProperty(wrapped, 'name', {
        writable: false,
        enumerable: false,
        configurable: true,
        value: fn.name
      });
    },
    get: function get(id) {
      if (resolving[id]) {
        var cycle = resolved.concat(id);
        resolving = {};
        resolved.splice(0);
        throw new MiniCoreError('Cyclic dependency "' + cycle.join(' -> ') + '"');
      }
      resolving[id] = true;
      var provider = findProvider(id, this);
      if (!provider) {
        resolving = {};
        resolved.splice(0);
        throw new MiniCoreError('Dependency "' + id + '" not found');
      }
      resolved.push(id);
      var result = this.invoke(provider._get);
      resolving[id] = false;
      resolved.splice(0);
      return result;
    },
    config: function config(fn) {
      var _ref6 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var _ref6$inject = _ref6.inject;
      var inject = _ref6$inject === undefined ? [] : _ref6$inject;

      fn._inject = fn._inject || inject;
      this._configQueue.push(fn);
      return this;
    },
    run: function run(fn) {
      var _ref7 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var _ref7$inject = _ref7.inject;
      var inject = _ref7$inject === undefined ? [] : _ref7$inject;

      fn._inject = fn._inject || inject;
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
      var _ref8 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var _ref8$inject = _ref8.inject;
      var inject = _ref8$inject === undefined ? [] : _ref8$inject;

      var root = this;
      while (root._parent && !root._parent._started) {
        root = root._parent;
      }root._bootstrap();
      var withNew = false;
      if (fn) this.invoke(fn, { withNew: withNew, inject: inject });
      return this;
    },
    _bootstrap: function _bootstrap() {
      this._configure();
      this._flushProviderQueue();
      this._flushRunQueue();
    },
    _configure: function _configure() {
      var _configQueue = this._configQueue;
      var _children = this._children;

      while (_configQueue.length) {
        configure(_configQueue.shift());
      }_children.forEach(function (child) {
        return child._configure();
      });
    },
    _flushProviderQueue: function _flushProviderQueue() {
      var _providerQueue = this._providerQueue;
      var _providers = this._providers;
      var _children = this._children;

      while (_providerQueue.length) {
        var provider = _providerQueue.shift();
        _providers[provider._id] = provider;
      }
      _children.forEach(function (child) {
        return child._flushProviderQueue();
      });
    },
    _flushRunQueue: function _flushRunQueue() {
      var _runQueue = this._runQueue;
      var _children = this._children;

      while (_runQueue.length) {
        this.invoke(_runQueue.shift());
      }this._started = true;
      _children.forEach(function (child) {
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

    var _this5 = _possibleConstructorReturn(this, Object.getPrototypeOf(MiniCoreError).call(this));

    Error.captureStackTrace(_this5, _this5.constructor);
    _this5.message = '[MiniCoreError] ' + message;
    return _this5;
  }

  return MiniCoreError;
})(Error);

function isUndefined(value) {
  return typeof value === 'undefined';
}

function isObject(value) {
  return (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object' && !!value && !Array.isArray(value);
}

function isString(value) {
  return typeof value === 'string';
}

function isFunction(value) {
  return typeof value === 'function';
}
