本篇文章，我们简单的介绍几个`Vue`内置指令的实现。



## `v-text`

`v-text`的用法很简单，以下两个表达式的作用相同。

```html
<span v-text="msg"></span>
<span>{{msg}}</span>
```

和所有普通指令一样，在生成`ast`时，`v-text`会被解析到`el.directives`中。但在生成`render`函数的过程中，在解析属性时，我们会首先解析指令。`genDirectives`方法中有如下一段代码：

```JavaScript
const gen: DirectiveFunction = platformDirectives[dir.name] || baseDirectives[dir.name]
if (gen) {
  // compile-time directive that manipulates AST.
  // returns true if it also needs a runtime counterpart.
  needRuntime = !!gen(el, dir, warn)
}
if (needRuntime) {
  hasRuntime = true
  res += `...`
}
```

[directives概述](directives概述.md)中我们也提到过，`platformDirectives`和`baseDirectives`会对部分内置指令进行处理。`v-text`就是其中之一。

最终的`gen`函数如下所示：

```JavaScript
export default function text (el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'textContent', `_s(${dir.value})`)
  }
}
```

该函数返回的是`undefined`，所以`needRuntime`最终是`false`，所以该结果不会添加到`res`上。

`addProp`的定义如下：

```JavaScript
export function addProp (el: ASTElement, name: string, value: string) {
  (el.props || (el.props = [])).push({ name, value })
}
```

它会给`el.props`数组中添加一个对象，对象里保存的`name`和`value`。

```JavaScript
// DOM props
if (el.props) {
  data += `domProps:{${genProps(el.props)}},`
}
```

最终，会添加到`domProps`对应的数组中。上面例子中的`span`，最终生成的`render`函数如下：

```JavaScript
_c('span',{domProps:{"textContent":_s(msg)}})
```

在`patch`过程中的处理，和其他`data`中的数据一样，是通过钩子函数处理的。

```JavaScript
function updateDOMProps (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (!oldVnode.data.domProps && !vnode.data.domProps) {
    return
  }
  let key, cur
  const elm: any = vnode.elm
  const oldProps = oldVnode.data.domProps || {}
  let props = vnode.data.domProps || {}
  // clone observed objects, as the user probably wants to mutate it
  if (props.__ob__) {
    props = vnode.data.domProps = extend({}, props)
  }

  for (key in oldProps) {
    if (props[key] == null) {
      elm[key] = ''
    }
  }
  for (key in props) {
    cur = props[key]
    if (key === 'textContent' || key === 'innerHTML') {
      if (vnode.children) vnode.children.length = 0
      if (cur === oldProps[key]) continue
    }

    if (key === 'value') {
      // store value as _value as well since
      // non-string values will be stringified
      elm._value = cur
      // avoid resetting cursor position when value is the same
      const strCur = cur == null ? '' : String(cur)
      if (shouldUpdateValue(elm, vnode, strCur)) {
        elm.value = strCur
      }
    } else {
      elm[key] = cur
    }
  }
}
```

首先会重置`oldProps`中`props`上不存在的属性。然后遍历`props`中的属性，如果`key`值`textContent`或`innerHTML`，则清除`children`的内容。

如果`key === 'value'`这里应该对`input`、`select`等标签的特殊处理。否则，直接设置`elm.textContent = cur`，以此来改变文本内容。

## `v-html`

`v-html`和`v-text`的用法和处理流程基本完全一样，唯一的区别就是最终`v-html`设置的`elm.innerHTML = cur`。

用法示例如下：

```html
<span v-html="msg"></span>
```



##  `v-cloak`

这个指令用的比较少，不懂的人看完[官方文档](https://cn.vuejs.org/v2/api/#v-cloak)的说明可能还是稀里糊涂的。它的`ast`生成和上面讲的普通指令一样，在`genDirectives`时，`baseDirectives`中包含了`cloak`，但最终返回的`gen`是一个空函数。最终它也不会添加到`directives`数组中，之后也就没有了对它的处理。

因为我们的模板再编译的过程中，页面中是会显示` Mustache` 标签的。该指令就是在模板编译之后，被删除。我们可以添加`[v-cloak] { display: none }`，来防止用户感知到`Mustache` 标签 出现。



## `v-pre`

`v-pre`表示该会跳过该标签及其子元素的编译。

在编译模板时的`start`回调函数中，有如下片段：

```JavaScript
if (!inVPre) {
  processPre(element)
  if (element.pre) {
    inVPre = true
  }
}
 if (inVPre) {
   processRawAttrs(element)
 } else {
   ...
 }
```

`processPre`函数会获取`element`上的`v-pre`属性，如果有则设置`element.pre = true`，同时设置`inVPre = true`。

接下来的处理，会走进`processRawAttrs`函数。`else`块内对各种指令、属性等的处理，都不会执行。

```JavaScript
function processRawAttrs (el) {
  const l = el.attrsList.length
  if (l) {
    const attrs = el.attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attrsList[i].name,
        value: JSON.stringify(el.attrsList[i].value)
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}
```

这里是对属性的处理，如果`el.attrsList`不为空数组，则直接循环`el.attrsList`上的属性添加到`el.attrs`上。否则，如果当前元素没有设置`v-pre`指令（是设置`v-pre`元素的子元素），则设置`el.plain = true`。

因为我们不编译的是整个子树，而不是单个元素。`Vue`中就是通过`inVPre`来标示的，我们`parse`的整个过程就是入栈出栈，当子元素都编译完，会走到当前元素的`end`处理，此时再设置`inVPre = false`，来结束不编译的内容。