生成`ast`的函数是`src/compiler/parser/index.js`文件中的`parse`函数，从这里入手，我们一起来看看一段`html`字符串，是如何一步步转换成抽象语法树的。

这一部分会涉及到许许多多的正则匹配，知道每个正则有什么用途，会更加方便之后的分析。

## 正则表达式

### `src/compiler/parser/index.js`

```JavaScript
export const onRE = /^@|^v-on:/
export const dirRE = /^v-|^@|^:/
export const forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/
export const forIteratorRE = /\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/

const argRE = /:(.*)$/
const bindRE = /^:|^v-bind:/
const modifierRE = /\.[^.]+/g
```
这一部分的几个正则很简单，我们简单过一下。

`onRE`是匹配`@`或`v-on`开头的属性，也就是我们添加事件的语法。

`dirRE`是匹配`v-`或`@`或`:`开头的属性，即`vue`中的绑定数据或事件的语法。

`forAliasRE`匹配`v-for`中的属性值，比如`item in items`、`(item, index) of items`。

`forIteratorRE`是对`forAliasRE`中捕获的第一部分内容，进行拆解，我们都知道`v-for`中`in|of`前最后可以有三个逗号分隔的参数。

`argRE`匹配并捕获`:`开头的属性。

`bindRE`匹配`:`或`v-bind`开头的属性，即绑定数据的语法。

`modifierRE`是匹配`@click.stop`、`@keyup.enter`等属性中的修饰符。

### `src/compiler/parser/html-parser.js`

这部分内容的正则表达式比较复杂，相信很多人看到这些都一个头两个大。由于我的水平也比较有限，马马虎虎带大家过一下这些正则。

前面几行是定义了匹配属性的正则。

```JavaScript
// Regular Expressions for parsing tags and attributes
const singleAttrIdentifier = /([^\s"'<>/=]+)/
const singleAttrAssign = /(?:=)/
const singleAttrValues = [
  // attr value double quotes
  /"([^"]*)"+/.source,
  // attr value, single quotes
  /'([^']*)'+/.source,
  // attr value, no quotes
  /([^\s"'=<>`]+)/.source
]
const attribute = new RegExp(
  '^\\s*' + singleAttrIdentifier.source +
  '(?:\\s*(' + singleAttrAssign.source + ')' +
  '\\s*(?:' + singleAttrValues.join('|') + '))?'
)
```

第一个`singleAttrIdentifier`比较简单，它是匹配一个或多个非空白字符，非`"'<>/=`字符，并捕获匹配到的内容，主要用于匹配属性名。

例如：

```JavaScript
"/abc'de<".match(singleAttrIdentifier)
// ["abc", "abc", index: 1, input: "/abc'de<"]
```

第二个`singleAttrAssign`，更简单，就是匹配一个`=`，但不捕获。

第三个`singleAttrValues`主要用于匹配属性值，因为我们的属性值可以包含在单引号或双引号内，也可以不用引号。所以这里分为三种情况：

1、双引号括起来`/"([^"]*)"+/.source`。主要是捕获双引号括起来的非`"`内容。

2、单引号括起来`/'([^']*)'+/.source`。主要是捕获双引号括起来的非`'`内容。

3、没有引号`/([^\s"'=<>`]+)/.source`。捕获多个非空白字符或非`"'=<>\``字符的内容。

最后一个是把前三个整合起来，用于匹配一个完整的属性，并且允许属性名、等号、属性值之前可以有多个空白字符。

列举几个符合的例子：

```JavaScript
"href='https://www.imliutao.com'".match(attribute)
// ["href='https://www.imliutao.com'", "href", "=", undefined, "https://www.imliutao.com", undefined, index: 0, input: "href='https://www.imliutao.com'"]
// 上例中把单引号和双引号互换，结果一样

// 我们在属性名、等号、属性值之前加了空格，我们依然可以正确匹配捕获键和值。
" href = 'https://www.imliutao.com'".match(attribute)
// [" href = "https://www.imliutao.com"", "href", "=", "https://www.imliutao.com", undefined, undefined, index: 0, input: " href = "https://www.imliutao.com""]

// 去掉属性值的引号
' href =https://www.imliutao.com'.match(attribute)
// [" href =https://www.imliutao.com", "href", "=", undefined, undefined, "https://www.imliutao.com", index: 0, input: " href =https://www.imliutao.com"]

```
上面列出来的三个例子，最终匹配的结果数组中`https://www.imliutao.com`的位置变换了，这是因为我们匹配属性值时有三种情况，3-5依次为双引号、单引号、没有引号的捕获结果。

