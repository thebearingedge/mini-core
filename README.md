# mini-core
A Dependency Injection framework.

[![Build Status](https://travis-ci.org/thebearingedge/mini-core.svg?branch=master)](https://travis-ci.org/thebearingedge/mini-core) [![Coverage Status](https://coveralls.io/repos/thebearingedge/mini-core/badge.svg?branch=master&service=github)](https://coveralls.io/github/thebearingedge/mini-core?branch=master) [![Code Climate](https://codeclimate.com/github/thebearingedge/mini-core/badges/gpa.svg)](https://codeclimate.com/github/thebearingedge/mini-core)

## Intro
Modular code has good separation of concerns and explicit dependencies — dependencies that expose an API at the appropriate level of abstraction. But at some point an application has to be wired together. This can be accomplished via a `main` method that calls, instantiates, configures, and creates things to resolve a dependency graph into a running application. Within a small app a `main` method is the simplest and best approach. But for larger applications that need to share logic across multiple features, one or more `main` methods can become unwieldy. A DI container is handy for automating plumbing logic that more-or-less amounts to boilerplate. What's more, every component of the application becomes a plugin.

DI tools can range from simple eager-loading service locator libraries to very sophisticated frameworks that rely heavily on project directory structure and configuration files. Mini Core tries to land in the middle by offering just enough functionality to cleanly manage dependency graphs while encroaching as little as possible on application code.

## Features
- Lazy object creation
- Chainable, order-independent registration methods
- Minimal intrusion on application code
- Project structure agnostic
- No configuration files.

## Creation

A `core` object is created by calling `miniCore`. A set of [`constants`](#constantid-value-or-constant-id-value-id-value-) may be passed during creation.
```javascript
import miniCore from 'mini-core';

const emptyCore = miniCore();
const loadedCore = miniCore({ foo: 'bar', baz: 'qux' });
```

## Registration API

#### `provide(id, fn, { inject: [] })`
A `core` object is essentially a registry of `providers`. Providers are simple or configurable objects that define what gets injected into consumers. To register a `provider`, pass a unique string identifier and function to `core.provide`. The function passed must return an object with at least a `_get` method.
```javascript
core
  .provide('foo', () => ({ _get: () => 2 + 2 }))
  .bootstrap(foo => console.log(foo), { inject: ['foo'] }); // 4
```
Providers are largely an internal mechanism of Mini Core, but they can be useful for creating configurable dependencies. The above is a short introduction to them. More on providers later.

Options:
- `inject: Array[String], default []` an array of dependency identifiers. Given that they have been registered, the dependencies are resolved and passed to the function as arguments.

#### `constant(id, value)` or `constant({ id: value, id´: value´ })`
Static values can be registered to a `core` using `core.constant` by either passing a string identifier and value or a set of key/value pairs.
```javascript
core.constant('foo', 'bar');
// or
core.constant({ foo: 'bar' })
  
core.bootstrap(foo => console.log(foo), { inject: ['foo'] }); // "bar"
```

_But a `core` is a registry of providers?_

Correct. `core.constant('foo', 'bar')` creates and registers the following `provider`:
```javascript
{ _id: 'foo', _get: () => 'bar' }
```

#### `value(id, value)` or `value(object)`
Very similar to `core.constant`, except that the `provider` created here is enqueued and inaccessible until _after_ the [configuration phase](#configuration-phase) of the `core` startup.

#### `factory(id, fn, { withNew: false, cache: false, inject: [] })`
A factory function can be registered to a `core` object with `core.factory`. Dependents on this factory will be injected with its return value. 
```javascript
core
  .factory('foo', () => ({ bar: 'baz' }), { withNew, cache, inject })
  .bootstrap(foo => console.log(foo), { inject: ['foo'] }); // { bar: 'baz' }
```
Options: 
 - `withNew: Boolean, default = false` the function will be called with `new` before its result is injected into dependents.
 - `cache: Boolean, default = false` the function will only be called the first time a dependent needs the result. Subsequent dependency resolutions receive the cached result.
 - `inject: Array[String], default = []` an array of dependency identifiers. Given that they have been registered, the dependencies are resolved and passed to the function as arguments.

Like `core.value`, a `provider` is created automatically and enqueued until _after_ the core's [configuration phase](#configuration-phase).

The enqueued `provider` looks something like this:
```javascript
const { cache, withNew } = options;
return {
  _id: id,
  _cache: null,
  _get() {
    if (this._cache) return this._cache;
    const result = core.invoke(fn, { withNew });
    return cache ? (this._cache = result) : result;
  }
};
```

#### `core.class(id, Fn, { cache: false, inject: [] })`
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
  .bootstrap(foo => console.log(foo instanceof Foo), { inject: ['foo']}); // true
```

#### Dependency Annotations
Mini Core does not automatically parse arguments lists to create dependency annotations (possible future plugin). Instead, an array of string identifiers must be supplied along with the dependent function or class. So far we've seen this done with `options`. It is recommended that the dependency list be maintained in the source file of the dependent itself. An annotation can be added directly to the dependent function before registration.

Example:
```javascript
class Foo {
  constructor(bar, baz) {
    // foo's business...
  }
}

Foo._inject = ['bar', 'baz'];

export default Foo;
```

## Execution API

#### `bootstrap(fn, { inject: [] })`
Once all dependencies have been registered or enqueued, the `core` can be started with `core.bootstrap`. `bootstrap` steps through the `core`'s startup phases before executing the optional function argument. All dependencies will be ready to inject into this function.

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

Providers created manually with `core.provide` (or automatically with `core.constant`) are registered immediately and can be injected into functions passed to `core.config(fn, { inject: [] })`. In the case of manual providers, their entire definition is injected, whereas `constant` providers are resolved via a call to their `_get` method.

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

Sometimes it is useful to break startup logic out into smaller, more discrete operations — especially if they are not interdependent. Before `core.bootstrap` is completed and its `optional` callback is called, any functions that have been passed to `core.run(fn, { inject: [] })` are executed with dependencies injected. All registered dependencies are available to inject into `run` functions.

Example:
```javascript
function subscribe(emitter) {
  emitter.on('foo', () => console.log('bar'));
}

function publish(emitter) {
  emitter.emit('foo');
}

subscribe._inject = publish._inject = ['emitter'];

core
  .class('emitter', EventEmitter, { cache: true });
  .run(subscribe)
  .bootstrap(publish); // "bar"
```

## Extras

`get(id)`

It is not recommended to use `core` as a service locator, but if necessary, `core.get` will resolve a registered item. While possibly a sign of a design flaw, `get` may help avoid circular dependency problems.

`has(id)`

Returns whether a dependency has been registered to the `core`.

`invoke(fn, { withNew: false, inject: [] })`

Invoke a function with listed dependencies, optionally using `new`.

`wrap(fn, { withNew: false, inject: [] })`

A class or function can be wrapped such that when called, it will be passed dependencies from `core` and any additional arguments. Note: not all dependencies are available until after the `core` is bootstrapped.

Example:
```javascript
core.constant('foo', 'bar');
function wrapMe(foo, ...args) {
  return [foo, ...args].join(' ').toUpperCase();
}
const wrapped = core.wrap(wrapMe, { inject: ['foo'] });
wrapped('baz'); // "BAR BAZ"
```

## Injector Service

The above extras are also wrapped in an `injector` service pre-registered to a `core`.

Example:
```javascript
const fooProvider = injector => ({ _get: () => injector.has('foo') });

core.provide('foo', fooProvider, { inject: ['injector'] });
```

## Future
- Finish and document parent/child `cores`
- Refactor for extensibility
- Plugin/feature ideas
    + Async dependency/core resolution
    + Automatic annotation
    + Plugin for file system conventions
