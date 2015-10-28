
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
      expect(noProvider).to.throw(core.MiniCoreError, 'not found');
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
      expect(noProvider).to.throw(core.MiniCoreError, 'not found');
    });

    it('throws if dependencies are cyclic', () => {
      core.provide('foo', injector => {
        return {
          _get() {
            return injector.resolve(['bar']);
          }
        };
      });
      core.provide('bar', injector => {
        return {
          _get() {
            return injector.resolve(['baz']);
          }
        };
      });
      core.provide('baz', injector => {
        return {
          _get() {
            return injector.resolve(['foo']);
          }
        };
      });
      const cyclic = () => {
        core.get('foo');
      };
      const message = 'Cyclic dependency: foo -> bar -> baz -> foo';
      expect(cyclic).to.throw(core.MiniCoreError, message);
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
      const badConstant = () => {
        core.constant(null);
      };
      expect(badConstant).to.throw(core.MiniCoreError, 'Invalid');
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
      expect(badProvider).to.throw(core.MiniCoreError, '_get');
    });

  });

  describe('value(id, val)', () => {

    it('provides values', () => {
      const foo = { bar: 'baz' };
      core.value('foo', foo);
      expect(core._providerQueue[0]).to.have.property('id', 'foo');
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
      expect(fooAgain).to.throw(core.MiniCoreError, 'registered');
    });

    it('throws if bad args are passed', () => {
      const badValue = () => {
        core.value(null);
      };
      expect(badValue).to.throw(core.MiniCoreError, 'Invalid');
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
        core.factory(null);
      };
      expect(badFactory).to.throw(core.MiniCoreError, 'Invalid');
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
        core.class(null);
      };
      expect(badClass).to.throw(core.MiniCoreError, 'Invalid');
    });

  });

  describe('bindFactory(id, function)', () => {

    it('binds factories to their dependencies', () => {
      const foo = { bar: 'baz' };
      core.provide('foo', () => {
        return {
          _get() { return foo; }
        };
      });
      function qux(dep, arg) {
        return Object.assign({}, dep, { arg });
      }
      qux._inject = ['foo'];
      core.bindFactory('qux', qux);
      const boundQux = core._providerQueue[0]._get();
      expect(boundQux.name).to.equal('qux');
      expect(boundQux('grault')).to.deep.equal({ bar: 'baz', arg: 'grault' });
    });

  });

  describe('bindClass(id, Class)', () => {

    it('binds classes to their dependencies', () => {
      const foo = { bar: 'baz' };
      core.provide('foo', () => {
        return {
          _get() { return foo; }
        };
      });
      class Qux {
        constructor(dep, arg) {
          this.dep = dep;
          this.arg = arg;
        }
      }
      Qux._inject = ['foo'];
      core.bindClass('Qux', Qux);
      const BoundQux = core._providerQueue[0]._get();
      expect(BoundQux.name).to.equal('Qux');
      const qux = new BoundQux('quux');
      expect(qux instanceof Qux).to.equal(true);
      expect(qux.dep).to.equal(foo);
      expect(qux.arg).to.equal('quux');
    });

  });



});