接着一组，是用来匹配起始标签的标签名。

```JavaScript
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = '((?:' + ncname + '\\:)?' + ncname + ')'
const startTagOpen = new RegExp('^<' + qnameCapture)
```

`ncname`匹配的是以`a-zA-Z_`开头，然后是0或多个`a-zA-Z_`、`-`或`.`。

`qnameCapture`匹配`ncname`开头，紧跟着一个冒号，然后又跟着一个`ncname`，捕获整体匹配的内容。

`startTagOpen`也很明了，其实就是匹配起始标签，我们的标签有字母、下划线、中划线或点组成，因为可能有命名空间，所以有了`qnameCapture`。

例子如下：

```JavaScript
'<a href="http://www.imliutao.com">刘涛的个人小站</a>'.match(startTagOpen)
// ["<a", "a", index: 0, input: "<a href="http://www.imliutao.com">刘涛的个人小站</a>"]

'<svg:path />'.match(startTagOpen)
// ["<svg:path", "svg:path", index: 0, input: "<svg:path />"]

'<svg:path.test />'.match(startTagOpen)
// ["<svg:path.test", "svg:path.test", index: 0, input: "<svg:path.test />"]


'<-svg:path />'.match(startTagOpen)
// null

```

接着`startTagClose`比较简单，用于匹配起始标签的结束部分，这里做了单标签的区分，单标签匹配的第二个元素是`/`，如下：

```JavaScript
const startTagClose = /^\s*(\/?)>/
' />'.match(startTagClose)
// [" />", "/", index: 0, input: " />"]

' >'.match(startTagClose)
// [" >", "", index: 0, input: " >"]
```

`endTag`是匹配双标签的结束标签。以`<`开始，然后是`/`，然后是标签名`qnameCapture`，接着是0或多个非`>`，最后是`>`。其中捕获是`qnameCapture`进行的。

```JavaScript
const endTag = new RegExp('^<\\/' + qnameCapture + '[^>]*>')

'</div>'.match(endTag)
// ["</div>", "div", index: 0, input: "</div>"]

'</div    >'.match(endTag)
// ["</div    >", "div", index: 0, input: "</div    >"]

' </div    >'.match(endTag)
// null

```
最后三个比较简单，`doctype`是匹配文档类型，`comment`匹配`html`注释的起始部分，`conditionalComment`匹配`<![CDATA`等内容。

```JavaScript
const doctype = /^<!DOCTYPE [^>]+>/i
const comment = /^<!--/
const conditionalComment = /^<!\[/
```
-->

### `src/compiler/parser/text-parser.js`

```JavaScript
const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g
```

`defaultTagRE`是默认的模板分隔符匹配。

`regexEscapeRE`用于匹配需要转义的字符。

### `src/compiler/parser/filter-parser.js`

```JavaScript
validDivisionCharRE = /[\w).+\-_$\]]/
```

这个也比较简单，就是匹配字母数字及列出的字符，具体用途是判断表达式是不是正则时用到，具体我们讲解`filter`时深入分析。

## 编译模板

光看代码，毕竟无聊又生硬，我们还是从一个简单的例子出发，来过一下最基本的流程。

例子如下：

```JavaScript
var vm = new Vue({
    el: '#app',
    template: '<div id="app">\
      这里是文本<箭头之后的文本\
      <a :href="url" target="_blank" >前面的文本{{title}}后面的文本</a>\
      <img :src="img" />\
    </div>',
    data: {
      url: 'https://www.imliutao.com',
      title: '刘涛的个人小站',
      img: 'https://pic1.zhimg.com/092406f3919e915fffc7ef2f2410e560_is.jpg'
    }
  })
</script>
```

