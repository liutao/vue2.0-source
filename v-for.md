本篇文章，我们主要讲解`v-for`指令的处理流程。`v-for`是我们最常用的指令之一，我们从一个例子入手，详细的看一下`Vue`中对它的处理流程。

```HTML
<div id="app">
  <p v-for="(value, key, index) in object">{{ index }}. {{ key }} : {{ value }}</p>
</div>
<script type="text/javascript">
  var vm = new Vue({
    el: '#app',
    data: {
      object: {
        height: '178cm',
        weight: '80kg',
        gender: 'male',
        address: 'BeiJing'
      }
    }
  })
</script>
```

还是从`src/compiler/parse/index.js`文件入手，在`start`函数中，对于`v-for`指令，我们通过`processFor`方法来进行解析：

```JavaScript
function processFor (el) {
  let exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    const inMatch = exp.match(forAliasRE)
    if (!inMatch) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid v-for expression: ${exp}`
      )
      return
    }
    el.for = inMatch[2].trim()
    const alias = inMatch[1].trim()
    const iteratorMatch = alias.match(forIteratorRE)
    if (iteratorMatch) {
      el.alias = iteratorMatch[1].trim()
      el.iterator1 = iteratorMatch[2].trim()
      if (iteratorMatch[3]) {
        el.iterator2 = iteratorMatch[3].trim()
      }
    } else {
      el.alias = alias
    }
  }
}
```

`getAndRemoveAttr`从字面上我们就猜得到，它的功能是删除`v-for`属性，并返回该属性对应的值。这里`exp`的值为`(value, key, index) in object`。之前我们提到过`forAliasRE`：

```JavaScript
export const forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/
```

从正则我们知道`v-for`中，使用`in`或者`of`是完全一样的。匹配之后，`inMatch`的值为`["(value, key, index) in object", "(value, key, index)", "object", index: 0, input: "(value, key, index) in object"]`。

所以`el.for`中保存的就是我们要遍历的对象或数组或数字或字符串。

再来看`forIteratorRE`：

```JavaScript
export const forIteratorRE = /\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/
```

我们`v-for`可以有如下形式：

```JavaScript
v-for="item in items"
v-for="(item, index) in items"
v-for="(value, key, index) in object"
```

我们的例子中，是最全的一种，其中`value`是属性值、`key`是属性名、`index`是索引值。

所以，最终处理完`ast`中添加了如下属性：

```JavaScript
el.alias = value
el.iterator1 = key
el.iterator2 = index
```

最终经过静态内容处理之后的`p`标签对应`ast`结构为：

```JavaScript
{
  alias: "value",
  attrsList: [],
  attrsMap: {v-for: "(value, key, index) in object"},
  children: [{
    expression: "_s(index)+". "+_s(key)+" : "+_s(value)",
    text: "{{ index }}. {{ key }} : {{ value }}",
    type: 2,
    static: false
  }],
  for: "object",
  iterator1: "key",
  iterator2: "index",
  plain: true,
  tag: "p",
  type: 1,
  static: false,
  staticRoot: false
}
```

接着，就是根据`ast`结果，生成对应的`render`字符串。

打开`src/compiler/codegen/index.js`文件，这回我们会走到`genFor`函数中，

```JavaScript
function genFor (el: any): string {
  const exp = el.for
  const alias = el.alias
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

  if (
    process.env.NODE_ENV !== 'production' &&
    maybeComponent(el) && el.tag !== 'slot' && el.tag !== 'template' && !el.key
  ) {
    warn(
      `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
      `v-for should have explicit keys. ` +
      `See https://vuejs.org/guide/list.html#key for more info.`,
      true /* tip */
    )
  }

  el.forProcessed = true // avoid recursion
  return `_l((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${genElement(el)}` +
    '})'
}
```

这里`if`块是开发环境做一些校验。如果是自定义元素且不是`slot`和`template`，则必须有`el.key`。

最终返回的拼接后的字符串是一个`_l`函数，其中第一个参数是`el.for`即`object`，第二个参数是一个函数，函数的参数是我们的三个变量`value`、`key`、`index`。该函数返回值中再次调用`genElement`生成`p`元素的`render`字符串。

最终生成的`render`函数字符串为：

```JavaScript
"_c('div',{attrs:{"id":"app"}},_l((object),function(value,key,index){return _c('p',[_v(_s(index)+". "+_s(key)+" : "+_s(value))])}))"
```

前面提到过，`_c`是创建一个`vnode`对象、`_v`是创建一个`vnode`文本结点，这些我们在`vnode`中详细讲解，这里我们重点说一些`_l`。从`render.js`中，我们知道它对应的函数就是`src/core/instance/render-helpers/render-list.js`中的`renderList`方法。

```JavaScript
export function renderList (
  val: any,
  render: () => VNode
): ?Array<VNode> {
  let ret, i, l, keys, key
  // 数组或字符串
  if (Array.isArray(val) || typeof val === 'string') {
    ret = new Array(val.length)
    for (i = 0, l = val.length; i < l; i++) {
      ret[i] = render(val[i], i)
    }
  // 数字
  } else if (typeof val === 'number') {
    ret = new Array(val)
    for (i = 0; i < val; i++) {
      ret[i] = render(i + 1, i)
    }
  // 对象
  } else if (isObject(val)) {
    keys = Object.keys(val)
    ret = new Array(keys.length)
    for (i = 0, l = keys.length; i < l; i++) {
      key = keys[i]
      ret[i] = render(val[key], key, i)
    }
  }
  return ret
}
```
我们这里传入的`val`就是`object`，`render`就是生成`p`段落的`render`函数。

代码中的三段`if`判断，是因为我们`v-for`可以遍历的不止数组和对象，还有数字和字符串。

最终返回的`ret`是一个`VNode`数组，每一个元素都是一个`p`标签对应的`VNode`。

从上面的分析中，我们也可以看出`v-for`影响的范围只是在生成`VNode`对象生成的个数，而对`VNode`内部没有影响。