本篇文章，我们讲的是`VNode`对象的一个基本组成，以及与创建`VNode`相关的一些函数。

经过`compile`编译模板字符串变成了`render`函数，在`src/core/instance/render.js`中，我们通过`vnode = render.call(vm._renderProxy, vm.$createElement)`调用了`render`方法并最终返回了一个`VNode`对象实例。`VNode`其实就是我们所说的虚拟dom，接下来我们一步步来揭开它的神秘面纱。

## `VNode`的基本构造

`VNode`的构造函数是在`src/core/vdom/vnode.js`中，该文件主要定义了`VNode`对象包含的基本数据都有哪些。同时还定义了几个比较简单的创建特殊`VNode`对象的方法。

我们先来看看它的基本组成：

```JavaScript
export default class VNode {
  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.functionalContext = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}
```

构造函数可以接收的参数最多有七个，分别是`tag`标签名、`data`结点相关数据、`children`子结点对象数组、`text`文本内容、`elm`原生结点元素、`context`指当前元素所在的`Vue`实例、`componentOptions`保存自定义组件上部分组件属性。

我们看到它内部还有许许多多的属性，这些值我会在[VNode](VNode.md)中，说明每个的含义。



## `createElement`

在我们的`src/core/instance/render.js`文件中，有两个函数内部调用的都是`createElement`方法。

```JavaScript
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
```

`vm._c`是我们编译模板生成的`render`函数执行时调用的，而`vm.$createElement`是我们自己编写`render`函数时，作为参数传递给`render`函数，见如下代码：

```JavaScript
 vnode = render.call(vm._renderProxy, vm.$createElement)
```

我们就来看看`createElement`做了什么事儿

```JavaScript
const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

export function createElement (
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode {
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  if (alwaysNormalize) normalizationType = ALWAYS_NORMALIZE
  return _createElement(context, tag, data, children, normalizationType)
}
```

`createElement`接收六个参数，第一个是当前的`vm`对象，第二个是标签名，第三个是结点相关的属性，第四个是子元素，第五个是子元素归一化的处理的级别，最后一个表示总是归一化处理。我们注意到内部调用的`vm._c`最后一个参数传入的是`false`，而`vm.$createElement`传入的是`true`，说明自定义的`render`函数总是对子元素进行归一化处理。

`Array.isArray(data) || isPrimitive(data)`如果返回`true`，说明该元素没有相关的属性，此时第三个参数实际上是`children`的值，所以后面的值依次向前移动。

`if (alwaysNormalize) normalizationType = ALWAYS_NORMALIZE`说明`vm.$createElement`会对子元素进行最高级的归一化处理。

最后调用了内部的`_createElement`方法，参数一眼明了。

### `_createElement`

```JavaScript
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode {
  ...
  if (!tag) {
    return createEmptyVNode()
  }
  if (Array.isArray(children) &&
      typeof children[0] === 'function') {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }
  let vnode, ns
  if (typeof tag === 'string') {
    let Ctor
    ns = config.getTagNamespace(tag)
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    } else if ((Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }
  if (vnode) {
    if (ns) applyNS(vnode, ns)
    return vnode
  } else {
    return createEmptyVNode()
  }
}
```

首先判断`tag`是不是为空，如果为空则直接返回一个空的`VNode`。

接着如果子元素只有一个函数，则作为默认的`slot`，由于`slot`涉及到了从模板解析到渲染页面的整个过程，内容比较多，之后我会单独写一篇文章讲解相关内容。

之后就是对子元素进行归一化，在[children的归一化处理](children的归一化处理.md)中我们已经讲解了它的处理逻辑。

后面就是创建`VNode`对象的主要内容了：

1、如果`tag`是字符串，且是平台保留标签名。则直接创建`VNode`对象。

2、否则如果`tag`是字符串，则执行`resolveAsset(context.$options, 'components', tag)`。

看一眼`resolveAsset`的实现：

```JavaScript
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  ...
  const assets = options[type]
  
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  ...
  return res
}
```

其实这里处理的是我们自定义的组件，例如：

```JavaScript
<div id="app">
  <my-component></my-component>
</div>
<script type="text/javascript">
  var vm = new Vue({
    el: '#app',
    components: {
      'my-component': {
        render: function(h){
          return h('div', "test");
        }
      }
    }
  });
</script>
```

当前解析的正是我们自定义的`my-component`，`resolveAsset`方法其实就是获取`context.$options.components`中`my-component`所对应的值，从上面的代码我们也可以看出，这里的'my-component'可以是`myComponent`，也可以是`MyComponent`，我们的`Vue`都可以正常解析。

如果返回的`res`即`Ctor`不为空，则执行`vnode = createComponent(Ctor, data, context, children, tag)`。

`createComponent`我们后续讲解。

3、如果`tag`是字符串，但既不是平台保留标签名，也不是`components`中的自定义标签，则执行`vnode = new VNode(tag, data, children, undefined, undefined, context)`创建`VNode`对象。

4、如果`tag`不是字符串，则执行`vnode = createComponent(tag, data, context, children)`创建对象。

之后有对命名空间的一些处理，比较简单，大家自己看一眼就好，接下来我们就说一说这个`createComponent`。

## `createComponent`

从函数名我们就知道，该方法是创建一个组件，也就是我们自己定义的组件。

代码如下：

