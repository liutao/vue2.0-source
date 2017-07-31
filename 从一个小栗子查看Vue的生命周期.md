既然是源码分析，所以大家最好对着源码，一步一步来看。本篇文章，旨在通过一个简单的小栗子，带着大家从`vm`创建，到显示到页面上都经历了哪些过程。

例子如下：

```HTML
<div id="app">
  <p>{{message}}</p>
</div>
<script type="text/javascript">
  var vm = new Vue({
    el: '#app',
    data: {
      message: '第一个vue实例'
    }
  })
</script>
```
创建对象，当然要从构造函数看起，构造函数在`src/core/instance/index.js`中。

```JavaScript
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
```

我们看到，它首先判断了是不是通过`new`关键词创建，然后调用了`this._init(options)`。`_init`函数是在`src/core/instance/init.js`中添加的。我们先把整个函数都拿出来，然后看看每一步都做了什么。

## `this._init`

```JavaScript
 Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    // 性能统计相关
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-init:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // 内部使用Vnode部分使用
      initInternalComponent(vm, options)
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    // 性能相关
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
 }
```

首先一进来，我们给当前`vm`添加了一个唯一的`_uid`，然后`vm._isVue`设为`true`（监听对象变化时用于过滤vm）。

`_isComponent`是内部创建子组件时才会添加为`true`的属性，我们的小栗子会直接走到了`else`里面。`mergeOptions`用于合并两个对象，不同于`Object.assign`的简单合并，它还对数据还进行了一系列的操作，且源码中多处用到该方法，所以后面会详细讲解这个方法。`resolveConstructorOptions`方法在[Vue.extend](Vue.extend.md)中做了详细的解释，它的作用是合并构造器及构造器父级上定义的`options`。

```JavaScript
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // 有super属性，说明Ctor是通过Vue.extend()方法创建的子类
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

```

这里的`Ctor`就是`vm.constructor`也就是`Vue`对象，在上一篇文章中，其实我们提到过，在`/src/core/global-api/index`文件中，我们给`Vue`添加了一些全局的属性或方法。

```JavaScript
Vue.options = Object.create(null)
// Vue.options.components、Vue.options.directives、Vue.options.filters
config._assetTypes.forEach(type => {
  Vue.options[type + 's'] = Object.create(null)
})

// Vue.options._base
Vue.options._base = Vue

// Vue.options.components.KeepAlive
extend(Vue.options.components, builtInComponents)
```

所以，这里打印一下`Ctor.options`，如下所示：

```JavaScript
Ctor.options = {
  components: {
    KeepAlive,
    Transition,
    TransitionGroup
  },
  directives: {
    model,
    show
  },
  filters: {},
  _base: Vue
}
```

`Ctor.super`是在调用`Vue.extend`时，才会添加的属性，这里先直接跳过。所以`mergeOptions`的第一个参数就是上面的`Ctor.options`，第二个参数是我们传入的`options`，第三个参数是当前对象`vm`。

## `mergeOptions`

`mergeOptions`是`Vue`中处理属性的合并策略的地方。

```JavaScript
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  if (process.env.NODE_ENV !== 'production') {
  	// 如果有options.components，则判断是否组件名是否合法
    checkComponents(child)
  }
  // 格式化child的props
  normalizeProps(child)
  // 格式化child的directives
  normalizeDirectives(child)
  // options.extends
  const extendsFrom = child.extends 
  if (extendsFrom) {
    parent = typeof extendsFrom === 'function'
      ? mergeOptions(parent, extendsFrom.options, vm)
      : mergeOptions(parent, extendsFrom, vm)
  }
  // options.mixins
  if (child.mixins) { 
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      let mixin = child.mixins[i]
      if (mixin.prototype instanceof Vue) {
        mixin = mixin.options
      }
      parent = mergeOptions(parent, mixin, vm)
    }
  }
  const options = {}
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}
```