我们先看一眼`parse`方法的实现。

```JavaScript
export function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  warn = options.warn || baseWarn
  
  platformGetTagNamespace = options.getTagNamespace || no  // 获取tag的命名空间，svg或math
  platformMustUseProp = options.mustUseProp || no // 判断是否需要通过绑定prop来绑定属性
  platformIsPreTag = options.isPreTag || no  // 是不是pre标签
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode') 
  transforms = pluckModuleFunction(options.modules, 'transformNode') 
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode') 
  delimiters = options.delimiters  // 分隔符

  const stack = []
  const preserveWhitespace = options.preserveWhitespace !== false
  let root
  let currentParent
  let inVPre = false
  let inPre = false
  let warned = false

  function warnOnce (msg) {
    if (!warned) {
      warned = true
      warn(msg)
    }
  }

  function endPre (element) {
    // check pre state
    if (element.pre) {
      inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
  }

  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,  // 是否是单标签
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    start (tag, attrs, unary) {
      ...
    },

    end () {
      ...
    },

    chars (text: string) {
      ...
    }
  })
  return root
}
```

最开始保存了一系列`options`传入的方法等，这些内容我们在上一篇文章中提到过，这里就不多说了。接着定义了一些变量和内部方法。然后是一个很长很长的函数调用`parseHTML`，对整个模板的解析，都是在这里进行的。

我们来看`parseHTML`的实现。

```JavaScript
export function parseHTML (html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    ...
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance (n) {
    ...
  }

  function parseStartTag () {
    ...
  }

  function handleStartTag (match) {
    ...
  }

  function parseEndTag (tagName, start, end) {
    ...
  }
}
```

刚开始也是先定义一堆变量，然后开始了一个大循环。Let us go!

### round one

第一次循环`html`就是我们的模板，`last`用于保存还没有解析的模板部分。`lastTag`为`undefined`，所以`!lastTag`为`true`。`textEnd = html.indexOf('<')`为0。

里面大量用到了`advance`方法，先说一下它是干啥的。

```JavaScript
  function advance (n) {
    index += n
    html = html.substring(n)
  }
```
它只是把`html`从`n`位置开始截取，并且记录索引`index`的位置。

```JavaScript
// 过滤掉注释，doctype等
// Comment:
if (comment.test(html)) {
  const commentEnd = html.indexOf('-->')

  if (commentEnd >= 0) {
    advance(commentEnd + 3)
    continue
  }
}
```
首先过滤`<!--`和`-->`注释的内容。

```
// http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
if (conditionalComment.test(html)) {
  const conditionalEnd = html.indexOf(']>')

  if (conditionalEnd >= 0) {
    advance(conditionalEnd + 2)
    continue
  }
}

```
然后过滤`<![`和`]>`注释的内容。

```JavaScript
// Doctype:
const doctypeMatch = html.match(doctype)
if (doctypeMatch) {
  advance(doctypeMatch[0].length)
  continue
}

```

接着过滤文档类型标示的字符串。以上内容我们模板都没有，所以直接跳过。

```JavaScript
const endTagMatch = html.match(endTag)

if (endTagMatch) {
  const curIndex = index
  advance(endTagMatch[0].length)
  parseEndTag(endTagMatch[1], curIndex, index)
  continue
}
```
`endTag`匹配结束的标签，这里匹配结果为`null`。

```JavaScript
const startTagMatch = parseStartTag()
if (startTagMatch) {
  handleStartTag(startTagMatch)
  continue
}
```
这里执行了`parseStartTag`函数。我们看看它做了什么。

```JavaScript
  function parseStartTag () {
    // 匹配标签名
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr

      // 匹配起始标签内的属性
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      // 是不是单标签
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }
```
`html.match(startTagOpen)`返回内容如下：

