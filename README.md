# mini-core
A small application core.

## Intro
Decoupled code has a single reponsibility and explicit, appropriately abstract dependencies. But at some point an application has to be wired together. This can be accomplished via a `main` method that calls, instantiates, configures, and creates things to resolve an object graph into a running application. Within a small app a `main` method is the simplest and best approach. But for larger applications that need to share application-wide logic or configuration across multiple features, one or more `main` methods can become unwieldy, so a DI/IoC tool is handy.

Such tools can range from simple service locator libraries to very sophisticated frameworks that rely heavily on project directory structure and configuration files. Mini Core tries to land in the middle, offering just enough functionality to cleanly manage dependency graphs.

## API
A `core` object is created by calling `miniCore`.
```javascript
import miniCore from './mini-core';

const core = miniCore();
```

#### `provide(id, fn)`
A `core` object contains a registry of `providers`. Providers are simple objects that define what gets injected into dependents when they require a dependency. To register a `provider`, pass a string identifier and function to `core.provide`. The function passed can return any object you like, but it must have a `_get` method. The return value of this `_get` method injected into dependents.
```javascript
core.provide('foo', () => {
  return { _get: () => 'bar' };
});

core.get('foo'); // "bar"
```

#### `constant(id, value)` or `constant(object)`
Static values can be registered to a `core` using `core.constant` Either passing a string identifier and value are passed, or a set of key/value pairs. The values are resolved by `core.get`.
```javascript
core.constant('foo', 'bar');
// or
core.constant({ foo: 'bar' });

core.get('foo'); // "bar"
```

_But a core is a registry of providers?_

Correct. `core.constant('foo', 'bar')` creates and registers the following `provider` automatically:
```javascript
{
  id: 'foo',
  _get() {
    return 'bar';
  }
}
```

#### `core.value('foo', 'bar')`
Very similar to `core.constant`, except that the `provider` created here is enqueued and inaccessible until _after_ the [configuration phase](#configuration-phase) of the `core` lifecycle. More on that later.

#### `core.factory(id, fn, options)`
A factory function can be registered to a `core` object with the `core.factory`. Dependents on this factory will have its return value injected as a dependency.
```javascript
function makeFoo() {
  return { foo: 'bar' };
}

core.factory('foo', makeFoo);
core.get('foo'); // { foo: 'bar' }
```
options: 
 - `withNew: Boolean` factory function will be called with `new`
 - `cache: Boolean` factory function will be called once and its first return value is used from then after for injection

#### `core.class(id, Fn, options)`
Syntactic convenience method over `core.factory` that defaults the `withNew` option to `true`.

## Lifecycle

#### Configuration Phase

Providers created manually with `core.provide` or automatically with `core.constant` are registered immediately and can be used from within calls to `core.config`, i.e. during the **Configuration Phase** of a core's lifecycle. Here is a simple example:
```javascript
// registering the `deepThought` provider
core.provide('deepThought', injector => {
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
function deepThoughtConfig(deepThoughtProvider) {
  deepThoughtProvider.setUltimateQuestion('How many roads must a man walk down?');
}

// passing configuration to `core.config`
core.config(deepThoughtConfig, { inject: ['deepThought'] });
```
