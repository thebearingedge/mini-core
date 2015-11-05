# mini-core
A Dependency Injection framework.

[![Build Status](https://travis-ci.org/thebearingedge/mini-core.svg?branch=master)](https://travis-ci.org/thebearingedge/mini-core) [![Coverage Status](https://coveralls.io/repos/thebearingedge/mini-core/badge.svg?branch=master&service=github)](https://coveralls.io/github/thebearingedge/mini-core?branch=master) [![Code Climate](https://codeclimate.com/github/thebearingedge/mini-core/badges/gpa.svg)](https://codeclimate.com/github/thebearingedge/mini-core)

## Intro
Modular code has good separation of concerns and explicit dependencies — dependencies that expose an API at the appropriate level of abstraction. But at some point an application has to be wired together. This can be accomplished via a `main` method that calls, instantiates, configures, and creates things to resolve a dependency graph into a running application. Within a small app a `main` method is the simplest and best approach. But for larger applications that need to share application-wide logic or configuration across multiple features, one or more `main` methods can become unwieldy. A DI/IoC container is handy for automating plumbing logic that more-or-less amounts to boilerplate.

DI/IoC tools can range from simple eager-loading service locator libraries to very sophisticated frameworks that rely heavily on project directory structure and configuration files. Mini Core tries to land in the middle by offering just enough functionality to cleanly manage dependency graphs while encroaching as little as possible on user code.

_Why **another** DI framework?_

I wanted Inversion of Control I could... control. Also see features...

## Features
- Lazy object creation
- Chainable, order-independent setup methods
- Minimal intrusion on application code
- Project structure agnostic
- No configuration files.

## Creation

A `core` object is created by calling `miniCore`. A set of [`constants`](#constantid-value-or-constantobject) may be passed during creation.
```javascript
import miniCore from 'mini-core';

const emptyCore = miniCore();
const loadedCore = miniCore({ foo: 'bar', baz: 'qux' });
```

## Registration API

#### `provide(id, fn, options)`
A `core` object is essentially a registry of `providers`. Providers are simple or configurable objects that define what gets injected into consumers. To register a `provider`, pass a unique string identifier and function to `core.provide`. The function passed must return an object with at least a `_get` method.
```javascript
core
  .provide('foo', () => ({ _get: () => 2 + 2 }))
  .get('foo'); // 4
```
Providers are largely an internal mechanism of Mini Core, but they can be useful for creating configurable dependencies. The above is a short introduction to them. More on providers later.

Options:
- `inject: Array[String], default []` an array of dependency identifiers. Given that they have been registered, the dependencies are resolved and passed to the function as arguments.

#### `constant(id, value)` or `constant(object)`
Static values can be registered to a `core` using `core.constant` by either passing a string identifier and value or a set of key/value pairs.
```javascript
core.constant('foo', 'bar');
// or
core.constant({ foo: 'bar' })
  
core.get('foo'); // "bar"
```

_But a `core` is a registry of providers?_

Correct. `core.constant('foo', 'bar')` creates and registers the following `provider`:
```javascript
{
  _id: 'foo',
  _get() {
    return 'bar';
  }
}
```

#### `value(id, value)` or `value(object)`
Very similar to `core.constant`, except that the `provider` created here is enqueued and inaccessible until _after_ the [configuration phase](#configuration-phase) of the `core` startup.

#### `factory(id, fn, options)`
A factory function can be registered to a `core` object with `core.factory`. Dependents on this factory will be injected with its return value. 
```javascript
core
  .factory('foo', () => ({ bar: 'baz' }), { withNew, cache, inject })
  .bootstrap()
  .get('foo'); // { bar: 'baz' }
```
Options: 
 - `withNew: Boolean, default: false` the function will be called with `new` before its result is injected into dependents.
 - `cache: Boolean, default: false` the function will only be called the first time a dependent needs the result. Subsequent dependency resolutions receive the cached result.
 - `inject: Array[String], default []` an array of dependency identifiers. Given that they have been registered, the dependencies are resolved and passed to the function as arguments.

Like `core.value`, a `provider` is created automatically and enqueued until _after_ the core's [configuration phase](#configuration-phase).

The enqueued `provider` looks something like this:
```javascript
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
```

#### `core.class(id, Fn, options)`
Convenience method over `core.factory` that sets the `withNew` option to `true`.

Example:
```javascript
class Foo {
  constructor(bar, baz) {
    this.bar = bar;
    this.baz = baz;
  }
}

core
  .class('foo', Foo, { inject: ['bar', 'baz'] })
  .bootstrap()
  .get('foo') instanceof Foo; // true
```

#### Dependency Annotations
At present, Mini Core does not automatically parse arguments lists to create dependency annotations. Instead, an array of string identifiers must be supplied along with the dependent function or class. So far we've seen this done with `options`. It is recommended that the dependency list be maintained in the source file of the dependent itself. An annotation can be added directly to the dependent function before registration.

Example:
```javascript
class Foo {
  constructor(bar, baz) {
    // foo stuff...
  }
}

Foo._inject = ['bar', 'baz'];

export default Foo;
```

## Execution API

#### `bootstrap(fn, options)`
Once all dependencies have been registered to a `core` object, it can be started with `core.bootstrap`. `bootstrap` steps through the `core`'s startup phases before executing the **optional** function argument.

Options:
- `inject: Array[String]` an array of dependency identifiers. At this time, _all_ registered dependencies are available to inject.

Examples:
```javascript
function main(foo, bar) {
  alert(foo.greeting + bar.name);
}

main._inject = ['foo', 'bar'];

core.bootstrap(main);
```
or
```javascript
core.bootstrap(program => program.run(), { inject: ['program'] });
```

Bootstrapping a `core` performs a few operations under the hood:

#### Configuration Phase

Providers created manually with `core.provide` (or automatically with `core.constant`) are registered immediately and can be injected into functions passed to `core.config`. In the case of manual providers, their entire definition is injected, whereas `constant` providers are resolved via a call to their `_get` method.

Example:
```javascript
core
  // registering the `question` constant
  .constant('question', 'How many roads must a man walk down?')
  // registering the `deepThought` provider
  .provide('deepThought', () => {
    let ultimateQuestion = null;
    let ultimateAnswer = 42;
    return {
      setUltimateQuestion(question) {
        ultimateQuestion = question;
      },
      _get() {
        return { ultimateQuestion, ultimateAnswer };
      }
    };
  })
  // passing configuration to `core.config`
  .config(deepThoughtConfig, { inject: ['deepThought', 'question'] });

// configuration function to change the ultimate question
function deepThoughtConfig(deepThoughtProvider, question) {
  deepThoughtProvider.setUltimateQuestion(question);
}
```

#### Provider Registration Phase

After all `config` functions are run, all `providers` enqueued by calls to `value`, `factory`, and `class` are made available to inject into each other, the optional function passed to `bootstrap`, and functions passed to `core.run`. `providers` created manually will now have the results of their `_get` methods injected to dependents rather than their definitions.

#### Run Phase

Sometimes it is useful to break startup logic out into smaller, more discrete operations — especially if they are not interdependent. Before `core.bootstrap` is completed and its `optional` callback is called, any functions that have been passed to `core.run` are executed with dependencies injected. All registered dependencies are available to inject into `run` functions.

Example:
```javascript
function subscribe(emitter) {
  emitter.on('foo', () => alert('bar'));
}

subscribe._inject = ['emitter'];

function publish(emitter) {
  emitter.emit('foo');
}

publish._inject = ['emitter'];

core
  .class('emitter', EventEmitter, { cache: true });
  .run(subscribe)
  .bootstrap(publish);
```

## The Injector

In general, manual creation of providers is most useful for reusable functionality that needs to be configured differently from application to application.

So far we have seen a couple of examples of manually created `providers`. The above `deepThoughtProvider` is a very basic example.

A detail omitted from that example is that when a `provider` is registered, the function passed to `core.provide` is actually passed an `injector`.
```javascript
core.provide('foo', injector => {
  return { _get() { /* use injector */} };
});
```
After the `core` Configuration Phase, the `injector` will have access to all dependencies registered to the core, so it can be used to access dependencies at runtime.

#### `get(id)`
`injector.get` can be used to resolve a registered dependency, just as shown in previous examples using `core.get`

Example:
```javascript
core
  .value('foo', 'bar');
  .provide('upperFoo', injector => {
    return { _get: () => injector.get('foo').toUpperCase() };
  })
  .bootstrap()
  .get('upperFoo'); // "BAR"
```

#### `has(id)`
To check whether a dependency is available, `injector.has` can be passed an identifier.

Example:
```javascript
core.provide('baz', injector => {
  return {
    _get() {
      return injector.has('bestBaz')
        ? injector.get('bestBaz')
        : injector.get('okBaz');
    }
  };
});    
```

#### `invoke(fn, options)`
The injector can be used to invoke a function with dependencies.

Example:
```javascript
core.provide('foo', injector => {
  return {
    get() {
      return injector.invoke(bar => bar.getBaz(), { inject: ['bar'] });
    }
  }
});
```

----

Shout-out to [Vojta Jina's `di`](https://github.com/angular/di.js).

## Future
- Finish and document parent/child `cores`
- Refactor for extensibility
- Plugin ideas
    + Async dependency/core resolution
    + Automatic annotation