```JavaScript
["<div", "div", index: 0, input: "<div id="app">↵	这里是文本<箭头之后的文本↵	<a :href="url" t…t="_blank">{{title}}</a>↵	<img :src="img">↵</div>"]
```
此时`start`是一个数组，`match`就是：

```JavaScript
match = {
	tagName: "div",
	attrs: [],
	start: 0 // index是parseHTML内部全局变量
}
```
`advance(start[0].length)`后`html`截去前四个字符。

`while`循环中主要是匹配属性知道起始标签结束，我们这里只有一个`id="app"`。

`end`匹配结果如下：

```JavaScript
[">", "", index: 0, input: ">↵	这里是文本<箭头之后的文本↵	<a :href="url" target="_blank">{{title}}</a>↵	<img :src="img">↵</div>"]
```
所以最终`match`如下：

```JavaScript
match = {
	tagName: "div",
	attrs: [[" id="app"", "id", "=", "app", undefined, undefined, index: 0, input: " id="app"> 	这里是文本<箭头之后的文本 	<a :href="url" target="_blank">{{title}}</a>	<img :src="img"> </div>"]],
	start: 0,
	end: 14,
	unarySlash: ""
}
```

之后会把`match`传给`handleStartTag`函数处理。

```JavaScript
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || tagName === 'html' && lastTag === 'head' || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      // 上面讲正则的时候，提到过3、4、5分别为双引号、单引号、没有引号的捕获结果。
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }
      const value = args[3] || args[4] || args[5] || ''
      attrs[i] = {
        name: args[1],
        value: decodeAttr(
          value,
          options.shouldDecodeNewlines
        )
      }
    }

    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }
```

细节大家自己看，经过循环处理：

```JavaScript
attrs = [{name: "id", value: "app"}]
stack = [{
	attrs,
	lowerCasedTag: "div",
	tag: "div"
}]
lastTag = "div"
```

我们在`parse`中传入了`start`函数，接着会执行`start`函数，该函数比较长且涉及情况太多，我就不直接粘贴代码了，大家最好对照源码一起看，在每次解析的时候，我会附上本次解析相关代码。

整体分为以下几步：

1、 定义基本的ast结构

2、 对ast进行预处理(`preTransforms`)

3、 解析`v-pre`、`v-if`、`v-for`、`v-once`、`slot`、`key`、`ref`等指令。

4、 对ast处理(`transforms`)

5、 解析`v-bind`、`v-on`以及普通属性

6、 根节点或`v-else`块等处理

7、 模板元素父子关系的建立

8、 对ast后处理(`postTransforms`)

第一步定义基本的ast结构：

```JavaScript
const element1 = {
    type: 1,
    tag: "div",
    attrsList: [{name: "id", value: "app"}],
    attrsMap: {id: "app"},
    parent: undefined,
    children: []
  }
```

第二步对ast的预处理在`weex`中才会有，我们直接跳过。

第三步对不同指令的解析，我们之后再分别讲解。

第四步中只有对`class`和`style`属性操作。

第五步主要是`processAttrs`函数。


```JavaScript
function processAttrs (el) {
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    // dirRE.test('id') = false
    if (dirRE.test(name)) {
      ...
    } else {
      if (process.env.NODE_ENV !== 'production') {
        const expression = parseText(value, delimiters)
        if (expression) {
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.'
          )
        }
      }
      addAttr(el, name, JSON.stringify(value))
    }
  }
}
```

`parseText`函数主要用于解析文本，因为不是`Vue`指令才会走到`else`中，这里主要是用于提示用户，不要用`id="{{ val }}"`这种方式，函数的具体实现，之后解析文本的时候再说。

```JavaScript
export function addAttr (el: ASTElement, name: string, value: string) {
  (el.attrs || (el.attrs = [])).push({ name, value })
}
```

之后ast结构如下：

```JavaScript
const element1 = {
    type: 1,
    tag: "div",
    attrsList: [{name: "id", value: "app"}],
    attrsMap: {id: "app"},
    parent: undefined,
    children: [],
    plain: false,
    attrs: [{name: "id", value: "'app'"}]
  }
```

第六步`root`还是`undefined`，所以执行`root = element`并验证根节点是否合法。

