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