前面和`components`、`props`、`directives`、`extends`、`mixins`相关的内容我们暂且忽略，我们知道`Vue`提供了配置[`optionMergeStrategies`](https://cn.vuejs.org/v2/api/#optionMergeStrategies)对象，来让我们手动去控制属性的合并策略，这里的`strats[key]`就是`key`属性的合并方法。

```JavaScript
function mergeAssets (parentVal: ?Object, childVal: ?Object): Object {
  const res = Object.create(parentVal || null)
  return childVal
    ? extend(res, childVal)
    : res
}

config._assetTypes.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})
```

`_assetTypes`就是`components`、`directives`、`filters`，这三个的合并策略都一样，这里我们都返回了`parentVal`的一个子对象。

`data`属性的合并策略，是也是`Vue`内置的，如下：

```JavaScript
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    if (!childVal) {
      return parentVal
    }
    if (typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    return function mergedDataFn () {
      return mergeData(
        childVal.call(this),
        parentVal.call(this)
      )
    }
  } else if (parentVal || childVal) {
    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm)
        : undefined
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}
```
这里`vm`且`data`都不为空，所以会走到`else if`，返回的是`mergedInstanceDataFn`方法。关于`mergedInstanceDataFn`方法，我们都知道，子组件中定义`data`时，必须是一个函数，这里简单的判断了是函数就执行，不是就返回自身的值。然后通过`mergeData`去合并，其实就是递归把`defaultData`合并到`instanceData`，并观察。

最后合并之后的`vm.$option`如下：

```JavaScript
vm.$option = {
  components: {
    KeepAlive,
    Transition,
    TransitionGroup
  },
  directives: {
    model,
    show
  },
  filters: {},
  _base: Vue,
  el: '#app',
  data: function mergedInstanceDataFn(){}
}
```

回到我们的`_init`接着放下看，之后如果是开发环境，则`vm._renderProxy`值为一个`Proxy`代理对象，生产环境就是`vm`自身，这里不展开赘述。

接着就是一系列的操作，我们一个一个来看。

## `initLifecycle(vm)`

```JavaScript
export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }

  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  vm.$children = []
  vm.$refs = {}

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}
```
该方法比较简单，主要就是给`vm`对象添加了`$parent`、`$root`、`$children`属性，以及一些其它的生命周期相关的标识。

`options.abstract`用于判断是否是抽象组件，组件的父子关系建立会跳过抽象组件，抽象组件比如`keep-alive`、`transition`等。所有的子组件`$root`都指向顶级组件。

## `initEvents(vm)`

```JavaScript
export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}
```
该方法初始化事件相关的属性，_parentListeners`是父组件中绑定在自定义标签上的事件，供子组件处理。`

## `initRender(vm)`

```JavaScript
export function initRender (vm: Component) {
  vm.$vnode = null 
  vm._vnode = null 
  vm._staticTrees = null
  const parentVnode = vm.$options._parentVnode
  const renderContext = parentVnode && parentVnode.context
  vm.$slots = resolveSlots(vm.$options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject

  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)

  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
}
```
这里给`vm`添加了一些虚拟dom、`slot`等相关的属性和方法。

然后会调用`beforeCreate`钩子函数。

## `initInjections(vm)`和`initProvide(vm)`

```JavaScript
export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

export function initInjections (vm: Component) {
  const inject: any = vm.$options.inject
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    // isArray here
    const isArray = Array.isArray(inject)
    const keys = isArray
      ? inject
      : hasSymbol
        ? Reflect.ownKeys(inject)
        : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const provideKey = isArray ? key : inject[key]
      let source = vm
      while (source) {
        if (source._provided && provideKey in source._provided) {
          if (process.env.NODE_ENV !== 'production') {
            defineReactive(vm, key, source._provided[provideKey], () => {
              warn(
                `Avoid mutating an injected value directly since the changes will be ` +
                `overwritten whenever the provided component re-renders. ` +
                `injection being mutated: "${key}"`,
                vm
              )
            })
          } else {
            defineReactive(vm, key, source._provided[provideKey])
          }
          break
        }
        source = source.$parent
      }
    }
  }
}
```
这两个配套使用，用于将父组件`_provided`中定义的值，通过`inject`注入到子组件，且这些属性不会被观察。简单的例子如下：

```HTML
<div id="app">
	<p>{{message}}</p>
	<child></child>
</div>
<script type="text/javascript">
	var vm = new Vue({
		el: '#app',
		data: {
			message: '第一个vue实例'
		},
		components: {
			child: {
				template: "<div>{{a}}</div>",
				inject: ['a']
			}
		},
		provide: {
			a: 'a'
		}
	})
</script>
```

## `initState(vm)`

```JavaScript
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch) initWatch(vm, opts.watch)
}
```
这里主要就是操作数据了，`props`、`methods`、`data`、`computed`、`watch`，从这里开始就涉及到了`Observer`、`Dep`和`Watcher`，网上讲解双向绑定的文章很多，之后我也会单独去讲解这一块。而且，这里对数据操作也比较多，在讲完双向绑定的内容后，有时间我们再来说一说`Vue`对我们传入的数据都进行了什么操作。

到这一步，我们看看我们的`vm`对象变成了什么样：

```JavaScript
// _init
vm._uid = 0
vm._isVue = true
vm.$options = {
    components: {
		KeepAlive,
		Transition,
		TransitionGroup
	},
	directives: {
		model,
		show
	},
	filters: {},
	_base: Vue,
	el: '#app',
	data: function mergedInstanceDataFn(){}
}
vm._renderProxy = vm
vm._self = vm

// initLifecycle
vm.$parent = parent
vm.$root = parent ? parent.$root : vm

vm.$children = []
vm.$refs = {}

vm._watcher = null
vm._inactive = null
vm._directInactive = false
vm._isMounted = false
vm._isDestroyed = false
vm._isBeingDestroyed = false

// initEvents	
vm._events = Object.create(null)
vm._hasHookEvent = false

// initRender
vm.$vnode = null
vm._vnode = null
vm._staticTrees = null
vm.$slots = resolveSlots(vm.$options._renderChildren, renderContext)
vm.$scopedSlots = emptyObject

vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)

vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
// 在 initState 中添加的属性
vm._watchers = []
vm._data
vm.message
```

然后，就会调用我们的`created`钩子函数。

我们看到`create`阶段，基本就是对传入数据的格式化、数据的双向绑定、以及一些属性的初始化。

## `$mount`

打开`src/entries/web-runtime-with-compiler.js`。

```JavaScript
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)
  const options = this.$options
  // resolve template/el and convert to render function
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    if (template) {

      const { render, staticRenderFns } = compileToFunctions(template, {
        shouldDecodeNewlines,
        delimiters: options.delimiters
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns
    }
  }
  return mount.call(this, el, hydrating)
}

function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}
```

首先，通过`mount = Vue.prototype.$mount`保存之前定义的`$mount`方法，然后重写。

这里的`query`可以理解为`document.querySelector`，只不过内部判断了一下`el`是不是字符串，不是的话就直接返回，所以我们的`el`也可以直接传入dom元素。

之后判断是否有`render`函数，如果有就不做处理直接执行`mount.call(this, el, hydrating)`。如果没有`render`函数，则获取`template`，`template`可以是`#id`、模板字符串、dom元素，如果没有`template`，则获取`el`以及其子内容作为模板。

`compileToFunctions`是对我们最后生成的模板进行解析，生成`render`。这里的内容也比较多，简单说一下：

该方法创建的地方在`src/compiler/index.js`的`createCompiler`中。

```JavaScript
function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  const ast = parse(template.trim(), options)
  optimize(ast, options)
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
}


export function createCompiler (baseOptions: CompilerOptions) {
  const functionCompileCache: {
    [key: string]: CompiledFunctionResult;
  } = Object.create(null)

  function compile (
    template: string,
    options?: CompilerOptions
  ): CompiledResult {
  	...
    const compiled = baseCompile(template, finalOptions)
    ...
    return compiled
  }

  function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    options = options || {}
    ...
    // compile
    const compiled = compile(template, options)
    ...
    return (functionCompileCache[key] = res)
  }

  return {
    compile,
    compileToFunctions
  }
}
```

`compileToFunctions`中调用了`compile`，`compile`中调用了`baseCompile`。主要的操作就是`baseCompile`中的三步。

第一步，` const ast = parse(template.trim(), options)`。这里是解析`template`，生成ast。我们的例子生成的`ast`如下：

```JavaScript
{
  type: 1,
  tag: 'div',
  plain: false,
  parent: undefined,
  attrs: [{name:'id', value: '"app"'}],
  attrsList: [{name:'id', value: 'app'}],
  attrsMap: {id: 'app'},
  children: [{
    type: 1,
    tag: 'p',
    plain: true,
    parent: ast,
    attrs: [],
    attrsList: [],
    attrsMap: {},
    children: [{
      expression: "_s(message)",
      text: "{{message}}",
      type: 2
    }]
}
```
第二步，`optimize(ast, options)`主要是对ast进行优化，分析出静态不变的内容部分，增加了部分属性：

```JavaScript
{
  type: 1,
  tag: 'div',
  plain: false,
  parent: undefined,
  attrs: [{name:'id', value: '"app"'}],
  attrsList: [{name:'id', value: 'app'}],
  attrsMap: {id: 'app'},
  static: false,
  staticRoot: false,
  children: [{
    type: 1,
    tag: 'p',
    plain: true,
    parent: ast,
    attrs: [],
    attrsList: [],
    attrsMap: {},
    static: false,
    staticRoot: false,
    children: [{
      expression: "_s(message)",
      text: "{{message}}",
      type: 2,
      static: false
    }]
  }
```
因为我们这里只有一个动态的`{{message}}`，所以`static`和`staticRoot`都是`false`。

最后一步，`code = generate(ast, options)`，就是根据ast生成`render`函数和`staticRenderFns`数组。

最后生成的`render`如下：

```JavaScript
render = function () {
	with(this){return _c('div',{attrs:{"id":"app"}},[_c('p',[_v(_s(message))])])}
}
```

在`src/core/instance/render.js`中，我们曾经添加过如下多个函数，这里和`render`内返回值调用一一对应。

```JavaScript
Vue.prototype._o = markOnce
Vue.prototype._n = toNumber
Vue.prototype._s = _toString
Vue.prototype._l = renderList
Vue.prototype._t = renderSlot
Vue.prototype._q = looseEqual
Vue.prototype._i = looseIndexOf
Vue.prototype._m = renderStatic
Vue.prototype._f = resolveFilter
Vue.prototype._k = checkKeyCodes
Vue.prototype._b = bindObjectProps
Vue.prototype._v = createTextVNode
Vue.prototype._e = createEmptyVNode
Vue.prototype._u = resolveScopedSlots
```

这里的`staticRenderFns`目前是一个空数组，其实它是用来保存`template`中，静态内容的`render`，比如我们把例子中的模板改为:

```HTML
<div id="app">
	<p>这是<span>静态内容</span></p>
	<p>{{message}}</p>
</div>
```

`staticRenderFns`就会变为：

```JavaScript
staticRenderFns = function () {
	with(this){return _c('p',[_v("这是"),_c('span',[_v("静态内容")])])}
}
```

从上面的内容，我们可以知道其实`template`最终还是转换为`render`函数，这也是官方文档中所说的`render`函数更加底层。

前面保存了`mount = Vue.prototype.$mount`，最后又调用了`mount`方法，我们来看看它干了什么。

打开`src/entries/web-runtime.js`。

```JavaScript
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}
```

## `mountComponent`

这里仅仅是返回了`mountComponent`的执行结果，跟着代码的步伐，我们又回到了`src/core/instance/lifecycle.js`。

```JavaScript
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el
  ...
  callHook(vm, 'beforeMount')

  let updateComponent = () => {
    vm._update(vm._render(), hydrating)
  }

  vm._watcher = new Watcher(vm, updateComponent, noop)
  hydrating = false

  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}
```

上面的代码我简单的做了一些精简。可以看到首先调用了`beforeMount`钩子函数，新建了一个`Watcher`对象，绑定在`vm._watcher`上，之后就是判断如果`vm.$vnode == null`，则设置`vm._isMounted = true`并调用`mounted`钩子函数，最后返回`vm`对象。

感觉上似乎有头没尾似得。这里就又不得不提`Watcher`了，先简单概述一下。

打开`src/core/observer/watcher.js`

```JavaScript
constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    this.vm = vm
    vm._watchers.push(this)
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    ...
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''

    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  get () {
    pushTarget(this)
    let value
    const vm = this.vm
    if (this.user) {
      try {
        value = this.getter.call(vm, vm)
      } catch (e) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      }
    } else {
      value = this.getter.call(vm, vm)
    }

    if (this.deep) {
      traverse(value)
    }
    popTarget()
    this.cleanupDeps()
    return value
  }

```
在构造函数中，我们会把`expOrFn`也就是`updateComponent`赋值给`this.getter`，并且在获取`this.value`的值时会调用`this.get()`，这里的`this.lazy`默认值是`false`，在`computed`属性中创建的`Watcher`会传入`true`。

在`this.get()`中，我们会调用`this.getter`，所以上面的例子中，`updateComponent`方法会被调用，所以接下来沿着`updateComponent`再一路找下去。

## `vm._render`

`updateComponent`中调用了`vm._render()`函数，该方法在`src/core/instance/render.js`中。

```JavaScript
Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const {
      render,
      staticRenderFns,
      _parentVnode
    } = vm.$options
 
 	...
    if (staticRenderFns && !vm._staticTrees) {
      vm._staticTrees = []
    }

    vm.$vnode = _parentVnode
    // render self
    let vnode
      
    vnode = render.call(vm._renderProxy, vm.$createElement)
   	...

    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    vnode.parent = _parentVnode
    return vnode
  }
```
在该方法中，其实主要就是调用了`vm.$options.render`方法，我们再拿出`render`方法，看看它都干了什么。

```JavaScript
render = function () {
	with(this){return _c('div',{attrs:{"id":"app"}},[_c('p',[_v(_s(message))])])}
}
```

函数调用过程中的`this`，是`vm._renderProxy`，是一个`Proxy`代理对象或`vm`本身。我们暂且把它当做`vm`本身。

`_c`是`(a, b, c, d) => createElement(vm, a, b, c, d, false)`。我们简单说一下`createElement`干了什么。`a`是要创建的标签名，这里是`div`。接着`b`是`data`，也就是模板解析时，添加到`div`上的属性等。`c`是子元素数组，所以这里又调用了`_c`来创建一个`p`标签。

`_v`是`createTextVNode`，也就是创建一个文本结点。`_s`是`_toString`，也就是把`message`转换为字符串，在这里，因为有`with(this)`，所以`message`传入的就是我们`data`中定义的`第一个vue实例`。

所以，从上面可以看出，`render`函数返回的是一个`VNode`对象，也就是我们的虚拟dom对象。它的返回值，将作为`vm._update`的第一个参数。我们接着看该函数，返回`src/core/instance/lifecycle.js`

## `vm._update`

```JavaScript
Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    activeInstance = vm
    vm._vnode = vnode
    
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
    } else {
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    activeInstance = prevActiveInstance
    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
  }
```

从`mountComponent`中我们知道创建`Watcher`对象先于`vm._isMounted = true`。所以这里的`vm._isMounted`还是`false`，不会调用`beforeUpdate`钩子函数。

下面会调用`vm.__patch__`，在这一步之前，页面的dom还没有真正渲染。该方法包括真实dom的创建、虚拟dom的diff修改、dom的销毁等，具体细节且等之后满满分析。

至此，一个`Vue`对象的创建到显示到页面上的流程基本介绍完了。有问题欢迎吐槽~