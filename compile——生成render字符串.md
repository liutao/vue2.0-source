本文是将`html`字符串编译为`render`字符串的最后一步，对应的源码中的文件是`src/compiler/codegen/index.js`，打开这个文件，内心是有点儿小崩溃的，不过仔细满满读，就会发现，这个文件所要实现的功能还是比较简单的，只不过因为需要处理的不同情况太多，所以代码会很长。

本篇文章和之前类似，主要目的是带着大家过一下模板编译的流程，具体各种指令等的处理，之后我会分别单独讲解。

## 前置内容

由于生成的`render`内容与虚拟dom关系和密切，这里我先简单介绍一下我们生成的字符串中，几个方法的含义是什么。

**`_c`** 该方法对应的是`createElement`方法，顾名思义，它的含义是创建一个元素，它的第一个参数是要定义的元素标签名、第二个参数是元素上添加的属性，第三个参数是子元素数组，第四个参数是子元素数组进行归一化处理的级别。

**`_v`** 该方法是创建一个文本结点。

**`_s`** 是把一个值转换为字符串。

**`_m`** 是渲染静态内容，它接收的第一个参数是一个索引值，指向最终生成的`staticRenderFns`数组中对应的内容，第二个参数是标识元素是否包裹在`for`循环内。

这四个函数是我们这篇文章中生成的字符串中包含的函数，接下来我们就看看如何把`ast`转换为`render`字符串。

## 生成`render`字符串

同样我们还是通过一个例子来学习。

```HTML
<div id="app">
	<a :href="url">{{message}}</a>
	<p>静态根节点<span>静态内容</span></p>
</div>
<script type="text/javascript">
	var vm = new Vue({
		el: '#app',
		data: {
			message: '博客地址',
			url: 'https://www.imliutao.com'
		}
	})
</script>
```

经过模板解析和静态内容标记后，最终的`ast`如下：

