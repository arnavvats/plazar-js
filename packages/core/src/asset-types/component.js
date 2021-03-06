﻿import pz from '../core';

const component = () => {

	const _const = {
		tplSourceNotDefined: 'Template source not defined. Please define one of these options in your component config: 1. [template]; 2. [templateSelector]; 3. [ajaxSetup.url];',
		tplContainerNotDefined: 'Template container selector not defined. Please define one of these options in your component config: 1. [renderTo]; 2. [templateSelector]; 3. [renderBefore]; 4. [renderAfter];',
		tplContainerNotFound: 'Template container not found. Please review one of these options in your component config: 1. [renderTo]; 2. [templateSelector]; 3. [renderBefore]; 4. [renderAfter];',
		tplContainerNotFoundWithinComponent: 'Template container not found within parent retrieved via selector: [{0}]. Please review one of these options in your component config: 1. [renderTo]; 2. [templateSelector]; 3. [renderBefore]; 4. [renderAfter];',
		loadingMaskMarkup: '<div class="loading-mask" style="color:#fff;background-color: #fff;position:absolute;top:0;left:0;bottom:0;width:100%;text-align:center;vertical-align:middle;height:100%">'
			.concat('<p style="position: absolute;top:40%;left:41.5%;background-color: #fff;padding: 5px;border: 1px solid #f1f1f1;color: #c0c0c0;z-index:1">loading...</p></div>'),
		addChildParamErr: 'Method [addChild] has been invoked with invalid parameters. Example invocation: 1. parent.addChild({ type: \'myType\' }); 2. parent.addChild(myDefinition)',
		renderBeforeAndAfterDefined: '[renderBefore] and [renderAfter] config can not be defined on the same component.',
		handlerFnNotProvided: 'Handler function was not provided.',
		canNotDestroyComponent: 'You cannot destroy a component with attached pre-rendered template.',
		evArgsMissing: 'Please provide event name and listener.'
	};

	let _get = function (options) {
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function () {
			if (this.readyState == 4) {
				options.success.call(this, {
					request: this,
					data: (options.dataType == 'json' && !pz.isObject(this.responseText) ? pz.toJSON(this.responseText) : this.responseText),
					dataType: options.dataType
				});
			}
		};

		xhr.onerror = options.error;
		xhr.open('GET', options.url, true);
		xhr.send();
	};

	return {
		type: 'component',
		constructor: function () {
			this.isComponentInstance = true;
		},
		replace: false,
		initialized: false,
		animate: false,
		showLoading: false,
		autoLoad: false,
		css: [],
		attrs: [],
		style: '',
		bindViewModel: function () {

			let templateSelectorEmpty;

			if (pz.isEmpty(this.viewModel) || !pz.isFunction(this.applyBindings)) {
				return;
			}

			templateSelectorEmpty = pz.isEmpty(this.templateSelector);
			this.applyBindings();

			if (!templateSelectorEmpty) {
				let tpl = pz.dom.getEl(this.templateSelector);
				pz.dom.replaceWith(tpl, this.html);
				tpl = null;
			}

			this.publish('bindings-complete');
		},
		applyBindings: function () {
			pz.binder.bind(this.html, this.viewModel);
		},
		unapplyBindings: function () {
			pz.binder.unbind(this.viewModel);
		},
		traceUp: function () {
			return pz.isEmpty(this.parentComponent) ? null :
				(!pz.isEmpty(this.parentComponent.$ref) ? this.parentComponent.$ref
					: (pz.isComponent(this.parentComponent) ? this.parentComponent : pz.getInstanceOf(this.parentComponent.id)));
		},
		traceDown: function (value) { // can be type, id or alias if defined on a component
			let children;

			if (pz.isEmpty(this.components)) {
				return null;
			}

			children = this.components.filter(function (childComponent) {
				let conditionOk = childComponent.type == value ||
					childComponent.id == value || childComponent.alias == value;
				return conditionOk;
			}).map(function (childComponent) {
				return pz.getInstanceOf(childComponent.id);
			});

			return children.length == 1 ? children[0] : children;
		},
		load: function () {
			let templateSelectorEmpty = pz.isEmpty(this.templateSelector),
				templateEmpty = pz.isEmpty(this.template),
				urlEmpty = pz.isEmpty(this.ajaxSetup) || pz.isEmpty(this.ajaxSetup.url),
				componentLoaded;

			if (templateEmpty && templateSelectorEmpty && urlEmpty) {
				throw new Error(_const.tplSourceNotDefined);
			}

			if (urlEmpty) {
				this.render();
				return;
			}

			this.showLoadingMask();
			componentLoaded = pz.proxy(function (result) {
				let res = this.ajaxSetup.dataType == 'text' ? {
					template: result.data
				} : result.data;

				this.viewModel = !pz.isEmpty(res.viewModel) ? res.viewModel :
					this.viewModel;
				this.template = !pz.isEmpty(res.template) ? res.template :
					pz.dom.getEl(this.templateSelector).outerHTML;
				this.publish('load-complete');
				this.render();
			}, this);

			_get({
				url: this.ajaxSetup.url,
				dataType: (this.ajaxSetup.dataType || 'json'),
				success: componentLoaded,
				error: function (e) {
					console.log(e);
				}
			});

			componentLoaded = null;
		},
		render: function () {
			let templateSelectorEmpty = pz.isEmpty(this.templateSelector), me = this,
				renderToDefined, container, child, childDomIdx, renderBeforeDefined,
				renderAfterDefined, siblingContainer, insertBeforeOrAfter, containerSelector, isChild, containerErr,
				scriptTags;

			this.html = !templateSelectorEmpty ? pz.dom.getEl(this.templateSelector) :
				pz.dom.clone(pz.dom.parseTemplate(this.template)), me = this;
			this.addAttr({
				name: 'data-componentId',
				value: this.id
			});
			this.addCss(this.css);
			this.addAttr(this.attrs);
			this.addStyle(this.style);

			if (!templateSelectorEmpty) {
				this.init();
				return;
			}

			scriptTags = pz.dom.findElement(this.html, 'script', true);
			scriptTags = !pz.isEmpty(scriptTags) ? (pz.isNodeList(scriptTags) ? scriptTags : [scriptTags]) : [];
			pz.forEach(scriptTags, tag => {
				pz.dom.remove(tag);
				console.warn('Script tags are not allowed in inline templates. The following tag has been removed: ' + tag.outerHTML);
				tag = null;
			});

			renderToDefined = !pz.isEmpty(this.renderTo);
			renderAfterDefined = !pz.isEmpty(this.renderAfter);
			renderBeforeDefined = !pz.isEmpty(this.renderBefore);

			if (!renderToDefined && !renderAfterDefined && !renderBeforeDefined) {
				throw new Error(_const.tplContainerNotDefined);
			}

			isChild = !pz.isEmpty(this.parentComponent);
			containerSelector = (isChild ? pz.str.format('{0} {1}', this.renderTo, ((renderBeforeDefined ? this.renderBefore : this.renderAfter) || '')).trim() :
				(renderToDefined ? this.renderTo : (renderBeforeDefined ? this.renderBefore : this.renderAfter)));
			container = pz.dom.getEl(containerSelector);

			if (pz.isEmpty(container)) {
				containerErr = (isChild ? pz.str.format(_const.tplContainerNotFoundWithinComponent, containerSelector.split(']').pop().trim()) :
					_const.tplContainerNotFound);
				throw new Error(containerErr);
			}

			insertBeforeOrAfter = function (selector, method) {
				let parent = me.traceUp();
				let rootEl = !pz.isEmpty(parent) ? parent.html : document;
				siblingContainer = pz.dom.getEl(selector, { rootEl: rootEl, all: false });
				pz.dom[method](siblingContainer, me.html);
				me.html = pz.dom.getEl('*[data-componentid="' + me.id + '"]', { // get the dom reference since we will inject html string
					rootEl: rootEl, all: false
				});
			};

			if (renderBeforeDefined) {
				insertBeforeOrAfter(containerSelector, 'insertBefore');
			} else if (renderAfterDefined) {
				insertBeforeOrAfter(containerSelector, 'insertAfter');
			} else if (!pz.isEmpty(this.insertAt)) {
				child = this.traceUp().childAt(this.insertAt);
				childDomIdx = pz.isEmpty(child) ? 0 : pz.dom.indexOf(child.html);
				pz.dom.insertAt(container, this.html, childDomIdx);
			} else {
				pz.dom[this.replace ? 'replaceWith' : 'append'](container, this.html);
			}

			this.publish('render-complete');
			this.init();
		},
		init: function () {

			let me = this, childrenToInitialize;
			this.bindViewModel();

			if (!pz.isEmpty(this.handlers)) {
				pz.forEach(this.handlers, function (handler) {
					me.handle(handler);
				});
			}

			this.hideLoadingMask();
			this.initialized = true;
			this.publish('init-complete');

			if (!pz.isEmpty(this.components)) {
				childrenToInitialize = this.components.reduce(function (acc, cmpRef, idx) {
					let cmp = pz.isEmpty(cmpRef.id) ? null : me.traceDown(cmpRef.id);
					let needInitialization = pz.isEmpty(cmp) || !cmp.initialized;
					if (needInitialization) {
						acc.push({
							index: idx,
							component: cmpRef
						});
					}
					return acc;
				}, []);

				pz.forEach(childrenToInitialize, function (item) {
					item.component.$replace = true;
					me.addChild(item.component, item.index);
				});

				childrenToInitialize = null;
			}

			if (!pz.isEmpty(this.parentComponent) && !pz.isEmpty(this.parentComponent.ref)) {
				this.parentComponent.$ref = null;
				delete this.parentComponent.$ref;
			}
		},
		subscribe: function (name, listener) {
			let subscription;
			if (pz.isEmpty(name) || pz.isObject(listener)) {
				throw new Error(_const.evArgsMissing);
			}

			if (pz.isEmpty(this.subscriptions)) {
				this.subscriptions = [];
			}

			subscription = pz.events.subscribe(name, listener);
			this.subscriptions.push(subscription);
			return subscription;
		},
		publish: function (name, params) {
			pz.events.publish(name, params);
		},
		addChild: function (child, index) {

			let hasChildren, parentSelector, instance, childReference, renderTo,
				replace = child.$replace, isValidObj = pz.isObject(child) && !(pz.isEmpty(child) || pz.isEmpty(child.type)),
				isValidFn = pz.isPzDefinition(child),
				isComponent = pz.isComponent(child);

			if (!isValidObj && !isValidFn && !isComponent) {
				throw new Error(_const.addChildParamErr);
			}

			delete child.$replace;
			parentSelector = '*[data-componentid="' + this.id + '"]';

			child.autoLoad = false; // prevent auto load since we might be missing [renderTo] from config
			instance = isValidFn ? child.create() : (isComponent ? child : pz.create(child));
			renderTo = child.renderTo || instance.renderTo;

			instance.renderTo = pz.isEmpty(renderTo) ?
				parentSelector.concat(!pz.isEmpty(this.containerElement) ? ' ' + this.containerElement : '') :
				(renderTo == 'root' ? parentSelector : parentSelector.concat(' ').concat(renderTo));

			instance.parentComponent = {
				type: this.type,
				id: this.id
			};

			if ((!pz.isEmpty(instance.renderAfter) || !pz.isEmpty(instance.renderBefore))) {
				instance.parentComponent.$ref = this;
			}

			if (!pz.isEmpty(index) && !replace) {
				instance.insertAt = index;
			}

			if (!instance.autoLoad) {
				instance.load();
			}

			hasChildren = !pz.isEmpty(this.components);
			if (!hasChildren) {
				this.components = [];
			}

			childReference = {
				type: instance.type,
				id: instance.id
			};

			if (!pz.isEmpty(instance.alias)) {
				childReference.alias = instance.alias;
			}

			if (!pz.isEmpty(index)) {
				this.components.splice(index, (replace ? 1 : 0), childReference);
			} else {
				this.components.push(childReference);
			}

			childReference = null;
			return instance;
		},
		handle: function (handler) {
			let me = this, fn = pz.isFunction(handler.fn) ? handler.fn : me[handler.fn],
				selector, args;
			if (pz.isEmpty(fn)) {
				throw new Error(_const.handlerFnNotProvided);
			}

			selector = !pz.isEmpty(handler.selector) ? handler.selector :
				(pz.str.format('{0}[{1}\"{2}\"]', this.html.tagName, 'data-componentid=', this.id));
			args = [handler.on, me.html, selector, pz.proxy(fn, handler.scope || me)];
			pz.dom.on.apply(pz.dom, args);
			handler = null;
		},
		showLoadingMask: function () {
			let renderToDefined = !pz.isEmpty(this.renderTo), container;
			if (!this.showLoading) {
				return;
			}

			container = this.html;
			if (pz.isEmpty(container)) {
				container = renderToDefined ? pz.dom.getEl(this.renderTo) : pz.dom.getEl(this.templateSelector);
			}

			if (!pz.isEmpty(container)) {
				pz.dom.append(container, _const.loadingMaskMarkup);
			}
			container = null;
		},
		hideLoadingMask: function () {
			let renderToDefined = !pz.isEmpty(this.renderTo), container, mask;
			if (!this.showLoading) {
				return;
			}

			container = this.html;
			if (pz.isEmpty(container)) {
				container = renderToDefined ? pz.dom.getEl(this.renderTo) : pz.dom.getEl(this.templateSelector);
			}

			if (!pz.isEmpty(container)) {
				mask = pz.dom.findElement(container, 'div.loading-mask');
				if (!pz.isEmpty(mask)) {
					pz.dom.remove(mask);
					mask = null;
				}
			}

			container = null;
		},
		lastChild: function () {

			if (pz.isEmpty(this.components)) {
				return null;
			}

			return this.childAt(this.components.length - 1);
		},
		firstChild: function () {
			return this.childAt(0);
		},
		childAt: function (index) {
			let childRef, childComponent;
			if (pz.isEmpty(this.components) || pz.isEmpty(index)) {
				return null;
			}

			childRef = this.components[index];

			if (pz.isEmpty(childRef)) {
				return null;
			}

			childComponent = pz.getInstanceOf(childRef.id);
			return childComponent || null;
		},
		removeChild: function (component, destroy) {

			let doDestroy, compIndex;
			if (pz.isEmpty(component)) {
				return;
			}

			doDestroy = pz.isEmpty(destroy) ? true : destroy;
			compIndex = this.childIndex(component);

			if (doDestroy) {
				component.destroy();
			}

			if (compIndex != -1) {
				this.components.splice(compIndex, 1);
			}

			component = null;
		},
		childCount: function () {
			return pz.isEmpty(this.components) ? 0 : this.components.length;
		},
		childIndex: function (component) {
			let resultIdx = -1;
			if (pz.isEmpty(component)) {
				return resultIdx;
			}

			pz.find(function (child, idx) {
				if (child.id == component.id) {
					resultIdx = idx;
				}

				return child.id == component.id;
			}, this.components);

			return resultIdx;
		},
		destroy: function () {
			let parent;

			if (!pz.isEmpty(this.templateSelector)) {
				throw new Error(_const.canNotDestroyComponent);
			}

			this.publish('before-destroy');
			this.destroyChildren();
			pz.dom.off(this.html);
			if (!pz.isEmpty(this.viewModel)) {
				this.unapplyBindings();
			}
			pz.dom.remove(this.html);
			this.html = null;
			this.viewModel = null;
			pz.arr.clear(this.components);
			this.components = null;
			pz.arr.clear(this.handlers);
			this.handlers = null;
			this.mixins = null;
			pz.forEach(this.subscriptions, function (subscription) {
				subscription.remove();
			});
			pz.arr.clear(this.subscriptions);
			this.subscriptions = null;
			parent = this.traceUp();
			if (!pz.isEmpty(parent)) {
				parent.removeChild(this, false);
			}
			this.destroyed = true;
			this.base(arguments);
			this.publish('destroy-complete');
		},
		destroyChildren: function () {
			let child, instance;
			while (!pz.isEmpty(this.components) &&
				((child = this.components[0]) != null) && !pz.isEmpty(child.id)) {

				instance = (pz.isFunction(child.destroy) ? child : pz.getInstanceOf(child.id));
				instance.destroy();
				instance = null;
			}
		},
		addCss: function (value, el) {

			let isArray, hasClasses, html, cls;
			if (pz.isEmpty(value)) {
				return;
			}

			html = pz.isEmpty(el) ? this.html : (pz.isString(el) ?
				pz.dom.findElement(this.html, el) : el);

			if (pz.isEmpty(html)) {
				return;
			}

			isArray = pz.isArray(value);
			hasClasses = !pz.isEmpty(html.className);

			cls = isArray ? value.join(' ') : value;
			html.className += (hasClasses ? (' ' + cls) : cls);
		},
		addStyle: function (value, el) {
			let isArray, hasStyle, html, style;
			if (pz.isEmpty(value)) {
				return;
			}

			html = pz.isEmpty(el) ? this.html : (pz.isString(el) ?
				pz.dom.findElement(this.html, el) : el);

			if (pz.isEmpty(html)) {
				return;
			}

			isArray = pz.isArray(value);
			hasStyle = !pz.isEmpty(html.style.cssText);

			style = isArray ? value.join(' ') : value;
			html.style.cssText += (hasStyle ? (' ' + style) : style);
		},
		addAttr: function (value, el) {
			let html, isArray, val;
			if (pz.isEmpty(value)) {
				return;
			}

			html = pz.isEmpty(el) ? this.html : (pz.isString(el) ?
				pz.dom.findElement(this.html, el) : el);

			if (pz.isEmpty(html)) {
				return;
			}

			isArray = pz.isArray(value);
			val = isArray ? value : [value];

			pz.forEach(val, function (attr) {
				html.setAttribute(attr.name, attr.value);
			});

			val = null;
		},
		clearHtml: function () {
			pz.forEach(this.html.childNodes, function (child) {
				pz.dom.remove(child);
			}, this);
		}
	};
};

export default component;