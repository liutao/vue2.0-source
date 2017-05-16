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