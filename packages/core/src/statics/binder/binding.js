import pz from '../../core';
import reservedKeys from './reserved-keys';
import { buildContext } from './util';

let parseAlias = function (keypath) {
    let as = keypath.indexOf(reservedKeys.as) != -1,
        parts, result = { keypath: keypath, alias: null };

    if (!as) {
        return result;
    };

    parts = keypath.split(reservedKeys.as);
    result.keypath = parts.shift().trim();
    result.alias = parts.pop().trim();
    parts = null;
    return result;
};

class binding {
    constructor(el, type, keypath, bindingAttr, view) {
        let result = parseAlias(keypath);

        this.id = pz.guid();
        this.el = el;
        this.view = view;
        this.type = type;
        this.keypath = result.keypath.trim();
        this.alias = result.alias || null;
        this.bindingAttr = bindingAttr;
        this.prop = result.keypath.split('.').pop();
        this.rootVm = view.vm;
        this.vm = buildContext(result.keypath, view.vm, view.ctx);
        this.binder = pz.binder.binders[this.type];
        this.handler = this.binder.handler ? pz.proxy(this.binder.handler, this) : undefined;
        view = null;
        return this;
    };
};

binding.prototype.bind = function () {

    let observer = this.vm[this.prop];

    if (this.binder.bind) {
        this.binder.bind.call(this);
    };

    if (this.binder.react && observer && observer.subscribe) {
        (function (me, obs) {
            obs.subscribe(function () {
                me.binder.react.call(me);
            }, me.id);
        })(this, observer);
    };

    if (this.binder.react) {
        this.binder.react.call(this);
    };
};

binding.prototype.unbind = function () {
    let observer = this.vm[this.prop];
    if (observer && observer.unsubscribe) {
        observer.unsubscribe(this.id);
    };
    if (pz.isFunction(this.binder.unbind)) {
        this.binder.unbind.call(this);
    };
};

binding.prototype.getValue = function () {

    let prop, isFn;

    if (this.prop == reservedKeys.current) {
        return this.vm;
    };

    if (this.prop == reservedKeys.idx) {
        return this.view.index;
    };

    prop = this.vm[this.prop];
    isFn = pz.isFunction(prop);
    return isFn ? this.vm[this.prop].call(this) : this.vm[this.prop];
};

binding.prototype.setValue = function (value) {
    return this.vm[this.prop] = value;
};

export default binding;