```JavaScript
    if (!root) {
      root = element
      checkRootConstraints(root)
    } else if (!stack.length) {
      ...
    }
```

第七步，

```JavaScript
// currentParent = undefined
if (currentParent && !element.forbidden) {
  if (element.elseif || element.else) {
    processIfConditions(element, currentParent)
  } else if (element.slotScope) { // scoped slot
    currentParent.plain = false
    const name = element.slotTarget || '"default"'
    ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
  } else {
    currentParent.children.push(element)
    element.parent = currentParent
  }
}
if (!unary) {
  currentParent = element
  stack.push(element)
} else {
  endPre(element)
}
```
执行完这一步，`currentParent`值为`element1`，且`stack`栈中有了一个元素`element1`。

第八步没有任何操作。

### round two

`start`函数执行完之后，我们再回到`parseHTML`中，接着会再次执行`while`循环。

此时`html`字符串的`<div id="app">`部分已经被截掉，只剩下后半部分。`!isPlainTextElement('div') == true`所以还是会走`if`。

接着继续查找`<`的位置，如下：

```JavaScript
let textEnd = html.indexOf('<')  // 20
```

所以会直接跳过下面的`if`块。

```JavaScript
let text, rest, next
if (textEnd >= 0) {
  rest = html.slice(textEnd)
  while (
    !endTag.test(rest) &&
    !startTagOpen.test(rest) &&
    !comment.test(rest) &&
    !conditionalComment.test(rest)
  ) {
    // < in plain text, be forgiving and treat it as text
    next = rest.indexOf('<', 1)
    if (next < 0) break
    textEnd += next
    rest = html.slice(textEnd)
  }
  text = html.substring(0, textEnd)
  advance(textEnd)
}
```

这里`vue`其实会对文本中的小于号进行处理，如果文本中包含了`<`，`rest`会等于从`<`开始的文本，然后如果`rest`不是结束标签、不是起始标签、不是注释，则说明它在文本中，之后跳过`<`继续向后寻找，以此循环。

`text`用与保存文本，这里是`这里是文本<箭头之后的文本`。

```JavaScript
if (textEnd < 0) {
  text = html
  html = ''
}

if (options.chars && text) {
  options.chars(text)
}
```

`options.chars`用于解析文本，我们接着回到`parse`函数中。

`chars`函数比较简单，主要分两种情况，一种是文本需要解析，一种是纯文本，我们这里是纯文本，所以整体的ast变为：

```JavaScript
const element1 = {
    type: 1,
    tag: "div",
    attrsList: [{name: "id", value: "app"}],
    attrsMap: {id: "app"},
    parent: undefined,
    children: [{
        type: 3,
        text: '这里是文本<箭头之后的文本'
      }],
    plain: false,
    attrs: [{name: "id", value: "'app'"}]
  }
```

再回到`parseHTML`函数，这时`html`又被截去了上面的文本，所以和`last`不相等，再次执行循环。

### round three

这一次的循环与第一次很类似，因为是`a`标签的起始部分，所以同样会走到：

```JavaScript
const startTagMatch = parseStartTag()
if (startTagMatch) {
  handleStartTag(startTagMatch)
  continue
}
```

`parseStartTag`的解析过程上面已经说过，这里返回的值为：

```JavaScript
startTagMatch =  {
  tagName: "a",
  attrs: [[" :href="url"", ":href", "=", "url", undefined, undefined, index: 0, input: " :href="url" target="_blank">{{title}}</a>↵ <img :src="img">↵</div>"], [" target="_blank"", "target", "=", "_blank", undefined, undefined, index: 0, input: " target="_blank">{{title}}</a>↵  <img :src="img">↵</div>"]],
  start: 34,
  end: 65,
  unarySlash: ""
}
```

接着也同样交给`handleStartTag`函数处理，具体过程也不再赘述，这其中，`stack`和`lastTag`的值改变了。

