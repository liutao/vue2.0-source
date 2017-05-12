接着之前经过`compile`把模板字符串编译为`render`函数，在`src/core/instance/render.js`中，我们调用了`render`并最终返回了一个`VNode`对象实例。`VNode`其实就是我们所说的虚拟dom，接下来我们一步步来揭开它的神秘面纱。

`VNode`的构造函数是在`src/core/vdom/vnode.js`中，该文件主要定义了`VNode`对象包含的基本数据都有哪些。同时还定义了几个比较简单的创建特殊`VNode`对象的方法。

```JavaScript
export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope
  functionalContext: Component | void; // only for functional component root nodes
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?

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

构造函数可以接收的参数最多有七个，分别是`tag`标签名、`data`结点相关数据、`children`字结点对象数组、`text`文本内容、`elm`结点元素、`context`相关联的`Vue`实例、`componentOptions`相关联的部分组件属性。