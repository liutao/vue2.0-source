我说过`html`字符串编译为`render`函数，需要经过三个过程，本文将的是第二步——优化静态内容。顾名思义，`Vue`中对于生成的`ast`会做优化，静态内容是指和数据没有关系，不需要每次都刷新的内容，这一步主要就是找出`ast`中的静态内容，并加以标注。

对应的源码中的文件是`src/compiler/optimizer.js`，打开文件，顿时就会舒一口气，因为这里所做的处理很简单，代码只有100多行，分分钟看懂它干了什么。

同样我们通过一个示例来讲解。原本想用上一篇文章中的例子，结果发现静态内容太少，这里再来一个。

```html
<div id="app">
  这里是文本<箭头之后的文本
  <p>{{message}}</p>
  <p>静态文本<a href="https://www.imliutao.com">博客地址</a></p>
</div>
<script type="text/javascript">
  var vm = new Vue({
    el: '#app',
    data: {
      message: '动态文本'
    }
  })
</script>
```

以上的`template`内容，经过`parse`生成的`ast`如下，具体过程就不再多说了：

```JavaScript
element1 = {
  type: 1,
  tag: "div",
  attrsList: [{name: "id", value: "app"}],
  attrsMap: {id: "app"},
  parent: undefined,
  children: [{
      type: 3,
      text: '这里是文本<箭头之后的文本'
    },
    {
      type: 1,
      tag: 'p',
      attrsList: [],
      attrsMap: {},
      parent: ,
      children: [{
        type: 2,
        expression: '_s(message)',
        text: '{{message}}'
      }],
      plain: true
    },
    {
      text: " ",
      type: 3
    },
    {
      type: 1,
      tag: 'p',
      attrsList: [],
      attrsMap: {},
      children: [{
		text: "静态文本",
		type: 3
      },
      {
	    attrs: [{name: "href", value: '"http://www.imliutao.com"'}],
		attrsList: [{name: "href", value: 'http://www.imliutao.com'}],
		attrsMap: {href: 'http://www.imliutao.com'}
		children: [{
			text: "博客地址",
			type: 3
		}]
		plain: false,
		tag: "a",
		type: 1
	  }
      ],
      plain: true
    }
  ],
  plain: false,
  attrs: [{name: "id", value: "'app'"}]
}
```

这里略去了`parent`属性，大家都懂。

以上的`ast`会传入`optimize`函数，我们接着一起来看：

```JavaScript
const genStaticKeysCached = cached(genStaticKeys)
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  markStatic(root)
  // second pass: mark static roots.
  markStaticRoots(root, false)
}
```

首先定义了两个函数，一个是判断传入的`key`是不是静态的，另一个是判断是不是平台保留`tag`。

**`isStaticKey`** 我们在[compile概述](compile概述.md)中介绍过，传入的`options.staticKeys`的值为`staticClass,staticStyle`。所以该函数返回`true`的有下面`genStaticKeys`中定义的属性加上`staticClass,staticStyle`。

```JavaScript
function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs' +
    (keys ? ',' + keys : '')
  )
}
```

**`isPlatformReservedTag`** 这里所有的`HTML`和`SVG`标签都会返回`true`，具体定义在`src/platforms/web/util/element.js`中。

正如代码中所注释的，标记共分为两步：

1、标记所有的静态和非静态结点

2、标记静态根节点

## 标记所有的静态和非静态结点

对应的方法就是`markStatic`，它接收一个`ast`作为参数。

```JavaScript
function markStatic (node: ASTNode) {
  node.static = isStatic(node)
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        node.static = false
      }
    }
  }
}
```

这里我们通过`isStatic`方法来判断结点是不是静态，具体判断的内容我们稍后说，接着往下看，如果`node.type === 1`即`ast`是元素结点，会添加一些其他的操作。

`!isPlatformReservedTag(node.tag)`是指`node.tag`不是保留标签，即我们自定义的标签时返回`true`。

`node.tag !== 'slot'`是指标签不是`slot`。

`node.attrsMap['inline-template'] == null`是指`node`不是一个内联模板容器。

如果以上三个条件都符合的话，就不对它的`children`进行标记，实际上这个时候`node.static = false`，因为`isStatic`中判断了如果`isPlatformReservedTag(node.tag) == false`，函数返回的就是`false`。

如果以上三个条件有一个不符合，则递归标记子节点，且如果子节点有不是静态的，当前结点`node.static = false`。

我们再来看`isStatic`的判断逻辑：

```JavaScript
function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { // expression
    return false
  }
  if (node.type === 3) { // text
    return true
  }
  return !!(node.pre || (
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)
  ))
}
```

`node.type === 2`或`node.type === 3`没什么好说的，本来就一个是表达式、一个是静态文本。

最后是两个**"或"**的判断逻辑。

1、 如果`node.pre`返回`true`，即元素上有`v-pre`指令，这时结点的子内容是不做编译的，所以函数返回`true`。

