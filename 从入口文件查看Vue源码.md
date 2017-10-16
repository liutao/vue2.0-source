我们学习阅读一个项目的源码时，首先当然要看它的`package.json`文件。这里面有项目的依赖，有开发环境、生产环境等编译的启动脚本，有项目的许可信息等。别的暂且不说，直接来看`script`。我们发现`Vue.js`有许许多多的`npm`命令。这里我们只看第一个，也就是`npm run dev`所执行的命令。

```JavaScript
"dev": "rollup -w -c build/config.js --environment TARGET:web-full-dev"
```

我们发现这里用到了`rollup`，感兴趣的可以去了解一下，这里它并不是重点，我们只需要知道它是一个类似于`webpack`的打包工具就行了。往后看我们发现它执行了`build/config.js`，前面说过它是一个打包配置的文件，我们看看它里面又做了哪些事儿。

```JavaScript
const builds = {
  ...
  ...
  ...
  // Runtime+compiler development build (Browser)
  'web-full-dev': {
    entry: path.resolve(__dirname, '../src/entries/web-runtime-with-compiler.js'),
    dest: path.resolve(__dirname, '../dist/vue.js'),
    format: 'umd',
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
  ...
  ...
  ...
}

function genConfig (opts) {
  ...
}

if (process.env.TARGET) {
  module.exports = genConfig(builds[process.env.TARGET])
} else {
  exports.getBuild = name => genConfig(builds[name])
  exports.getAllBuilds = () => Object.keys(builds).map(name => genConfig(builds[name]))
}
```

直接看下面，我们看到它调用了`getConfig(builds[process.env.TARGET])`，`getConfig`用于生成`rollup`的配置文件。`builds`是一个对象，获取它的`process.env.TARGET`值，在`package.json`中，我们看到`dev`中有`TARGET:web-full-dev`参数，即上面我留下的那一段配置。这样入口文件我们就找到了，也就是`/src/entries/web-runtime-with-compiler.js`。

既然我们找到了入口，我们就从这里开始我们的`Vue.js`源码之旅。

打开`web-runtime-with-compiler.js`文件，在该文件的第一行，我们看到如下代码：

```JavaScript
import Vue from './web-runtime'
```

即引入了同一目录下的另一文件，本文件中我们只不过在'./web-runtime'导出的`Vue`对象上进行了二次加工而已。

打开`web-runtime`，看第一行代码我们就知道，该文件同理是在'core/index'导出的`Vue`对象上进行了加工。

再次打开`core/index`，发现它又是在`./instance/index`上进行加工的。这也是为什么打包后的文件内，最终返回的是`Vue$3`。整个过程是这样的：

```JavaScript
/src/entries/web-runtime-with-compiler.js   
--> /src/entries/web-runtime.js    
--> /src/core/index.js    
--> /src/core/instance/index.js
```

历经千辛万苦，终于找到了定义`Vue`对象的所在之处。它的构造函数及其简单：

```JavaScript
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
```

首先判断如果是不是生产环境，且不是通过`new`关键字来创建对象的话，就在控制台打印一个`warning`，之后调用了`this._init(options)`函数。

下面的几个函数，分别在`Vue.prototype`原型上绑定了一些实例方法。关于`Vue`的[静态方法](Vue-globals.md)和[实例方法](Vue实例属性.md)，我分别单列出来，这样看起来可以更加清晰。

```JavaScript
// _init
initMixin(Vue)  
// $set、$delete、$watch
stateMixin(Vue)
// $on、$once、$off、$emit
eventsMixin(Vue)
// _update、$forceUpdate、$destroy
lifecycleMixin(Vue)
// $nextTick、_render、以及多个内部调用的方法
renderMixin(Vue)
```

我们沿着刚才所提到的文件引入顺序一步步来看。` /src/core/instance/index.js`执行之后，是`/src/core/index.js`文件。

```JavaScript
initGlobalAPI(Vue)

Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

Vue.version = '__VERSION__'
```

该文件也很简单，首先调用了`initGlobalAPI`，引自`/src/core/global-api/index`。

```JavaScript
export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  Vue.options = Object.create(null)
  // Vue.options.components、Vue.options.directives、Vue.options.filters
  config._assetTypes.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // Vue.options._base
  Vue.options._base = Vue

  // Vue.options.components.KeepAlive
  extend(Vue.options.components, builtInComponents)

  // Vue.use
  initUse(Vue)
  // Vue.mixin
  initMixin(Vue)
  // Vue.extend
  initExtend(Vue)
  // Vue.component、Vue.directive、Vue.filter
  initAssetRegisters(Vue)
}
```

从上面的代码可以看出，它是给`Vue`对象添加了一些静态方法和属性。

`/src/core/index.js`文件中，还添加了一个`Vue.prototype[$isServer]`属性，用于判断是不是服务端渲染，还有一个就是`Vue.version`。

接着是`/src/entries/web-runtime.js`。

```JavaScript
// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// install platform patch function
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}
```

`Vue`代码整体上可以分为两个平台，一个是我们常用的`web`，另一个是`weex`。所以源码里把两个平台不同的内容单独提取出来了。这里我们只谈`web`。

首先，在`Vue.config`上添加了几个平台相关的方法，扩展了`Vue.options.directives`（`model`和`show`）和`Vue.options.components`（`Transition`和`TransitionGroup`)。在`Vue.prototype`上添加了`__patch__`(虚拟dom相关)和`$mount`（挂载元素）。

最后是`/src/entries/web-runtime-with-compiler.js`，该文件主要干了两件事，一个是定义了一个方法`Vue.prototype.$mount`，另一个是将`compileToFunctions`挂在到`Vue.compile`上。

以上，简单且有点儿啰嗦的大体上讲了一下`Vue`源码的结构，接下来，我们从一个小栗子入手。看看`Vue`从创建对象，到挂载，到修改都分别经历了什么。