```JavaScript
stack = [{
  attrs: [{name: "id", value: "app"}]
  lowerCasedTag: "div",
  tag: "div"
},{
  attrs: [{name: ":href", value: "url"}, {name: "target", value: "_blank"}]
  lowerCasedTag: "a",
  tag: "a"
}]
lastTag = "a"
```

`start`函数也会再次执行，同样按照刚才的步骤来：

第一步定义基本的ast结构：

```JavaScript
const element2 = {
    type: 1,
    tag: 'a',
    attrsList: [{name: ":href", value: "url"}, {name: "target", value: "_blank"}],
    attrsMap: {':href': 'url', 'target': '_blank'},
    parent: element1,
    children: []
  };
```

第二步到第四步这里同样没有操作。

第五步`processAttrs`函数中多了绑定属性的判断。

```JavaScript
function processAttrs (el) {
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    // dirRE.test(':href') = true
    if (dirRE.test(name)) {
      el.hasBindings = true
      // 解析修饰符
      modifiers = parseModifiers(name)
      if (modifiers) {
        name = name.replace(modifierRE, '')
      }
      if (bindRE.test(name)) { // v-bind
        name = name.replace(bindRE, '')
        value = parseFilters(value)  // filter的解析，这里也没有
        ...
        if (isProp || platformMustUseProp(el.tag, el.attrsMap.type, name)) {
          addProp(el, name, value)
        } else {
          addAttr(el, name, value)
        }
      } else if (onRE.test(name)) { // v-on
        ...
      } else { // normal directives
        ...
      }
    } else {
      ...
    }
  }
}
```

之后ast结构如下：

```JavaScript
const element2 = {
  type: 1,
  tag: 'a',
  attrsList: [{name: ":href", value: "url"}, {name: "target", value: "_blank"}],
  attrsMap: {':href': 'url', 'target': '_blank'},
  attrs: [{name: "href", value: "url"}, {name: "target", value: "'_blank'"}],
  parent: 外层div的ast,
  children: [],
  hasBindings: true,
  plain: false
};
```

第六步都不符合，直接跳过。

第七步，

```JavaScript
if (currentParent && !element.forbidden) {
  if (element.elseif || element.else) {
    ...
  } else if (element.slotScope) { // scoped slot
    ...
  } else {
    currentParent.children.push(element)
    element.parent = currentParent
  }
}
if (!unary) {
  currentParent = element
  stack.push(element)
} else {
  endPre(element)
}
```
执行完这一步，`currentParent`、`stack`以及整个模板的ast如下：

```JavaScript
  currentParent = element2
  stack = [element1, element2]
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
      element2
    ],
    plain: false,
    attrs: [{name: "id", value: "'app'"}]
  }
```

第八步还是没有任何操作。

### round four

这一次循环和第二次循环类似，都是解析文本，然后传入`options.chars`函数。与第二次不同的是，这次解析出来的文本是`前面的文本{{title}}后面的文本`，它绑定了数据`title`。

在`chars`函数中，会走到如下流程：

```JavaScript
if (!inVPre && text !== ' ' && (expression = parseText(text, delimiters))) {
  children.push({
    type: 2,
    expression,
    text
  })
}
```

我们来看看`parseText`函数：

```JavaScript
export function parseText (
  text: string,
  delimiters?: [string, string]
): string | void {
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  if (!tagRE.test(text)) {
    return
  }
  const tokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index
  // match = match = ["{{title}}", "title", index: 5, input: "前面的文本{{title}}后面的文本"]
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      tokens.push(JSON.stringify(text.slice(lastIndex, index)))
    }
    // tag token
    const exp = parseFilters(match[1].trim())
    tokens.push(`_s(${exp})`)
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    tokens.push(JSON.stringify(text.slice(lastIndex)))
  }
  return tokens.join('+')
}
```

整个函数还是比较简单的，首先判断`text`中有没有分隔符，没有就直接返回，这也是第二步中没有走到这个循环的原因。

在`parseText`中的`while`循环把我们的文本分为`"前面的文本"`、`{{title}}`、`"后面的文本"`三部分，并对绑定数据的部分通过`filter`处理，包裹为`_s(${exp})`，`_s`是什么在`vdom`里面我们再做解释，最后返回的值为`"前面的文本"+_s(title)+"后面的文本"`。

