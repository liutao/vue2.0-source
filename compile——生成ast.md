我们直接来看`src/compiler/parser/index.js`文件中的`parse`函数，其它内容暂且不管，我们看到该函数中主要执行了`parseHTML`函数，从函数名我们很直观的可以猜到，该函数用于解析`HTML`模板。

我们打开`src/compiler/parser/html-parser.js`文件来看它的实现。

## 正则表达式

首先是定义了一堆密密麻麻的正则表达式。相信很多人看到这些复杂的正则都一个头两个大。由于我的水平也比较有限，马马虎虎带大家过一下这些正则。

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