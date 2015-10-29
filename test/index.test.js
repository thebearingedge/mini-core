
'use strict';

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import miniCore from '../index';

chai.use(sinonChai);
chai.config.truncateThreshold = 0;

const { expect } = chai;

describe('miniCore', () => {

  let core;

  beforeEach(() => core = miniCore());

  describe('get(id)', () => {

    it('throws if no local provider', () => {
      const noProvider = () => {
        core.get('foo');
      };
      const message = 'Dependency "foo" not found';
      expect(noProvider).to.throw(message);
    });

    it('throws if no ancestor provider', () => {
      const foo = bar => bar;
      foo._inject = ['bar'];
      core.provide('foo', injector => {
        return {
          _cache: null,
          _get() {
            return foo(injector.resolve(foo._inject));
          }
        };
      });
      const parent = miniCore();
      parent.install(core);
      const noProvider = () => {
        core.get('foo');
      };
      const message = 'Dependency "bar" not found';
      expect(noProvider).to.throw(message);
    });

    it('throws if cycle detected', () => {
      core.provide('fooProvider', injector => {
        return {
          _get() { return injector.resolve(['bar']); }
        };
      });
      core.provide('barProvider', injector => {
        return {
          _get() { return injector.resolve(['baz']); }
        };
      });
      core.provide('bazProvider', injector => {
        return {
          _get() { return injector.resolve(['foo']); }
        };
      });
      const cyclic = () => {
        core.get('foo');
      };
      const message = 'Cyclic dependency "foo -> bar -> baz -> foo"';
      expect(cyclic).to.throw(Error, message);
    });

    it('resolves dependencies', () => {
      core.provide('fooProvider', () => {
        return { _get() { return 'bar'; } };
      });
      expect(core.get('foo')).to.equal('bar');
    });

  });

  describe('constant', () => {

    it('registers constants', () => {
      const foo = { bar: 'baz' };
      core.constant('foo', foo);
      expect(core._providers.foo).to.have.property('id', 'foo');
    });

    it('accepts maps', () => {
      core.constant({ foo: 'bar' });
      expect(core._providers.foo).to.have.property('id', 'foo');
    });

    it('throws if bad args are passed', () => {
      const obj = { toString: null };
      const badConstant = () => {
        core.constant(null, obj);
      };
      const message = 'Invalid parameters (null, ) for constant "null"';
      expect(badConstant).to.throw(Error, message);
    });

  });

  describe('provide(id, provider)', () => {

    it('registers a provider', () => {
      const bazProvider = injector => {
        return {
          _get() {
            const [ foo ] = injector.resolve(['foo']);
            return foo;
          }
        };
      };
      core.provide('bazProvider', bazProvider);
      expect(core._providers.bazProvider).to.have.property('_get');
    });

    it('throws if the provider does not have a "_get" method', () => {
      const badProvider = () => {
        core.provide('foo', () => {
          return {};
        });
      };
      const message = 'Provider "foo" needs a "_get" method';
      expect(badProvider).to.throw(Error, message);
    });

    it('knows if a local provider is registered', () => {
      core.constant('foo', 'bar');
      core.provide('bazProvider', (injector) => {
        return {
          _get() { return injector.has('foo'); }
        };
      });
      expect(core.get('baz')).to.equal(true);
    });

    it('knows if an ancestor provider is registered', () => {
      const parent = miniCore({ foo: 'bar' });
      core.constant('baz', 'qux');
      parent.install(core);
      core.provide('quuxProvider', (injector) => {
        return {
          _get() { return injector.has('foo'); }
        };
      });
      expect(core.get('quux')).to.equal(true);
    });

    it('can get a dependency', () => {
      core.constant('foo', 'bar');
      core.provide('bazProvider', (injector) => {
        return {
          _get() { return injector.get('foo'); }
        };
      });
      expect(core.get('baz')).to.equal('bar');
    });

  });

  describe('value(id, val)', () => {

    it('provides values', () => {
      const foo = { bar: 'baz' };
      core.value('foo', foo);
      expect(core._providerQueue[0]._get()).to.equal(foo);
    });

    it('accepts a map of values', () => {
      const values = { foo: 'bar', baz: 'qux' };
      core.value(values);
      expect(core._providerQueue.length).to.equal(2);
      expect(core._providerQueue[0]).to.have.property('id', 'foo');
    });

    it('throws if id is already used', () => {
      core.value('foo', 'bar');
      const fooAgain = () => {
        core.value('foo', 'baz');
      };
      const message = '"foo" has already been registered';
      expect(fooAgain).to.throw(Error, message);
    });

    it('throws if bad args are passed', () => {
      const obj = { toString() { return 'obj'; } };
      const badValue = () => {
        core.value(null, obj);
      };
      const message = 'Invalid parameters (null, obj) for value "null"';
      expect(badValue).to.throw(Error, message);
    });

  });

  describe('factory(id, fn, options)', () => {

    it('provides factories', () => {
      const foo = () => 'bar';
      core.factory('foo', foo);
      expect(core._providerQueue[0]).to.have.property('id', 'foo');
      const resolved = core._providerQueue[0]._get();
      expect(resolved).to.equal('bar');
    });

    it('can cache results', () => {
      const foo = sinon.spy(() => {
        return { bar: 'bax' };
      });
      core.factory('foo', foo, { cache: true });
      const foo1 = core._providerQueue[0]._get();
      const foo2 = core._providerQueue[0]._get();
      expect(foo.calledOnce).to.equal(true);
      expect(foo1).to.equal(foo2);
    });

    it('throws on invalid parameters', () => {
      const badFactory = () => {
        core.factory(null, undefined);
      };
      const message = 'Invalid parameters (null, undefined) for factory "null"';
      expect(badFactory).to.throw(Error, message);
    });

  });

  describe('config(fn)', () => {

    it('enqueues a config function', () => {
      core.config(() => {});
      expect(core._configQueue).to.have.property('length', 1);
    });

  });

  describe('run(fn)', () => {

    it('enqueues a run function', () => {
      core.run(() => {});
      expect(core._runQueue).to.have.property('length', 1);
    });

  });

  describe('bootstrap(fn)', () => {

    it('executes configs, runs, starts the core, and calls fn', () => {
      const fooProvider = { _get() { return 'bar'; } };
      core.provide('fooProvider', () => {
        return fooProvider;
      });
      core.value({ baz: 'qux' });
      core.constant({ quux: 'grault' });
      const config1Spy = sinon.spy();
      config1Spy._inject = ['fooProvider', 'quux'];
      core.config(config1Spy);
      const config2Spy = sinon.spy();
      core.config(config2Spy);
      const runSpy = sinon.spy();
      runSpy._inject = ['baz', 'quux'];
      core.run(runSpy);
      const bootSpy = sinon.spy();
      bootSpy._inject = ['foo', 'baz'];
      core.bootstrap(bootSpy);
      expect(config1Spy.calledOnce).to.equal(true);
      expect(config1Spy).to.have.been.calledWithExactly(fooProvider, 'grault');
      expect(config2Spy.calledOnce).to.equal(true);
      expect(config2Spy).to.have.been.calledWithExactly();
      expect(core._configQueue).to.have.property('length', 0);
      expect(runSpy.calledOnce).to.equal(true);
      expect(runSpy).to.have.been.calledWithExactly('qux', 'grault');
      expect(core._runQueue).to.have.property('length', 0);
      expect(bootSpy.calledOnce).to.equal(true);
      expect(bootSpy).to.have.been.calledWithExactly('bar', 'qux');
      expect(core._running).to.equal(true);
    });

    it('starts parent core before children', () => {
      const child = miniCore();
      core.install(child);
      const parentSpy = sinon.spy(core, '_bootstrap');
      const childSpy = sinon.spy(child, '_bootstrap');
      child.bootstrap();
      expect(parentSpy.calledBefore(childSpy)).to.equal(true);
    });

    it('throws if illegal dependencies are required', () => {
      core.value({ foo: 'bar' });
      const config = () => {};
      config._inject = ['foo'];
      core.config(config);
      const illegalDep = () => {
        core.bootstrap();
      };
      const message = '"foo" not found or illegal during config phase';
      expect(illegalDep).to.throw(message);
    });

  });

  describe('class(id, fn, options)', () => {

    it('provides classes', () => {
      class Foo {
        constructor() {
          this.name = 'Foo Bar';
        }
      }
      core.class('Foo', Foo);
      expect(core._providerQueue[0]).to.have.property('id', 'Foo');
      const foo = core._providerQueue[0]._get();
      expect(foo instanceof Foo).to.equal(true);
    });

    it('can cache instances', () => {
      const fooSpy = sinon.spy();
      class Foo {
        constructor() {
          fooSpy();
        }
      }
      core.class('foo', Foo, { cache: true });
      const foo1 = core._providerQueue[0]._get();
      const foo2 = core._providerQueue[0]._get();
      expect(fooSpy.calledOnce).to.equal(true);
      expect(foo1).to.equal(foo2);
    });

    it('throws on invalid parameters', () => {
      const badClass = () => {
        core.class();
      };
      const message = 'Invalid parameters () for class "undefined"';
      expect(badClass).to.throw(Error, message);
    });

  });

});