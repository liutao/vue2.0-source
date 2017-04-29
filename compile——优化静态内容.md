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

正如代码中所注释的，标记共分为两部：

1、标记所有的静态和非静态结点

2、标记静态根节点

