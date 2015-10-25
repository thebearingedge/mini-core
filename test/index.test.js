
'use strict';

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import miniCore from '../index';

chai.use(sinonChai);

const { expect } = chai;

describe('miniCore', () => {

  let core;

  beforeEach(() => core = miniCore());

  describe('value', () => {

    it('registers values', () => {

      const myValue = { foo: 'bar' };

      core.value('myValue', myValue);

      expect(core.resolve('myValue')).to.equal(myValue);
    });

    it('throws on name collision', () => {

      core.value('foo', 'bar');

      const doubleName = () => core.value('foo', 'baz');

      expect(doubleName).to.throw(Error);
    });

    it('accepts values as key val pairs', () => {

      core.value({ foo: 'bar' });

      expect(core.resolve('foo')).to.equal('bar');
    });

    it('throws when an invalid value is passed', () => {
      const badValue = () => {
        core.value(null);
      };
      expect(badValue).to.throw(Error);
    });

  });

  describe('resolve', () => {

    it('throws when no asset is found', () => {

      const missing = () => core.resolve('zyzzy');

      expect(missing).to.throw(Error);
    });

  });

  describe('install', () => {

    it('dynamically registers assets', () => {

      core.value({ bar: 'bar' });

      const splitBar = sinon.spy(val => val.split(''));

      splitBar._inject = ['bar'];

      core.install('splitBar', splitBar);

      expect(splitBar.calledOnce).to.equal(true);
      expect(core.resolve('splitBar')).to.deep.equal(['b', 'a', 'r']);
      expect(splitBar.calledTwice).to.equal(false);
    });

  });

  describe('factory', () => {

    it('registers functions to be invoked on resolve', () => {

      const fn = sinon.spy(() => {
        return { foo: 'bar' };
      });

      core.factory('fn', fn);

      const result1 = core.resolve('fn');
      const result2 = core.resolve('fn');

      expect(result1).to.deep.equal(result2);
      expect(result1).not.to.equal(result2);
      expect(fn.calledTwice).to.equal(true);
    });

  });

  it('resolves dependencies', () => {

    const obj = { foo: 'bar' };
    core.value('obj', obj);

    const fn = sinon.spy(obj => obj);
    fn._inject = ['obj'];
    core.factory('fn', fn);

    class Baz {
      constructor(obj) {
        this.obj = obj;
      }
    }
    Baz._inject = ['fn'];
    core.singleton('baz', Baz);


    const result = core.resolve('baz');

    expect(fn).to.have.been.calledWithExactly(obj);
    expect(result.obj).to.equal(obj);
  });

  describe('singleton', () => {

    it('registers classes to be instantiated once', () => {

      const val = { foo: 'bar' };
      core.value('val', val);

      class Foo {

        constructor(val) {

          this.val = val;
        }
      }

      Foo._inject = ['val'];

      core.singleton('foo', Foo);

      const foo1 = core.resolve('foo');
      const foo2 = core.resolve('foo');

      expect(foo1.val).to.equal(val);
      expect(foo2).to.equal(foo1);
    });

  });

  describe('config', () => {

    it('calls function argument with dependencies', () => {

      const val = { foo: 'bar' };
      core.value('val', val);

      const fig = val => val.baz = 'qux';
      fig._inject = ['val'];

      core.config(fig);

      const figged = core.resolve('val');

      expect(figged).to.equal(val);
      expect(val).to.deep.equal({ foo: 'bar', baz: 'qux' });
    });

  });

  describe('use', () => {

    const otherCore = miniCore({ grault: 'garply' });

    context('when passed a core', () => {
      it('merges registered assets', () => {
        core.use(otherCore);
        expect(core.resolve('grault')).to.equal('garply');
      });
    });

    context('when passed a namespace and core', () => {
      it('prefixes foreign core assets', () => {
        core.use('other', otherCore);
        expect(core.resolve('other.grault')).to.equal('garply');
      });
    });

    it('throws when a bad value is passed', () => {
      const badCore = () => core.use(null);
      expect(badCore).to.throw(Error);
    });

  });

});