```JavaScript
element1 = {
  type: 1,
  tag: "div",
  attrsList: [{name: "id", value: "app"}],
  attrsMap: {id: "app"},
  parent: undefined,
  children: [
    {
      type: 1,
      tag: 'a',
      attrsList: [{name: ":href", value: "url"}],
      attrs: [{name: "href", value: "url"}],
      attrsMap: {':href': url},
      parent: ,
      children: [{
        type: 2,
        expression: '_s(message)',
        text: '{{message}}',
        static: false
      }],
      plain: false,
      static: false,
      staticRoot: false,
      hasBindings: true
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
			text: "静态根节点",
			type: 3,
			static: true
	      },
	      {
			attrsList: [],
			attrsMap: {}
			children: [{
				text: "静态内容",
				type: 3,
				static: true
			}],
			plain: true,
			tag: "span",
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

拿到`ast`结构，我们接着看看`generate`函数的实现。

```JavaScript
export function generate (
  ast: ASTElement | void,
  options: CompilerOptions
) {
  // save previous staticRenderFns so generate calls can be nested
  const prevStaticRenderFns: Array<string> = staticRenderFns
  const currentStaticRenderFns: Array<string> = staticRenderFns = []
  const prevOnceCount = onceCount
  onceCount = 0
  currentOptions = options
  warn = options.warn || baseWarn
  transforms = pluckModuleFunction(options.modules, 'transformCode')
  dataGenFns = pluckModuleFunction(options.modules, 'genData')
  platformDirectives = options.directives || {}
  isPlatformReservedTag = options.isReservedTag || no
  const code = ast ? genElement(ast) : '_c("div")'
  staticRenderFns = prevStaticRenderFns
  onceCount = prevOnceCount
  return {
    render: `with(this){return ${code}}`,
    staticRenderFns: currentStaticRenderFns
  }
}
```

函数一进来，我们通过`prevStaticRenderFns`和`prevOnceCount`分别保存了之前的`staticRenderFns`和`onceCount`，这是因为我们可能有内部模板`inline-template`，会导致嵌套调用该方法。

之后我们重置了`currentStaticRenderFns`和`onceCount`。

`transforms`和`dataGenFns`类似于我们之前讲`parse`函数时，里面会有`preTransforms`等钩子，之前是操作对生成`ast`进行特殊处理，这里是对生成`render`字符串进行特殊处理。其实我们之前也说过，`options.modules`包含`klass`和`style`两个模块，`pluckModuleFunction`是取出模块中对应的方法，组成一个数组。在这里，`transforms`是一个空数组，`vue`源码中，还没有内置需要在生成`render`时特殊处理的属性等。`dataGenFns`包含两个元素，分别是处理`ast`中有`class`或`style`相关属性时，对生成`render`字符串进行操作，我们这里的例子没有添加样式属性，就不细说了。

`platformDirectives`是`html`、`model`、`text`三个指令的特殊操作，这里也不赘述。

`isPlatformReservedTag`我们在多处使用过，这里也不多说了。

接着就是我们的重头戏了，如果`ast`为空，`code = '_c("div")'`，即创建一个空的`div`，否则执行`code = genElement(ast)`。

`code`生成之后，会使`staticRenderFns`和`onceCount`重新等于之前存储的值。

最终函数返回`render`和`staticRenderFns`组成的对象。

## `genElement(ast)`

该函数就是把`ast`转换成`code`的地方，我们看看它是如何操作的。

```JavaScript
function genElement (el: ASTElement): string {
  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el)
  } else if (el.once && !el.onceProcessed) {
  	...
  } else {
    // component or element
    let code
    if (el.component) {
      ...
    } else {
      const data = el.plain ? undefined : genData(el)

      const children = el.inlineTemplate ? null : genChildren(el, true)
      code = `_c('${el.tag}'${
        data ? `,${data}` : '' // data
      }${
        children ? `,${children}` : '' // children
      })`
    }
    // module transforms
    for (let i = 0; i < transforms.length; i++) {
      code = transforms[i](el, code)
    }
    return code
  }
}
```

在这里就根据不同的指令，调用了许多不同的生成方法，我们的例子中，只可能走到`genStatic`和最后的`else`中，所以这里我们只讲这两个部分内容。其它的我们还是放在之后讲解指令时分别介绍。

先来看看`genStatic`:

```JavaScript
function genStatic (el: ASTElement): string {
  el.staticProcessed = true
  staticRenderFns.push(`with(this){return ${genElement(el)}}`)
  return `_m(${staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}
```

这个函数很简单，给`el`添加了一个`staticProcessed = true`，然后给`staticRenderFns`数组中添加了一个字符串，我们发现这个字符串和`generate`函数返回的`render`字符串一毛一样，这里是对静态根节点及其子内容单独分离出来处理。

最后会返回一个包裹`_m`函数的字符串，函数的第一个参数就是`staticRenderFns`新添加内容的索引，第二个参数是标识是否在`for`循环中，我们的例子里是空。

`genStatic`中还是会调用`genElement`方法来递归生成`render`字符串。

我们再来看`else`块的内容，主要是这一段：

```JavaScript
const data = el.plain ? undefined : genData(el)

const children = el.inlineTemplate ? null : genChildren(el, true)
code = `_c('${el.tag}'${
	data ? `,${data}` : '' // data
	}${
	children ? `,${children}` : '' // children
})`
```

如果`el.plain`是`true`，说明该结点没有属性，所以`_c`第二个参数是空，否则调用`genData`，很明显这个函数是生成`_c`第二个参数给元素添加属性的地方。

```JavaScript
function genData (el: ASTElement): string {
  let data = '{'

  ...
  if (el.attrs) {
    data += `attrs:{${genProps(el.attrs)}},`
  }
  ...
  data = data.replace(/,$/, '') + '}'
  ...
  return data
}
```

因为属性包含了各种指令、事件等，这里我们只保留上面的例子中我们有的`attrs`。

首先定义了一个字符串`data`，以`{`开始，然后加上`attrs:{${genProps(el.attrs)}},`。

`genProps`用于把属性链接为字符串。

```JavaScript
function genProps (props: Array<{ name: string, value: string }>): string {
  let res = ''
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    res += `"${prop.name}":${transformSpecialNewlines(prop.value)},`
  }
  return res.slice(0, -1)
}

// #3895, #4268
function transformSpecialNewlines (text: string): string {
  return text
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
```

代码其实很简单，就是把属性的键值用`:`对应，多个键值对用`,`隔开，最终去掉最后一个无用的`,`。`transformSpecialNewlines`是对几个特殊字符的处理。

其实我们最终生成的`data`也是大括号包裹的对象转换成的字符串。我们这里只有一个`attrs`属性。

转换完属性，是对`children`的操作，如果不是内部模板，我们就执行`genChildren(el, true)`。

```JavaScript
function genChildren (el: ASTElement, checkSkip?: boolean): string | void {
  const children = el.children
  if (children.length) {
    const el: any = children[0]
    // optimize single v-for
    if (children.length === 1 &&
        el.for &&
        el.tag !== 'template' &&
        el.tag !== 'slot') {
      return genElement(el)
    }
    const normalizationType = checkSkip ? getNormalizationType(children) : 0
    return `[${children.map(genNode).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''
    }`
  }
}
```

如果`el`是一个循环，且只有一个子元素时，这里直接返回`genElement(el)`。细心的人可能会发现`genChildren`就是在`genElement`中`el.for`返回`false`，走到`else`才执行的，这样岂不是死循环了？这里我们只讲了符合我们上面例子的部分，源码中`else`内还有如下判断：

```JavaScript
if (el.component) {
  code = genComponent(el.component, el)
}
```

这里简单说一下，`el.component`保存的是`<component :is="xxx">`标签上`is`指向的模板。本身`el`上可能没有相关其它指令，但`el.component`上可能有。`genComponent`也会调用`genChildren`。

接着往下，我们这里`checkSkip`传入的是`true`，`getNormalizationType(children)`返回的是子元素数组需要哪种级别的“normalization”处理。

```JavaScript
// 0: 不需要归一化的处理
// 1: 简单归一化处理
// 2: 深度归一化处理
function getNormalizationType (children: Array<ASTNode>): number {
  let res = 0
  for (let i = 0; i < children.length; i++) {
    const el: ASTNode = children[i]
    if (el.type !== 1) {
      continue
    }
    // el上有`v-for`或标签名是`template`或`slot`，或者el是if块，但块内元素有内容符合上述三个条件的
    if (needsNormalization(el) ||
        (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
      res = 2
      break
    }
    // el是自定义组件或el是if块，但块内元素有自定义组件的
    if (maybeComponent(el) ||
        (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
      res = 1
    }
  }
  return res
}

function needsNormalization (el: ASTElement): boolean {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

function maybeComponent (el: ASTElement): boolean {
  return !isPlatformReservedTag(el.tag)
}
```

从上面的代码中，可以看出如果有元素符合`res = 2`的条件，则直接跳出循环，且`res = 1`会被`res = 2`覆盖。这里的“归一化”其实就是把多维的children数组转换成一维，至于1和2的区别，是两种不同的方式来进行归一化，为了使归一化消耗最少，所以不同情况使用不同的方式进行归一化，感兴趣的可以翻开源码`src/core/vdom/helpers/normalize-children.js`，这里有详细的注释。

最终`genChildren`返回的字符串中会对`children`依次执行`getNode`，并通过`,`相连。

```JavaScript
function genNode (node: ASTNode): string {
  if (node.type === 1) {
    return genElement(node)
  } else {
    return genText(node)
  }
}

function genText (text: ASTText | ASTExpression): string {
  return `_v(${text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}
```

从上面代码可以看出，如果`node.type === 1`，则递归调用`genElement`，否则调用`genText`。`genText`中会返回包含`_v`函数的字符串，传入的内容是表达式或纯文本字符串。

至此，整体上把例子生成的`ast`转换为`render`字符的代码基本讲解完毕。最终返回的内容为：

```JavaScript
code = {
	render: "with(this){return _c('div',{attrs:{"id":"app"}},[_c('a',{attrs:{"href":url}},[_v(_s(message))]),_v(" "),_m(0)])}",
	staticRenderFns: [with(this){return _c('p',[_v("静态根节点"),_c('span',[_v("静态内容")])])}]
}
```

如果看到生成的内容，大体上我们知道每一部分都经历了什么，说明这篇文章就没有白讲。
