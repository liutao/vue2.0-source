生成`ast`的函数是`src/compiler/parser/index.js`文件中的`parse`函数，从这里入手，我们一起来看看一段`html`字符串，是如何一步步转换成抽象语法树的。

这一部分会涉及到许许多多的正则匹配，知道每个正则有什么用途，会更加方便之后的分析。

我们打开`src/compiler/parser/html-parser.js`文件来看它的实现。

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

```HTML
<div id="app">
	这里是文本<箭头之后的文本
	<a :href="url" target="_blank" >{{title}}</a>
	<img :src="img" />
</div>
<script type="text/javascript">
	var vm = new Vue({
		el: '#app',
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
    last = html
    
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
      	... 
      }

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

      if (textEnd < 0) {
        text = html
        html = ''
      }

      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      var stackedTag = lastTag.toLowerCase()
      var reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      var endTagLength = 0
      var rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!--([\s\S]*?)-->/g, '$1')
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
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
["<div", "div", index: 0, input: "<div id="app">↵	这里是文本&lt;箭头之后的文本↵	<a :href="url" t…t="_blank">{{title}}</a>↵	<img :src="img">↵</div>"]
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
[">", "", index: 0, input: ">↵	这里是文本&lt;箭头之后的文本↵	<a :href="url" target="_blank">{{title}}</a>↵	<img :src="img">↵</div>"]
```
所以最终`match`如下：

```JavaScript
match = {
	tagName: "div",
	attrs: [[" id="app"", "id", "=", "app", undefined, undefined, index: 0, input: " id="app">↵	这里是文本&lt;箭头之后的文本↵	<a :href="url" target="_blank">{{title}}</a>↵	<img :src="img">↵</div>"]],
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
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
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

我们在`parse`中传入了`start`函数，接着会执行`start`函数：

```JavaScript
    start (tag, attrs, unary) {
      // 获取命名空间
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      const element: ASTElement = {
        type: 1,
        tag,
        attrsList: attrs,
        attrsMap: makeAttrsMap(attrs),
        parent: currentParent,
        children: []
      }
      if (ns) {
        element.ns = ns
      }

      ...

      // apply pre-transforms
      for (let i = 0; i < preTransforms.length; i++) {
        preTransforms[i](element, options)
      }

      // v-pre指令来标识该元素和子元素不用编译
      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
      } else {
        processFor(element)
        processIf(element)
        processOnce(element)
        processKey(element)

        // determine whether this is a plain element after
        // removing structural attributes
        element.plain = !element.key && !attrs.length

        processRef(element)
        processSlot(element)
        processComponent(element)
        for (let i = 0; i < transforms.length; i++) {
          transforms[i](element, options)
        }
        processAttrs(element)
      }

      ...

      // tree management
      if (!root) {
        root = element
        checkRootConstraints(root)
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        if (root.if && (element.elseif || element.else)) {
          checkRootConstraints(element)
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          })
        } else if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`
          )
        }
      }
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
      // apply post-transforms
      for (let i = 0; i < postTransforms.length; i++) {
        postTransforms[i](element, options)
      }
    }
```

这部分代码比较长，且比较核心，我们慢慢讲解：

1、 定义基本的ast结构

2、 对ast进行预处理(`preTransforms`)

3、 解析`v-pre`、`v-if`、`v-for`、`v-once`、`slot`、`key`、`ref`等指令。

4、 对ast处理(`transforms`)

5、 解析`v-bind`、`v-on`以及普通属性

6、 `v-else`等处理

7、 模板元素父子关系的建立

8、对ast后处理(`postTransforms`)

第一步定义基本的ast结构：

```JavaScript
const element = {
    type: 1,
    tag: "div",
    attrsList: [{name: "id", value: "app"}],
    attrsMap: {id: "app"},
    parent: undefined,
    children: []
  }
```

第二步对ast的预处理在`weex`中才会有，我们直接跳过。

第三步对不同指令的解析，我们之后再做讲解。

第四步中只有对`class`和`style`属性操作。

第五步中主要是`processAttrs`函数。

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
const element = {
    type: 1,
    tag: "div",
    attrsList: [{name: "id", value: "app"}],
    attrsMap: {id: "app"},
    parent: undefined,
    children: [],
    plain: false,
    attrs: [{name: "id", value: "'app'"}],
  }
