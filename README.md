# mini-core
A small Dependency Injection framework.

## Intro
Modular code has good separation of concerns and explicit dependencies — dependencies that expose an API at the appropriate level of abstraction. But at some point an application has to be wired together. This can be accomplished via a `main` method that calls, instantiates, configures, and creates things to resolve a dependency graph into a running application. Within a small app a `main` method is the simplest and best approach. But for larger applications that need to share application-wide logic or configuration across multiple features, one or more `main` methods can become unwieldy. A DI/IoC tool is handy for eliminating bootstrap logic that more-or-less amounts to boilerplate.

Such tools can range from simple eager-loading service locator libraries to very sophisticated frameworks that rely heavily on project directory structure and configuration files. Mini Core tries to land in the middle by offering just enough functionality to cleanly manage dependency graphs while encroaching as little as possible on user code.

## Features
- Late bound object creation and injection
- Chainable, order-independent setup methods
- Minimal intrusion on application code
- Project structure agnostic
- No configuration files.

## Registration API
A `core` object is created by calling `miniCore`. A set of [`constants`](#constantid-value-or-constantobject) may be passed during creation.
```javascript
import miniCore from 'mini-core';

const emptyCore = miniCore();
const loadedCore = miniCore({ foo: 'bar', baz: 'qux' });
```

#### `provide(id, fn)`
A `core` object is essentially a registry of `providers`. Providers are simple or configurable objects that define what gets injected into consumers. To register a `provider`, pass a unique string identifier and function to `core.provide`. The function passed must return an object with at least a `_get` method.
```javascript
core.provide('foo', () => {
  return { _get: () => 'bar' };
});

core.get('foo'); // "bar"
```
Providers are largely an internal mechanism of Mini Core, but they can be useful for creating configurable dependencies. The above is a short introduction to them. More on providers later.

#### `constant(id, value)` or `constant(object)`
Static values can be registered to a `core` using `core.constant` by either passing a string identifier and value or a set of key/value pairs.
```javascript
core.constant('foo', 'bar');
// or
core.constant({ foo: 'bar' });

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
function makeFoo() {
  return { foo: 'bar' };
}

core.factory('foo', makeFoo);
core.get('foo'); // { foo: 'bar' }
```
Options: 
 - `withNew: Boolean` the function will be called with `new` before its result is injected into dependents
 - `cache: Boolean` the function will only be called the first time a dependent needs the result. Subsequent dependency resolutions receive the cached result.
 - `inject: Array[String]` an array of dependency identifiers. Given that they have been registered, the dependencies are resolved and passed to the function as arguments.
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

core.class('foo', Foo, { inject: ['bar', 'baz'] });

core.get('foo') instanceof Foo; // true
```

#### Dependency Annotations
At present, Mini Core does not automatically parse arguments lists to create dependency annotations. Instead, an array of string identifiers must be supplied by the consumer. So far we've seen this done with `options`. It is recommended that the dependency list be maintained in the source file of the dependent itself. An annotation can be added directly to the dependent function before registration.

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
Once all dependencies have been registered to a `core` object, it can be started with `core.bootstrap`. `bootstrap` cycles through the `core`'s startup phases and executes the **optionally** passed function.

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
// registering the `ultimateAnswer` constant
core.constant('question', 'How many roads must a man walk down?');

// registering the `deepThought` provider
core.provide('deepThought', () => {
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
});

// configuration function to change the ultimate question
function deepThoughtConfig(deepThoughtProvider, question) {
  deepThoughtProvider.setUltimateQuestion(question);
}

// passing configuration to `core.config`
core.config(deepThoughtConfig, { inject: ['deepThought', 'question'] });
```

#### Provider Registration Phase

After `config` all functions are run, all `providers` enqueued by calls to `value`, `factory`, and `class` are made available to inject into each other, the optional function passed to `bootstrap`, and functions passed to `core.run`. `providers` created manually will now have the results of their `_get` methods injected to dependents rather than their definitions.

#### Run Phase

Sometimes it is useful to break startup logic out into smaller, more discrete operations — especially if they are not interdependent. Before `core.bootstrap` is completed and its `optional` callback is called, any functions that have been passed to `core.run` are executed with dependencies injected. All registered dependencies are available to inject into `run` functions.

Example:
```javascript
core.class('eventBus', EventEmitter, { cache: true });

function subscribe(eventBus) {
  eventBus.on('foo', () => alert('bar'));
}

subscribe._inject = ['eventBus'];

core.run(subscribe);

core.bootstrap(eventBus => eventBus.emit('foo'), { inject: ['eventBus'] });
```