```JavaScript
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data?: VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | void {
  // Ctor为空表示从context的components属性上没找到tag对应的属性
  if (!Ctor) {
    return
  }

  const baseCtor = context.$options._base
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  ...
  resolveConstructorOptions(Ctor)

  data = data || {}

  // transform component v-model data into props & events
  if (data.model) {
    transformModel(Ctor.options, data)
  }

  // extract props
  const propsData = extractProps(data, Ctor, tag)

  // 函数化组件 https://cn.vuejs.org/v2/guide/render-function.html#函数化组件
  // functional component
  if (Ctor.options.functional) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on
  // replace with listeners with .native modifier
  data.on = data.nativeOn

  if (Ctor.options.abstract) {
    // abstract components do not keep anything
    // other than props & listeners
    data = {}
  }

  // merge component management hooks onto the placeholder node
  mergeHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children }
  )
  return vnode
}
```

上面的`baseCtor`其实就是我们的`Vue`对象。

如果`Ctor`是对象，则执行`baseCtor.extend(Ctor)`，这里对应的是我们上面提到的第2种情况，这也就是我为什么之前先讲了`Vue.extend`的实现。

如果`Ctor`不是对象，则跳过这一步骤。因为我们`createElement`方法第一个参数可能是一个`Vue`的子对象，此时`tag`就不是字符串，对应上面提到的第4中情况，例子如下：

```JavaScript
<div id="app">
</div>
<script type="text/javascript">
  new Vue({
    render: function(h){
      return h(Vue.extend({
        template: '<div>test</div>'
      }))
    }
  }).$mount('#app');
</script>
```
经过这一步的处理，第2、4种情况就统一了。

接着是异步组件相关内容，后续单独讲解。

`resolveConstructorOptions`方法是递归合并父对象上的`options`属性，具体见[Vue.extend](Vue.extend.md)。

`data.model`是对元素上`v-model`指令的处理，后续单独讲解各个指令。

`extractProps`从函数名称上，我们也可以知道它是抽取`props`的数据。

```JavaScript
function extractProps (data: VNodeData, Ctor: Class<Component>, tag?: string): ?Object {
  const propOptions = Ctor.options.props
  if (!propOptions) {
    return
  }
  const res = {}
  const { attrs, props, domProps } = data
  if (attrs || props || domProps) {
    for (const key in propOptions) {
      const altKey = hyphenate(key)
      // 提示dom中的属性应该用kebab-case格式的值
      ...

      checkProp(res, props, key, altKey, true) ||
      checkProp(res, attrs, key, altKey) ||
      checkProp(res, domProps, key, altKey)
    }
  }
  return res
}

function checkProp (
  res: Object,
  hash: ?Object,
  key: string,
  altKey: string,
  preserve?: boolean
): boolean {
  if (hash) {
    if (hasOwn(hash, key)) {
      res[key] = hash[key]
      if (!preserve) {
        delete hash[key]
      }
      return true
    } else if (hasOwn(hash, altKey)) {
      res[key] = hash[altKey]
      if (!preserve) {
        delete hash[altKey]
      }
      return true
    }
  }
  return false
}
```

我们在子组件中获取父组件的方法和数据时，是通过`props`来传递的。使用的时候，我们需要在子组件中定义`props`属性，来指定使用父组件传递的哪些数据，以及每个属性的类型是什么。上面代码中`Ctor.options.props`就是在子组件中指定的`props`，如果没有指定，则直接返回。

`data`中的`attrs`是绑定在子元素上的属性值，因为父级组件传递数据到子组件是通过把数据绑定在子元素的属性上，所以我们传递的数据在`attrs`中；`props`暂时没有找到添加的地方；`domProps`是必须通过`props`来绑定的属性，比如`input`的`value`、`option`的`selected`属性等。

遍历`propsOptions`中的属性，所以`props`中没有指定的属性，即使在父组件中绑定了，子组件也找不到。`altKey`是驼峰命名属性的中划线连接式，例如`myName`转换为`my-name`。

`checkProp`方法是从`hash`中找`key`或`altKey`属性，如果有就返回`true`，没找到则返回`false`。没有传递`preserve`参数，则表示找到该`key`的值时删除`hash`上对应的属性。`extractProps`获取值的优先级从高到低分别是`props`、`attrs`、`domProps`，从之前`parse`方法中我们知道，模板解析的结果中`domProps`和`attrs`是不会重复的。

函数化组件之后单独讲。

`data.on`上保存的是我们绑定在元素上的事件，且该事件没有加`native`修饰符。`data.nativeOn`保存的是添加了`native`修饰符的事件。关于事件的细节也比较多，我们之后再细说。这里我们把`data.on`赋值给`listeners`，`data.on`保存的是`data.nativeOn`的值。

`Ctor.options.abstract`是`KeepLive`等抽象组件，`data`上只能包含`props & listeners`。

`mergeHooks`是合并`data`对象上的一些钩子函数。

```JavaScript
const hooksToMerge = Object.keys(componentVNodeHooks)
function mergeHooks (data: VNodeData) {
  if (!data.hook) {
    data.hook = {}
  }
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const fromParent = data.hook[key]
    const ours = componentVNodeHooks[key]
    data.hook[key] = fromParent ? mergeHook(ours, fromParent) : ours
  }
}

function mergeHook (one: Function, two: Function): Function {
  return function (a, b, c, d) {
    one(a, b, c, d)
    two(a, b, c, d)
  }
}
```
`hooksToMerge`共有四个值`init`、`prepatch`、`insert`、`destroy`。具体实现后面讲解，从函数名上我们也可以猜到，它们分别是正在`VNode`对象初始化、`patch`之前、插入到dom中、`VNode`对象销毁时调用。

`mergeHooks`合并钩子函数的流程很简单，如果`data.hook`上已经有了同名的钩子函数，则创建一个新的函数，其内部分别调用这两个同名函数，否则直接添加到`data.hook`对象上。

最后会创建一个`vnode`对象，并返回。所以，上面提到的第2种和第4种情况，最终会返回一个标签名为`vue-component-cid-name`格式的`VNode`对象。