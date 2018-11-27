﻿import pz from '../core';

const binder = () => {

    let observable, observableArray,
        binding, view, observe, observeArray, textParser,
        parseKeyPath, buildContext, reservedKeys, bindingRegex,
        getBindingRegex;

    // helpers
    reservedKeys = {
        idx: '$index',
        current: '$current',
        root: '$root',
        as: ' as ',
        observed: '$observed',
        view: '$view'
    };

    getBindingRegex = function () {
        if (pz.isEmpty(bindingRegex)) {
            bindingRegex = RegExp('^' + pz.binder.prefix + '-', 'i');
        };

        return bindingRegex;
    };

    parseKeyPath = function (keypath, target) {

        let parts = keypath.split('.');
        let globalScope;

        if (parts.length == 1) {
            return target;
        };
        
        globalScope = pz.getGlobal();
        parts.pop();
        return parts.reduce(function (previous, current) {
            let isString = pz.isString(previous);
            return isString ? globalScope[previous][current] :
                (pz.isEmpty(previous) ? null : previous[current]);
        }, target);
    };

    buildContext = function (keypath, vm, ctx) {
        let hasCtx = ctx != null,
            isPath = /^[a-z$][a-z0-9]*(?:\.[a-z0-9]+)+$/i.test(keypath),
            fromRoot = isPath && keypath.indexOf(reservedKeys.root) != -1;

        keypath = fromRoot ? keypath.split('.').slice(1).join('.') : keypath;

        return (hasCtx && !isPath && !fromRoot ? ctx : parseKeyPath(keypath, vm)) ||
            parseKeyPath(keypath, ctx);
    };

    observe = function (value) {

        if (!pz.isObject(value) || value.$observed) {
            return false;
        };

        let properties = Object.keys(value);

        pz.forEach(properties, function (prop) {

            let propValue = value[prop];

            let obsArray = observeArray(value, propValue, prop);

            if (obsArray && !pz.isInstanceOf(value, observableArray)) {
                value[prop] = obsArray;
            };

            if (!obsArray && !pz.isInstanceOf(value, observable) && !observe(propValue) &&
                !pz.isFunction(propValue)) {
                value[prop] = new observable(value, prop);
            };
        });

        value.$observed = true;
        return true;
    };

    observeArray = function (obj, collection, prop) {

        let isArray = pz.isArray(collection);
        let obsArray;

        if (!isArray) {
            return obsArray;
        };

        obsArray = new observableArray(obj, collection, prop);
        pz.forEach(obsArray, function (item) {
            observe(item);
        });

        return obsArray;
    };
    //
    observable = (function () {

        let defineReactive = function (me, obj, key) {
            let value = obj[key];

            delete obj[key];
            Object.defineProperty(obj, key, {
                configurable: true,
                enumerable: true,
                set: function (newValue) {
                    let val = newValue.value != null || newValue.value != undefined ? newValue.value : newValue;
                    let shouldNotify = val != value && me.notify != undefined;
                    value = val;
                    if (shouldNotify) {
                        me.notify();
                    };
                },
                get: function () {
                    let get = function () {
                        return value;
                    };

                    get.subscribe = function (callback, bindingId) {
                        me.subscribe.call(me, callback, bindingId);
                    };

                    get.unsubscribe = function (bindingId) {
                        me.unsubscribe.call(me, bindingId);
                    };

                    return get;
                }
            });
        };

        function observable(obj, key) {
            this.value = obj[key];
            this.prop = key;
            this.subscriptions = [];
            defineReactive(this, obj, key);
            return this;
        };

        observable.prototype.notify = function () {
            if (this.subscriptions.length == 0) {
                return;
            };

            pz.forEach(this.subscriptions, function (subscription) {
                subscription.update.call(this, subscription);
            }, this);
        };

        observable.prototype.subscribe = function (callback, bindingId) {
            let length = this.subscriptions.length;
            this.subscriptions.push({
                id: bindingId || length++,
                update: callback
            });
        };

        observable.prototype.unsubscribe = function (bindingId) {
            let bindingSubs = this.subscriptions.filter(function (sub) {
                return sub.id == bindingId;
            });

            pz.forEach(bindingSubs, function (sub) {
                let idx = this.subscriptions.indexOf(sub);
                this.subscriptions.splice(idx, 1);
            }, this);
        };

        return observable;

    })();

    observableArray = (function () {
        let observableMethods = 'pop push shift unshift splice reverse sort'.split(' '),
            normalMethods = 'slice concat join some every forEach map filter reduce reduceRight indexOf lastIndexOf toString toLocaleString'.split(' '),
            arrPrototype = Array.prototype;

        let handleSubscriptions = function (me, subscribe, name, callback, bindingId) {

            if (!observableMethods[name]) {
                throw new Error('Can not ' + (subscribe ? 'subscribe to' : 'unsubscribe from') + ' action named: [' + name + ']');
            };

            let length = me.subscriptions.length;
            me.subscriptions.push({
                id: bindingId || length++,
                name: name,
                callback: callback
            });
        };

        function observableArray(obj, collection, prop) {
            collection = collection || [];

            this.subscriptions = [];
            this.prop = prop;

            for (let i = 0; i < collection.length; i++) {
                this.push(collection[i]);
            };

            let length = this.length;
            this.hasData = length > 0;

            Object.defineProperty(this, 'length', {
                configurable: false,
                enumerable: true,
                set: function (newValue) {
                    let newItem;

                    if (newValue > length) { // push or unshift
                        newItem = this.__action == 'push' ? this[length] : this[0];
                        observe(newItem);
                    };

                    if (newValue != length) {
                        length = newValue;
                        this.hasData = length > 0;
                    };
                },
                get: function () {
                    return length;
                }
            });

            this.hasData = new observable(this, 'hasData');
            return this;
        };

        observableArray.prototype = [];

        pz.forEach(observableMethods, function (methodName) {

            let method = arrPrototype[methodName];

            observableArray.prototype[methodName] = function () {
                this.__action = methodName;
                let returnValue = method.apply(this, arguments);

                let subscription = this.subscriptions.filter(function (subscription) { // find not supported in IE
                    return subscription.name == methodName;
                })[0];

                if (subscription) {
                    let args = arrPrototype.slice.call(arguments);
                    subscription.callback.apply(this, args);
                };

                delete this.__action;
                return returnValue;
            };
        });

        pz.forEach(normalMethods, function (methodName) {
            observableArray.prototype[methodName] = arrPrototype[methodName];
        });

        observableArray.prototype.subscribe = function (callback, bindingId) {

            this.subscriptions.splice(0, this.subscriptions.length);
            pz.forEach(observableMethods, function (action) {
                handleSubscriptions(this, true, action, callback, bindingId);
            }, this);
            callback = null;
        };

        observableArray.prototype.unsubscribe = function (bindingId) {

            let bindingSubs = this.subscriptions.filter(function (sub) {
                return sub.id == bindingId;
            });

            pz.forEach(bindingSubs, function (sub) {
                let idx = this.subscriptions.indexOf(sub);
                this.subscriptions.splice(idx, 1);
            }, this);
        };

        observableArray.prototype.getFirst = function () {
            return this.getAt(0);
        };

        observableArray.prototype.getLast = function () {
            return this.getAt(this.length - 1);
        };

        observableArray.prototype.getAt = function (index) {

            if (pz.isEmpty(index)) {
                return null;
            };

            return this[index];
        };

        observableArray.prototype.removeAll = function () {
            this.splice(0, this.length);
        };

        return observableArray;
    })();

    textParser = {
        parse: function (el) {

            let hasInterpolations,
                keypaths, updateContent, elData;

            if (el.nodeType != 3 || el.textContent.length == 0) {
                return;
            };

            hasInterpolations = (el.textContent.indexOf(pz.binder.delimiters[0]) != -1 &&
                el.textContent.indexOf(pz.binder.delimiters[1]) != -1);

            if (!hasInterpolations) {
                return;
            };

            keypaths = [];

            updateContent = (function (me, _vm) {
                return function (data, parsed) {
                    data.el.textContent = data.tpl.replace(/{([^}]*)}/g, function (template, value) {
                        let isPath, val, vmValue, curr, idx;

                        value = value.replace(/ +?/g, '');
                        curr = value.indexOf(reservedKeys.current) != -1;
                        idx = value.indexOf(reservedKeys.idx) != -1;
                        vmValue = (!curr ? (!idx ? _vm[value] : me.index) : _vm);
                        isPath = /^[a-z$][a-z0-9]*(?:\.[a-z0-9]+)+$/i.test(value);

                        if (isPath) {
                            val = value.split('.').pop();
                            vmValue = ((me.ctx && me.ctx[val]) || me.vm[val]) ||
                                buildContext(value, me.vm, me.ctx)[val];
                            val = null;
                        };

                        if (!parsed) {
                            keypaths.push(value);
                        };

                        let result = (!pz.isEmpty(vmValue) ?
                            (pz.isFunction(vmValue) ? vmValue() : vmValue) : template);
                        vmValue = null;
                        return result;
                    });
                };
            })(this, this.ctx || this.vm);

            if (!this.elsData) {
                this.elsData = [];
            };

            elData = {
                el: el,
                tpl: el.textContent.trim()
            };

            this.elsData.push(elData);
            updateContent(elData, false);

            (function (me, elsData) {
                pz.forEach(keypaths, function (keypath) {
                    let ctx = buildContext(keypath, me.vm, me.ctx);
                    let prop = keypath.split('.').pop();
                    let observer = ctx[prop];
                    if (observer) {
                        observer.subscribe(function () {
                            pz.forEach(elsData, function (data) {
                                updateContent(data, true);
                            });
                        });
                    };
                    ctx = null;
                });
            })(this, this.elsData);

            keypaths.splice(0, keypaths.length);
            this.elsData.splice(0, keypaths.length);
        }
    };

    binding = (function () {

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

        function binding(el, type, keypath, bindingAttr, view) {
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

        return binding;
    })();

    view = (function () {

        let parseAttrName = function (name) {
            let startIdx, endIdx;
            let inBrackets = ((startIdx = name.indexOf('[')) != -1) &&
                ((endIdx = name.indexOf(']')) != -1), attrToBind, parts;

            if (!inBrackets) {
                return name.split('-');
            };

            attrToBind = name.substring((startIdx + 1), endIdx);
            name = name.replace('-[' + attrToBind + ']', '');
            parts = name.split('-');
            parts.push(attrToBind);
            return parts;
        };

        function view(el, vm, ctx, index) {
            this.els = pz.isArray(el) || pz.isNodeList(el) ? el : [el];
            this.vm = vm;
            this.ctx = ctx || null;
            this.index = !pz.isEmpty(index) ? index : null;
            this.buildBindings();
            vm = null;
            return this;
        };

        view.prototype.bind = function () {
            pz.forEach(this.bindings, function (binding) {
                binding.bind();
            });
        };

        view.prototype.unbind = function () {
            pz.forEach(this.bindings, function (binding) {
                binding.unbind();
            });
        };

        view.prototype.buildBindings = function () {
            this.bindings = [];

            let build = (function (me) {
                return function (els) {
                    pz.forEach(els, function (el) {
                        let isBlock = (el.hasAttribute && el.hasAttribute(pz.binder.prefix + '-each')),
                            attrs = isBlock ? [el.getAttributeNode(pz.binder.prefix + '-each')] : (el.attributes || []);

                        pz.forEach(attrs, function (attr) {
                            if (getBindingRegex().test(attr.name)) {
                                let parts = parseAttrName(attr.name);
                                let bType = parts[1], attrToBind = parts[2];

                                if (!pz.isEmpty(pz.binder.binders[bType])) {
                                    let b = new binding(el, bType.toLowerCase(), attr.value, attr.name, me);
                                    if (attrToBind) { b.attrToBind = attrToBind; };

                                    me.bindings.push(b);
                                    isBlock = isBlock || b.binder.block;
                                    b = null;
                                };
                            };
                        });

                        if (!isBlock) {
                            pz.forEach(el.childNodes, function (childNode) {
                                build([childNode]);
                                textParser.parse.call(me, childNode);
                            });
                        };
                    });
                };
            })(this);

            build(this.els);
            this.bindings.sort(function (a, b) {
                return a.binder.priority - b.binder.priority;
            });
        };

        return view;

    })();

    return {
        prefix: 'data',
        delimiters: ['{', '}'],
        bind: function (els, viewModel) {

            if (viewModel.$view) {
                viewModel.$view.bind();
                return;
            };

            observe(viewModel);
            let v = new view(els, viewModel);
            v.bind();
            viewModel.$view = v;
            v = null;
        },
        unbind: function (viewModel) {
            if (viewModel.$view) {
                viewModel.$view.unbind();
            };
        },
        toJSON: function (viewModel) {
            // TODO: Multidimensional arrays

            let getProperties = function (value) {
                return Object.keys(value).filter(function (key) {
                    return key != reservedKeys.observed && key != reservedKeys.view;
                })
            }, toJSON = function (value, res) {

                let properties = getProperties(value);

                pz.forEach(properties, function (prop) {

                    let isObject = pz.isObject(value[prop]),
                        isFunction = pz.isFunction(value[prop]),
                        isObsArray = pz.isInstanceOf(value[prop], observableArray);

                    if (isObject) {
                        toJSON(value[prop], res);
                    };

                    if (isObsArray) {
                        res[prop] = [];
                        let dataKeys = Object.keys(value[prop]).filter(function (key) {
                            return !isNaN(parseInt(key));
                        });

                        pz.forEach(dataKeys, function (key) {
                            let item = value[prop][key];
                            let val = (pz.isObject(item) ? toJSON(item, {}) :
                                (pz.isFunction(item) ? item() : item));
                            res[prop].push(val);
                        });
                    };

                    if (isFunction) {
                        res[prop] = value[prop]();
                    };
                });

                return res;
            };

            return toJSON(viewModel, {});
        },
        binders: {
            'value': {
                priority: 3,
                bind: function () {

                    let isInput = this.el.nodeName == 'INPUT',
                        isOption = this.el.nodeName == 'OPTION',
                        isSelect = this.el.nodeName == 'SELECT',
                        isTextArea = this.el.nodeName == 'TEXTAREA',
                        event, isText, globalScope;

                    if (!isInput && !isOption && !isSelect && !isTextArea) {
                        throw new Error('Value binding is supported only on INPUT, OPTION or SELECT element');
                    };

                    globalScope = pz.getGlobal();
                    event = isInput || isTextArea ? (('oninput' in globalScope) ? 'input' : 'keyup') : 'change';
                    isText = isInput && this.el.type == 'text' || isTextArea;

                    if ((isSelect || isText) && pz.isFunction(this.handler)) {
                        this.el.removeEventListener(event, this.handler, false);
                        this.el.addEventListener(event, this.handler, false);
                        this.event = event;
                    };

                    this.el.removeAttribute(this.bindingAttr);
                },
                react: function () {

                    let isInput = this.el.nodeName == 'INPUT',
                        isSelect = this.el.nodeName == 'SELECT',
                        isTextArea = this.el.nodeName == 'TEXTAREA',
                        isText = isInput && this.el.type == 'text';

                    if (isText || isSelect || isTextArea) {
                        this.el.value = this.getValue();
                    } else {
                        this.el.setAttribute('value', this.getValue());
                    };
                },
                handler: function () {
                    this.setValue(this.el.value);
                },
                unbind: function () {
                    this.el.removeEventListener(this.event, this.handler, false);
                }
            },
            'each': {
                priority: 1,
                block: true,
                bind: function () {

                    if (!this.mark) {
                        this.mark = document.createComment('each:' + this.id);
                        this.el.removeAttribute(this.bindingAttr);
                        this.el.parentNode.insertBefore(this.mark, this.el);
                        this.el.parentNode.removeChild(this.el);
                    };

                    if (!this.views) {
                        this.views = [];
                    };
                },
                react: function () {

                    let value = this.getValue(), template;

                    pz.forEach(this.views, function (view) {
                        view.unbind();
                        pz.forEach(view.els, function (el) {
                            el.parentNode.removeChild(el);
                            el = null;
                        });
                        view.els.splice(0, view.els.length);
                    });

                    this.views.splice(0, this.views.length);

                    pz.forEach(value, function (item, idx) {

                        if (this.alias) {
                            this.rootVm[this.alias] = item;
                        };

                        template = this.el.cloneNode(true);
                        let v = new view(template, this.rootVm, item, idx);
                        v.bind();
                        this.mark.parentNode.insertBefore(template, this.mark);
                        this.views.push(v);
                    }, this);

                    delete this.rootVm[this.alias];
                },
                unbind: function () {
                    pz.forEach(this.views, function (view) {
                        view.unbind();
                    });
                }
            },
            'text': {
                priority: 3,
                bind: function () {
                    this.el.removeAttribute(this.bindingAttr);
                },
                react: function () {
                    let hasInnerText = this.el.hasOwnProperty('innerText');
                    this.el[hasInnerText ? 'innerText' : 'innerHTML'] = this.getValue();
                }
            },
            'if': {
                priority: 2,
                bind: function (val) {
                    let value = val != undefined ? val : this.getValue();
                    this.el.removeAttribute(this.bindingAttr);

                    if (!value && !pz.isEmpty(this.el.parentNode)) {
                        this.el.parentNode.removeChild(this.el);
                    };
                }
            },
            'ifnot': {
                priority: 2,
                bind: function () {
                    let value = this.getValue();
                    pz.binder.binders.if.bind.call(this, !value);
                }
            },
            'visible': {
                priority: 2,
                bind: function () {
                    this.el.removeAttribute(this.bindingAttr);
                },
                react: function (val) {
                    let value = val != undefined ? val : this.getValue();

                    if (this.initialValue == undefined) {
                        this.initialValue = this.el.style.display;
                    };

                    this.el.style.display = (value == true ?
                        (this.initialValue == 'none' ? '' : this.initialValue) : 'none');
                }
            },
            'hidden': {
                bind: function () {
                    pz.binder.binders.visible.bind.call(this);
                },
                react: function () {
                    let value = this.getValue();
                    pz.binder.binders.visible.react.call(this, !value);
                }
            },
            'html': {
                bind: function () {
                    this.el.removeAttribute(this.bindingAttr);
                },
                react: function () {
                    this.el.innerHTML = this.getValue();
                }
            },
            'attr': {
                priority: 2,
                bind: function () {
                    this.el.removeAttribute(this.bindingAttr);
                },
                react: function () {
                    let isClassAttr = (this.attrToBind == 'class');
                    let value = this.getValue();

                    if (isClassAttr && this.el.hasAttribute(this.attrToBind)) {
                        value = (this.el.getAttribute(this.attrToBind) + ' ' + value).trim();
                    };

                    this.el.setAttribute(this.attrToBind, value.toString());
                }
            },
            'checked': {
                bind: function () {
                    this.el.removeEventListener('change', this.handler, false);
                    this.el.addEventListener('change', this.handler, false);
                    this.event = 'change';
                    this.el.removeAttribute(this.bindingAttr);
                },
                react: function () {
                    let isRadio = this.el.type == 'radio',
                        value = this.getValue();

                    if (isRadio) {
                        this.el.checked = value == this.el.value;
                    } else {
                        this.el.checked = value;
                    };
                },
                handler: function () {
                    let isRadio = this.el.type == 'radio';
                    this.setValue((isRadio ? this.el.value : this.el.checked));
                },
                unbind: function () {
                    this.el.removeEventListener(this.event, this.handler, false);
                }
            },
            'enabled': {
                bind: function () {
                    this.el.removeAttribute(this.bindingAttr);
                },
                react: function () {
                    let value = this.getValue();
                    this.el.disabled = !value;
                }
            },
            'options': {
                priority: 1,
                block: true,
                tempAttrs: {
                    val: null,
                    text: null
                },
                bind: function () {

                    this.el.removeAttribute(this.bindingAttr);

                    if (!this.views) {
                        this.views = [];
                    };

                    this.binder.tempAttrs.val = this.binder.tempAttrs.val || this.el.getAttribute('data-optionsvalue');
                    this.binder.tempAttrs.text = this.binder.tempAttrs.text || this.el.getAttribute('data-optionstext');
                    this.el.removeAttribute('data-optionsvalue');
                    this.el.removeAttribute('data-optionstext');
                },
                react: function () {
                    let value = this.getValue();

                    pz.forEach(this.views, function (view) {
                        view.unbind();
                        pz.forEach(view.els, function (el) {
                            el.parentNode.removeChild(el);
                            el = null;
                        });
                        view.els.splice(0, view.els.length);
                    });

                    this.views.splice(0, this.views.length);

                    pz.forEach(value, function (item, idx) {
                        let template = document.createElement('option');
                        template.setAttribute('data-value', this.binder.tempAttrs.val);
                        template.setAttribute('data-text', this.binder.tempAttrs.text);

                        let v = new view(template, this.rootVm, item, idx);
                        v.bind();
                        this.el.appendChild(template);
                        this.views.push(v);
                        template = null;
                    }, this);
                }
            },
            unbind: function () {
                pz.forEach(this.views, function (view) {
                    view.unbind();
                });
            }
        }
    };

};

export default binder;