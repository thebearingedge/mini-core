# mini-core
A small application core with dependency resolution.

## Usage

```javascript
import miniCore from '@thebearingedge/mini-core';

const core = miniCore();
const foo = { bar: 'baz' };

core.value('foo', foo);

const resolved = core.resolve('foo');

assert.equal(resolved, foo);
```

## Creation

Invoking `miniCore` returns a container object. Optionally, an object can be passed during creation. The object's values with be registered by key.
```javascript
const core = miniCore({ foo: 'bar' });

assert.equal(core.resolve('foo'), 'bar');
```

## Api

#### `value(id, someValue)`
A string id and value may be passed to store an asset. Multiple id/value pairs can be registered at once using an object.
```javascript
core.value('foo', 'bar'); 
core.value({ baz: 'qux', quux: 'grault' });
```

#### `resolve(id)`
Passing an `id` to `resolve` retrieves the corresponding value from `core`;
```javascript
core.value('marco', () => console.log('polo'));

const marco = core.resolve('marco');

marco(); // "polo"
```

#### `install(id, fn)`
A function can be used to register a dynamic value via `install`. The function argument is invoked and its return value is registered.
```javascript
core.install('four', () => {
  return 2 + 2;
});

console.log(core.resolve('four')); // 4
```

#### `factory(id, fn)`
A factory function can be registered with `factory`. Calling `resolve` invokes the function and its return value is produced.
```javascript
function makeFoo() {
  return { bar: 'baz' };
}

core.factory('foo', makeFoo);

const foo1 = core.resolve('foo');
const foo2 = core.resolve('foo');

assert.equal(foo1.bar, 'baz');
assert.equal(foo2.bar, 'baz');
assert.notEqual(foo1, foo2);
```

#### `class(id, Class)`
Classes can be instantiated on demand after being registered with `class`.
```javascript
class Foo {
  constructor() {
    this.name = 'fooInstance';
  }
}

core.class('foo', Foo);

const foo1 = core.resolve('foo');
const foo2 = core.resolve('foo');

assert(foo1 instanceof Foo);
assert.notEqual(foo1, foo2);
```

#### `singleton(id, Class)`
If a single instance of a class should be resolved, the class can be registered with `singleton`.
```javascript
class Foo {
  constructor() {
    this.name = 'fooInstance';
  }
}

core.singleton('foo', Foo);

const foo1 = core.resolve('foo');
const foo2 = core.resolve('foo');

assert.equal(foo1.name, 'fooInstance');
assert.equal(foo1, foo2);
```

## Dependency Resolution

`miniCore` offers basic dependency resolution. This allows individual assets to be written in a testable manner. The below `Friends` repository is plain,  decoupled, and easy to test. 
```javascript
// Friends.js
class Friends {
  constructor(ajax, logger) {
    this._ajax = ajax;
    this._logger = logger;
    this._endpoint = '/friends'
  }
  fetchAll() {
    return this._ajax
      .get(this._endpoint)
      .then(response => response.body)
      .catch(err => logger.log(err.message));
  }
}

export default Friends;
```
Once `Friends` is sufficiently tested in isolation, it can be registered to the application core. An array of dependency id's must be added to `Friends` as a simple `_inject = []` property.
```javascript
Friends._inject = ['ajax', 'logger'];
```
This allows `miniCore` to look up dependencies during resolution.
```javascript
import miniCore from '@thebearingedge/mini-core';
import ajax from './lib/ajax';
import logger from './lib/logger';
import Friends from './data/Friends';

const core = miniCore({ ajax, logger });

core.singleton('friends', Friends);

const friends = core.resolve('friends'); // Friends is instantiated

friends.fetchAll();
```

#### `wrap(id, fn)`

A function can be stored in a `core` as a `value`. But if this function has dependencies it needs to be `wrapped`. The stored function's dependencies are not immediately resolved on _resolution_, but instead on _invokation_.
```javascript
const makeFoo = () => 'foo';
core.factory('makeFoo', makeFoo);

const delayed = dep => dep.toUppercase();
delayed._inject = ['makeFoo'];
core.wrap('delayed', delayed);

const wrapped = core.resolve('delayed'); // makeFoo has not been called
console.log(wrapped()); // "FOO"
```

## Core Building

Using dependency resolution as explained above, it is possible to access registered assets for composition.

The `config` method is supplied purely to access and manipulate objects in `core`. Functions passed to `core` can be written as separate modules, tagged with `_inject` and imported into the `core` wiring.

```javascript
import FancyRouter from 'fancy-router';
import FancyView from 'fancy-view';
import EventEmitter from 'events';
import miniCore from '@thebearingedge/mini-core';

const core = miniCore({ FancyView })
    .singleton('emitter', EventEmitter)
    .value('router', new FancyRouter({ /* router config */}));

// myComponent could be a separate, testable module.
function myComponent(FancyView, emitter) {
  return FancyView.extend({
    onClick() {
      emitter.emit('fancy');
    }
  });
}
myComponent._inject = ['FancyView', 'emitter'];

core.install('MyComponent', myComponent);

// friendsRoute could be a separate module too
// `config` simply pulls dependencies and invokes a function on them
function friendsRoute(router, friends, MyComponent) {
  router.addRoute({
    path: '/friends',
    data: {
      friends() { return friends.fetchAll(); }
    },
    component: MyComponent
  });
}
friendsRoute._inject = ['router', 'friends', 'MyComponent'];

core.config(friendsRoute);

core.resolve('router').navigateTo('/friends');
```

## Motivation

In a time of "modular apps" and "reusable components", implicit dependencies are all over the place. If a component is reusable, it can just be plugged into your `core` so a bunch of `requires` and `imports` are eliminated. CommonJS and ES6 Modules are totally sweet for library authoring and distribution, but often they feel weird for application authoring.

`miniCore` is not special. [This problem](https://gist.github.com/branneman/8048520) has been solved on other platforms and they do it using libraries. In JS land this has been territory for full-blown frameworks, but the general technique and benefits are not confined to them.

[IoC](https://en.wikipedia.org/wiki/Inversion_of_control) is not new. [DI](https://en.wikipedia.org/wiki/Dependency_injection) is not new. `miniCore` is pretty simplistic and can be used however you like, given the methods described above. Ideally, the only intrusion on your code is that `_inject` declarations are required for function dependency resolution (not needed for values or functions with no arguments). Otherwise your code can exist as you would have (hopefully) written it without `miniCore`; modular, composable, and testable.

`miniCore` aims to be a plumbing library only. The entire object graph is left to the developer while lines and lines of manual object creation are taken care of.

If you stumble upon `miniCore` and are interested in collaborating, please don't hesitate to file an issue or peruse the todo :).

## TODO
- Document merge feature
- Detect circular dependencies
- Add more distribution formats