到这里，我们整个模板的ast变为如下：

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
      tag: 'a',
      attrsList: [{name: ":href", value: "url"}, {name: "target", value: "_blank"}],
      attrsMap: {':href': 'url', 'target': '_blank'},
      attrs: [{name: "href", value: "url"}, {name: "target", value: "'_blank'"}],
      parent: element1,
      children: [{
        type: 2,
        expression: '"前面的文本"+_s(title)+"后面的文本"',
        text: '前面的文本{{title}}后面的文本'
      }],
      hasBindings: true,
      plain: false
    }
  ],
  plain: false,
  attrs: [{name: "id", value: "'app'"}]
}
```

### round five

再一次回到`parseHTML`中的`while`循环，这时我们的`html`还剩下`</a><img :src="img"></div>`。

显然这回会走到`endTagMatch`

```JavaScript
const endTagMatch = html.match(endTag)
// ["</a>", "a", index: 0, input: "</a>↵  <img :src="img">↵</div>"]
if (endTagMatch) {
  const curIndex = index
  advance(endTagMatch[0].length)
  parseEndTag(endTagMatch[1], curIndex, index)
  continue
}
```

我们这一次走进`parseEndTag`来一探究竟：

```JavaScript
  // tagName = 'a', start = 84, end = 88
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    if (tagName) {
      // 寻找最近的起始`a`标签
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      pos = 0
    }

    if (pos >= 0) {
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
            (i > pos || !tagName) &&
            options.warn) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      ...
    } else if (lowerCasedTagName === 'p') {
      ...
    }
  }
```
上面的代码，我们会走到`options.end`中，我们返回`parse`中，看一看这个方法干了啥。

```JavaScript
end () {
  // remove trailing whitespace
  const element = stack[stack.length - 1]
  const lastNode = element.children[element.children.length - 1]
  if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
    element.children.pop()
  }
  // pop stack
  stack.length -= 1
  currentParent = stack[stack.length - 1]
  endPre(element)
}
```

代码很短，看着就神清气爽，它其实就是一个简单的出栈操作，具体过程如下：

1、取出`stack`中的最后一个元素。

2、取出该元素的最后一个子元素。

3、如果最后一个子元素是纯文本`' '`则删除，这是因为我们的模板一般都会缩进，都会有换行，所以这里是清除换行等添加的内容。

4、`stack`长度减一

5、`currentParent`变为栈中最后一个元素

6、 处理`v-pre`或`pre`的结束标签

这时`stack`和`currentParent`分别变为：

```JavaScript
stack = [element1]
currentParent = element
```

回到`parseEndTag`中，同样也做了一个出栈的操作：

`stack`长度变为`pos`，`lastTag`变为栈中最后一个元素的`tag`，又回到了：

```JavaScript
stack = [{
  attrs: [{name: "id", value: "app"}]
  lowerCasedTag: "div",
  tag: "div"
}]
lastTag = "div"
```

### round six

这一次因为我们的换行，所以会给`div`添加一个空的纯文本结点，也就是`end`中要去掉的`' '`文本结点，模板ast变为：

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
      tag: 'a',
      attrsList: [{name: ":href", value: "url"}, {name: "target", value: "_blank"}],
      attrsMap: {':href': 'url', 'target': '_blank'},
      attrs: [{name: "href", value: "url"}, {name: "target", value: "'_blank'"}],
      parent: element1,
      children: [{
        type: 2,
        expression: '"前面的文本"+_s(title)+"后面的文本"',
        text: '前面的文本{{title}}后面的文本'
      }],
      hasBindings: true,
      plain: false
    },
    {
      text: " ",
      type: 3
    }
  ],
  plain: false,
  attrs: [{name: "id", value: "'app'"}]
}
```

### round seven

这次我们又会走到`startTagMatch`:

```JavaScript
const startTagMatch = parseStartTag()
if (startTagMatch) {
  handleStartTag(startTagMatch)
  continue
}
```

