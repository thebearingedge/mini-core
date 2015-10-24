# mini-core
A small application core registry with dependency resolution.

## Usage

```javascript
import miniCore from 'mini-core';

const app = miniCore();
const foo = { bar: 'baz' };

app.value('foo', foo);

const resolved = app.resolve('foo');

assert.equal(resolved, foo);
```

## Creation

Invoking `miniCore` returns a container object. Optionally, an object can be passed during creation. The object's values with be registered by key.
```javascript
const app = miniCore({ foo: 'bar' });

assert.equal(app.resolve('foo'), 'bar');
```

## Basic Api

#### `value(id, someValue)`
A string id and value may be passed to store an asset. Multiple id/value pairs can be registered at once using an object.
```javascript
app.value('foo', 'bar'); 
app.value({ baz: 'qux', quux: 'grault' });
```

#### `resolve(id)`
Passing an `id` to `resolve` retrieves the corresponding value from `core`;
```javascript
app.value('marco', () => console.log('polo'));

const marco = app.resolve('marco');

marco(); // "polo"
```

#### `install(id, fn)`
A function also be used to register a dynamic value with `install`. The function is invoked and its return value is registered.
```javascript
app.install('four', () => {
  return 2 + 2;
});

console.log(app.resolve('four')); // 4
```

#### `factory(id, fn)`
A factory function can be registered with `factory`. This function's return value is resolved.
```javascript
function makeFoo() {
  return { bar: 'baz' };
}

app.factory('foo', makeFoo);

const foo1 = app.resolve('foo');
const foo2 = app.resolve('foo');

assert.equal(foo1.bar, 'baz');
assert.equal(foo2.bar, 'baz');
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

app.singleton('foo', Foo);

const foo1 = app.resolve('foo');
const foo2 = app.resolve('foo');

assert.equal(foo1.name, 'fooInstance');
assert.equal(foo1, foo2);
```

## Dependency Resolution

`miniCore` offers basic dependency resolution. This allows individual assets to be written in a testable manner. The below `Friends` repository is extremely easy to test as its dependency on `ajax` and `logger` is explicit.
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
Once `Friends` is sufficiently tested in isolation, it can be registered to the application core. An array of dependency id's must be added to `Friends`. This allows `miniCore` to look up dependencies during resolution.
```javascript
import miniCore from 'mini-core';
import ajax from './lib/ajax';
import logger from './lib/logger';
import Friends from './data/Friends';

const app = miniCore({ ajax, logger });

Friends._inject = ['ajax', 'logger']; // Declare dependencies

app.singleton('friends', Friends);

const friends = app.resolve('friends'); // Friends is instantiated

friends.fetchAll();
```

## Core Building

Using dependency resolution as explained above, it is possible to access registered assets and compose them.

```javascript
import FancyRouter from 'fancy-router';
import FancyView as from 'fancy-view';
import EventEmitter from 'events';
import miniCore from 'mini-core';

const emitter = new EventEmitter();

const app = miniCore({ FancyView, emitter });

app.value('router', new FancyRouter());

function myComponent(FancyView, emitter) {
  return FancyView.extend({
    onClick() {
      emitter.emit('fancy');
    }
  });
}

myComponent._inject = ['FancyView', 'emitter'];

app.install('MyComponent', myComponent);

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

app.config(friendsRoute);

```

## Motivation

`miniCore` is not special at less than 100 SLOC. [IoC](https://en.wikipedia.org/wiki/Inversion_of_control) is not new. [DI](https://en.wikipedia.org/wiki/Dependency_injection) is not new. `miniCore` is pretty simplistic and can be used however you like, given the methods described above. Ideally, the only intrusion on your code is that `_inject` declarations are required for dependency resolution. Otherwise your code can exist as you would have written it without `miniCore`. `miniCore` aims to be plumbing only.

If you stumble upon `miniCore` and are interested in collaborating, please don't hesitate to file an issue.

## TODO
- Design a way to hook `cores` together.
- Detect circular dependencies
- Add more distribution formats