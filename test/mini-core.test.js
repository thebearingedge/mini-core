
'use strict';

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import miniCore from '../mini-core';

chai.use(sinonChai);
chai.config.truncateThreshold = 0;

const { expect } = chai;

describe('miniCore', () => {

  let core;

  beforeEach(() => core = miniCore());

  describe('provide(id, providerFactory)', () => {

    it('registers a provider', () => {
      const bazProvider = injector => {
        return { _get: () => injector.get('foo') };
      };
      core.provide('baz', bazProvider);
      expect(core._providers.bazProvider).to.exist;
    });

    it('throws if the provider does not have a "_get" method', () => {
      const badProvider = () => {
        core.provide('fooProvider', () => { return {}; });
      };
      const message = '"fooProvider" needs a "_get" method';
      expect(badProvider).to.throw(Error, message);
    });

    it('knows if a local provider is registered', () => {
      core.constant('foo', 'bar');
      core.provide('bazProvider', (injector) => {
        return { _get: () => injector.has('foo') };
      });
      expect(core.get('baz')).to.equal(true);
    });

    it('knows if an ancestor provider is registered', () => {
      core.constant('baz', 'qux');
      const child = core.createChild();
      child.provide('quuxProvider', injector => {
        return { _get: () => injector.has('baz') };
      });
      expect(child.get('quux')).to.equal(true);
    });

    it('can invoke the injector', () => {
      const foo = () => 'bar';
      core.provide('bazProvider', injector => {
        return { _get: () => injector.invoke(foo) };
      });
      expect(core.get('baz')).to.equal('bar');
    });

  });

  describe('has(id)', () => {

    it('returns whether a provider is registered', () => {
      expect(core.has('foo')).to.equal(false);
      core.provide('foo', () => ({ _get() {} }));
      expect(core.has('foo')).to.equal(true);
    });

  });

  describe('constant(id, val)', () => {

    it('registers a constant', () => {
      const foo = { bar: 'baz' };
      core.constant('foo', foo);
      expect(core._providers.foo).to.exist;
      expect(core._providers.foo).to.have.property('_id', 'foo');
    });

    it('registers constants from an object by key', () => {
      core.constant({ foo: 'bar' });
      expect(core._providers.foo).to.have.property('_id', 'foo');
    });

  });

  describe('value(id, val)', () => {

    it('provides a value', () => {
      const foo = { bar: 'baz' };
      core.value('foo', foo);
      expect(core._providers.foo).not.to.exist;
      expect(core._providerQueue[0]._get()).to.equal(foo);
    });

    it('provides values from an object by key', () => {
      const values = { foo: 'bar', baz: 'qux' };
      core.value(values);
      expect(core._providerQueue.length).to.equal(2);
      expect(core._providerQueue[0]).to.have.property('_id', 'foo');
    });

    it('throws if id is already used', () => {
      core.value('foo', 'bar');
      const message = '"foo" has already been registered';
      expect(() => core.value('foo', 'baz')).to.throw(Error, message);
    });

  });

  describe('factory(id, fn, options, deps)', () => {

    it('provides factories', () => {
      const foo = () => 'bar';
      core.factory('foo', foo);
      expect(core._providers.foo).not.to.exist;
      expect(core._providerQueue[0]).to.have.property('_id', 'foo');
      const resolved = core._providerQueue[0]._get();
      expect(resolved).to.equal('bar');
    });

    it('can cache results', () => {
      const foo = sinon.spy(() => ({ bar: 'bax' }));
      core.factory('foo', foo, { cache: true });
      const foo1 = core._providerQueue[0]._get();
      const foo2 = core._providerQueue[0]._get();
      expect(foo.calledOnce).to.equal(true);
      expect(foo1).to.equal(foo2);
    });

  });

  describe('class(id, fn, options, deps)', () => {

    it('provides classes', () => {
      class Foo {
        constructor() {
          this.name = 'Foo Bar';
        }
      }
      core.class('Foo', Foo);
      expect(core._providerQueue[0]).to.have.property('_id', 'Foo');
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

  describe('get(id)', () => {

    it('throws if no local provider', () => {
      const message = 'Dependency "foo" not found';
      expect(() => core.get('foo')).to.throw(Error, message);
    });

    it('throws if no ancestor provider', () => {
      const child = core.createChild();
      const message = 'Dependency "foo" not found';
      expect(() => child.get('foo')).to.throw(Error, message);
    });

    it('throws if a cycle is detected', () => {
      core.provide('foo', injector => {
        return { _get: () => injector.get('bar') };
      });
      core.provide('bar', injector => {
        return { _get: () => injector.get('baz') };
      });
      core.provide('baz', injector => {
        return { _get: () => injector.get('foo') };
      });
      const cyclic = () => core.get('foo');
      const message = 'Cyclic dependency "foo -> bar -> baz -> foo"';
      expect(cyclic).to.throw(Error, message);
    });

    it('resolves dependencies', () => {
      core.constant('foo', 'bar');
      core.provide('bazProvider', injector => {
        return {
          _get() {
            return injector.invoke(dep => dep, { inject: ['foo'] });
          }
        };
      });
      expect(core.get('baz')).to.equal('bar');
    });

  });

  describe('bootstrap(fn)', () => {

    it('flushes configs, providers, runs, starts core, and calls fn', () => {
      const fooProvider = { _get: () => 'bar' };
      core.provide('fooProvider', () => fooProvider );
      core.value({ baz: 'qux' });
      core.constant({ quux: 'grault' });
      const config1Spy = sinon.spy();
      config1Spy._inject = ['fooProvider', 'quux'];
      core.config(config1Spy);
      const config2Spy = sinon.spy();
      core.config(config2Spy);
      const runSpy = sinon.spy();
      core.run(runSpy, { inject: ['baz', 'quux'] });
      const bootSpy = sinon.spy();
      core.bootstrap(bootSpy, { inject: ['foo', 'baz'] });
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
      expect(core._started).to.equal(true);
    });

    it('starts root core before its children', () => {
      const child = core.createChild();
      const parentSpy = sinon.spy(core, '_flushRunQueue');
      const childSpy = sinon.spy(child, '_flushRunQueue');
      child.bootstrap();
      expect(parentSpy.calledBefore(childSpy)).to.equal(true);
    });

    it('throws if missing dependencies are requested', () => {
      const config = () => {};
      core.config(config, { inject: ['foo'] });
      const message = '"config" dependency "foo" not found or illegal';
      expect(() => core.bootstrap()).to.throw(Error, message);
    });

    it('throws if illegal dependencies are requested', () => {
      core.value({ foo: 'bar' });
      const config = () => {};
      config._inject = ['foo'];
      core.config(config);
      const message = '"config" dependency "foo" not found or illegal';
      expect(() => core.bootstrap()).to.throw(Error, message);
    });

  });

});