这一次由于我们的`img`是一个单标签，所以`startTagMatch`如下：

```JavaScript
startTagMatch =  {
  tagName: "img",
  attrs: [[" :src="img"", ":src", "=", "img", undefined, undefined, index: 0, input: " :src="img" />    </div>"]],
  start: 91,
  end: 109,
  unarySlash: "/"
}
```
因为单标签不会包含其他内容，所以不会影响栈的深度。

在`handleStartTag`处理时，单标签会直接执行`start`函数，跳过`stack`和`lastTag`的修改。

在`start`函数中，单标签和双标签的区别也是直接跳过`stack`和`currentParent`，属性的解析都相同，这时整个模板的ast又有所改变了。

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
      tag: 'a',
      attrsList: [{name: ":href", value: "url"}, {name: "target", value: "_blank"}],
      attrsMap: {':href': 'url', 'target': '_blank'},
      attrs: [{name: "href", value: "url"}, {name: "target", value: "'_blank'"}],
      parent: element1,
      children: [{
        type: 2,
        expression: '"前面的文本"+_s(title)+"后面的文本"',
        text: '前面的文本{{title}}后面的文本'
      }],
      hasBindings: true,
      plain: false
    },
    {
      text: " ",
      type: 3
    },
    {
      type: 1,
      tag: 'img',
      attrsList: [{name: ":src", value: "img"}],
      attrsMap: {':src': 'img'},
      attrs: [{name: "src", value: "url"}],
      parent: element1,
      children: [],
      hasBindings: true,
      plain: false
    }
  ],
  plain: false,
  attrs: [{name: "id", value: "'app'"}]
}
```

### round eight

这一次与第六次循环一模一样，同样添加了一个空文本子节点，模板ast变为：

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
      tag: 'a',
      attrsList: [{name: ":href", value: "url"}, {name: "target", value: "_blank"}],
      attrsMap: {':href': 'url', 'target': '_blank'},
      attrs: [{name: "href", value: "url"}, {name: "target", value: "'_blank'"}],
      parent: element1,
      children: [{
        type: 2,
        expression: '"前面的文本"+_s(title)+"后面的文本"',
        text: '前面的文本{{title}}后面的文本'
      }],
      hasBindings: true,
      plain: false
    },
    {
      text: " ",
      type: 3
    },
    {
      type: 1,
      tag: 'img',
      attrsList: [{name: ":src", value: "img"}],
      attrsMap: {':src': 'img'},
      attrs: [{name: "src", value: "url"}],
      parent: element1,
      children: [],
      hasBindings: true,
      plain: false
    },
    {
      text: " ",
      type: 3
    }
  ],
  plain: false,
  attrs: [{name: "id", value: "'app'"}]
}
```

### round nine

这一次，找到了我们整个模板的闭合标签，然后执行`end`函数，最终生成的ast就是：


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
      tag: 'a',
      attrsList: [{name: ":href", value: "url"}, {name: "target", value: "_blank"}],
      attrsMap: {':href': 'url', 'target': '_blank'},
      attrs: [{name: "href", value: "url"}, {name: "target", value: "'_blank'"}],
      parent: element1,
      children: [{
        type: 2,
        expression: '"前面的文本"+_s(title)+"后面的文本"',
        text: '前面的文本{{title}}后面的文本'
      }],
      hasBindings: true,
      plain: false
    },
    {
      text: " ",
      type: 3
    },
    {
      type: 1,
      tag: 'img',
      attrsList: [{name: ":src", value: "img"}],
      attrsMap: {':src': 'img'},
      attrs: [{name: "src", value: "url"}],
      parent: element1,
      children: [],
      hasBindings: true,
      plain: false
    }
  ],
  plain: false,
  attrs: [{name: "id", value: "'app'"}]
}
```

## 结语

至此，我们通过一个保护绑定属性、包含纯文本、包含文本模板、包含单标签、包含双标签的实例，一步一步详细的分析了把`html`字符串解析为`ast`的过程。之后对于各种复杂的指令等，我们单独讲解。