2、 第二个判断比较复杂，我们一个一个说。

`!node.hasBindings`： 结点没有动态属性，即没有任何指令、数据绑定、事件绑定等。

`!node.if`：没有`v-if`和`v-else`。

`!node.for`：没有`v-for`。

`!isBuiltInTag(node.tag)`：不是内置的标签，内置的标签有`slot`和`component`。

`isPlatformReservedTag(node.tag)`：是平台保留标签，即`HTML`或`SVG`标签。

`!isDirectChildOfTemplateFor(node)`：不是`template`标签的直接子元素且没有包含在`for`循环中，代码如下：

```JavaScript
function isDirectChildOfTemplateFor (node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
```

`Object.keys(node).every(isStaticKey)`：结点包含的属性只能有`isStaticKey`中指定的几个。

所以经过第一步的标记之后，我们的`ast`变为：

```JavaScript
element1 = {
  type: 1,
  tag: "div",
  attrsList: [{name: "id", value: "app"}],
  attrsMap: {id: "app"},
  parent: undefined,
  children: [{
      type: 3,
      text: '这里是文本<箭头之后的文本',
      static: true
    },
    {
      type: 1,
      tag: 'p',
      attrsList: [],
      attrsMap: {},
      parent: ,
      children: [{
        type: 2,
        expression: '_s(message)',
        text: '{{message}}',
        static: false
      }],
      plain: true,
      static: false
    },
    {
      text: " ",
      type: 3,
      static: true
    },
    {
      type: 1,
      tag: 'p',
      attrsList: [],
      attrsMap: {},
      children: [{
          text: "静态文本",
          type: 3,
          static: true
        },
        {
          attrs: [{name: "href", value: '"http://www.imliutao.com"'}],
          attrsList: [{name: "href", value: 'http://www.imliutao.com'}],
          attrsMap: {href: 'http://www.imliutao.com'}
          children: [{
            text: "博客地址",
            type: 3,
            static: true
          }],
          plain: false,
          tag: "a",
          type: 1,
          static: true
        }
      ],
      plain: true,
      static: true
    }
  ],
  plain: false,
  attrs: [{name: "id", value: "'app'"}],
  static: false
}
```

## 标记静态根节点

执行这一步的函数是`markStaticRoots(root, false)`，第一个参数是`ast`，第二个是标示`ast`是否在`for`循环中。

```JavaScript
function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
  	// 如果node.static为true，则会添加node.staticInFor
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      walkThroughConditionsBlocks(node.ifConditions, isInFor)
    }
  }
}
```

这里我们只处理`node.type === 1`的结点。

最开始会给`node.static = true`或`node.once = true`的结点添加`node.staticInFor`属性，值为传入的`isInFor`。

下面的几句注释比较重要，大体意思是“对于一个静态根结点，它不应该只包含静态文本，否则消耗会超过获得的收益，更好的做法让它每次渲染时都刷新。”

所以就有了下面判断`node.staticRoot = true`的条件：`node.static`说明该结点及其子节点都是静态的，`node.children.length`说明该结点有子节点，`!(node.children.length === 1 && node.children[0].type === 3)`说明该结点不是只有一个静态文本子节点，这与上面的注释正好对应。

如果不满足这三个条件，则`node.staticRoot = false`。

之后再以同样的方式递归地对子节点进行标记。

最后如果结点有`if`块，则对块儿内结点同样进行标记。

所以，经过上面两步的处理，最终的`ast`变为：

```JavaScript
element1 = {
  type: 1,
  tag: "div",
  attrsList: [{name: "id", value: "app"}],
  attrsMap: {id: "app"},
  parent: undefined,
  children: [{
      type: 3,
      text: '这里是文本<箭头之后的文本',
      static: true
    },
    {
      type: 1,
      tag: 'p',
      attrsList: [],
      attrsMap: {},
      parent: ,
      children: [{
        type: 2,
        expression: '_s(message)',
        text: '{{message}}',
        static: false
      }],
      plain: true,
      static: false,
      staticRoot: false
    },
    {
      text: " ",
      type: 3,
      static: true
    },
    {
      type: 1,
      tag: 'p',
      attrsList: [],
      attrsMap: {},
      children: [{
          text: "静态文本",
          type: 3,
          static: true
        },
        {
          attrs: [{name: "href", value: '"http://www.imliutao.com"'}],
          attrsList: [{name: "href", value: 'http://www.imliutao.com'}],
          attrsMap: {href: 'http://www.imliutao.com'}
          children: [{
            text: "博客地址",
            type: 3,
            static: true
          }],
          plain: false,
          tag: "a",
          type: 1,
          static: true
        }
      ],
      plain: true,
      static: true,
      staticInFor: false,
      staticRoot: true
    }
  ],
  plain: false,
  attrs: [{name: "id", value: "'app'"}],
  static: false,
  staticRoot: false
}
```