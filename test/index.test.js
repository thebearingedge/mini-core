
'use strict';

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import miniCore from '../index';

chai.use(sinonChai);

const { expect } = chai;

describe('miniCore', () => {

  let app;

  beforeEach(() => app = miniCore());

  it('registers values', () => {

    const myValue = { foo: 'bar' };

    app.value('myValue', myValue);

    expect(app.resolve('myValue')).to.equal(myValue);
  });

  it('throws when no asset is found', () => {

    const missing = () => app.resolve('zyzzy');

    expect(missing).to.throw(Error);
  });

  it('throws on name collision', () => {

    app.value('foo', 'bar');

    const doubleName = () => app.value('foo', 'baz');

    expect(doubleName).to.throw(Error);
  });

  it('accepts values as key val pairs', () => {

    app.value({ foo: 'bar' });

    expect(app.resolve('foo')).to.equal('bar');
  });

  it('throws when an invalid value is passed', () => {
    const badValue = () => {
      app.value(null);
    };
    expect(badValue).to.throw(Error);
  });

  it('installs new assets', () => {

    app.value({ bar: 'bar' });

    const splitBar = sinon.spy(val => val.split(''));

    splitBar._inject = ['bar'];

    app.install('splitBar', splitBar);

    expect(splitBar.calledOnce).to.equal(true);
    expect(app.resolve('splitBar')).to.deep.equal(['b', 'a', 'r']);
    expect(splitBar.calledTwice).to.equal(false);
  });

  it('invokes factories', () => {

    const fn = sinon.spy(() => {
      return { foo: 'bar' };
    });

    app.factory('fn', fn);

    const result1 = app.resolve('fn');
    const result2 = app.resolve('fn');

    expect(result1).to.deep.equal(result2);
    expect(result1).not.to.equal(result2);
    expect(fn.calledTwice).to.equal(true);
  });

  it('resolves dependencies', () => {

    const obj = { foo: 'bar' };
    app.value('obj', obj);

    const fn = sinon.spy(obj => obj);
    fn._inject = ['obj'];
    app.factory('fn', fn);

    class Baz {
      constructor(obj) {
        this.obj = obj;
      }
    }
    Baz._inject = ['fn'];
    app.singleton('baz', Baz);


    const result = app.resolve('baz');

    expect(fn).to.have.been.calledWithExactly(obj);
    expect(result.obj).to.equal(obj);
  });

  it('news and caches singletons', () => {

    const val = { foo: 'bar' };
    app.value('val', val);

    class Foo {

      constructor(val) {

        this.val = val;
      }
    }

    Foo._inject = ['val'];

    app.singleton('foo', Foo);

    const foo1 = app.resolve('foo');
    const foo2 = app.resolve('foo');

    expect(foo1.val).to.equal(val);
    expect(foo2).to.equal(foo1);
  });

  it('configures dependencies', () => {

    const val = { foo: 'bar' };
    app.value('val', val);

    const fig = val => val.baz = 'qux';
    fig._inject = ['val'];

    app.config(fig);

    const figged = app.resolve('val');

    expect(figged).to.equal(val);
    expect(val).to.deep.equal({ foo: 'bar', baz: 'qux' });
  });

});