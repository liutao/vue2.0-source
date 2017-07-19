本篇文章，我们要讲解的是`v-if`指令的解析过程，同样我们还是从一个例子入手：

```HTML
<div id="app">
  <p v-if="value == 1">v-if块的内容</p>
  <p v-else-if="value == 2">v-else-if块的内容</p>
  <p v-else>v-else块的内容</p>
</div>
<script type="text/javascript">
  var vm = new Vue({
	el: '#app',
	data: {
	  value: 2
	}
  })
</script>
```

相信大家一眼就猜到页面中显示的是`v-else-if块的内容`。同时打开页面审查元素，会发现其它两块内容都没有渲染到页面上。

我们还是简单的带着大家过一下解析的过程。

## 生成`ast`

与其它指令类似，`parse`函数中，调用了一个单独的函数来处理`v-if`指令——`processIf`:

```JavaScript
function processIf (el) {
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}
```

我们这里有三个`p`标签，所以会分别生成`ast`。`end`和`chars`的处理就略过了，我们只看`start`中的处理~

1、 `v-if`

第一个`p`标签，在执行`processIf`函数时，`exp = getAndRemoveAttr(el, 'v-if')`结果返回`value == 1`，所以会走到`if`块。

```JavaScript
function addIfCondition (el, condition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}
```

`addIfCondition`会给`el`添加一个`ifConditions`来保存当前`v-if`相关的元素。

2、 `v-else-if`

第二个`p`标签，同样会在`processIf`函数中进行处理，这次会走到`else`，并使得`el.elseif = "value == 2"`。

接着往下执行，会走到如下判断条件：

```JavaScript
if (currentParent && !element.forbidden) {
  if (element.elseif || element.else) {
    processIfConditions(element, currentParent)
  } else if (element.slotScope) { // scoped slot
    ...
  } else {
    currentParent.children.push(element)
    element.parent = currentParent
  }
}
```

如果当前标签是`elseif`或`else`，如果我们自己实现，首先想到的是从当前元素往前，找到第一个有`v-if`的标签。`Vue`中其实也是这样：

```JavaScript
function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children)
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`
    )
  }
}
function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  while (i--) {
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`
        )
      }
      children.pop()
    }
  }
}
```

`findPrevElement`会先拿到当前元素前面的兄弟结点，然后从后往前寻找第一个标签元素。夹在当前元素和`v-if`元素之间的文本结点会被删除，并在开发环境给予提示。

如果`prev`元素存在且`prev.if`存在，则把当前元素和条件添加到`prev`的`ifConditions`数组中。

从上面的代码中我们还看到，如果`element.elseif || element.else`返回`true`，是不会走到最后一个`else`块，也就是说不会建立当前元素和`currentParent`元素的父子关系，我们的例子中，`div`的`children`中只会有`v-if`的标签。

3、 `v-else`

`v-else`的处理和`v-else-if`基本一致，区别就是最后添加到`v-if`元素`ifConditions`数组中的对象的`exp`值为`undefined`(此时`el.elseif`是`undefined`)。

所以最终生成的`ast`主要结构如下(详细的`ast`太长，大家有兴趣的可以自己打印一下)：

```JavaScript
{
  type: 1,
  tag: 'div',
  plain: false,
  children: [{
    type: 1,
    tag: 'p',
    children: [{
      text: 'v-if块的内容',
      type: 3
    }]
    if: 'value == 1',
    ifConditions: [{
      exp: "value == 1",
      block: {
	    type: 1,
	    tag: 'p',
	    children: [{
	      text: 'v-if块的内容',
	      type: 3
	    }],
	    if: 'value == 1',
	    ifConditions: [],
	    plain: true
	  }
    }, {
      exp: "value == 2",
      block: {
	    type: 1,
	    tag: 'p',
	    children: [{
	      text: 'v-else-if块的内容',
	      type: 3
	    }],
	    elseif: 'value == 2',
	    plain: true
	  }
    }, {
      exp: undefined,
      block: {
	    type: 1,
	    tag: 'p',
	    children: [{
	      text: 'v-else块的内容',
	      type: 3
	    }],
	    else: true,
	    plain: true
	  }
    }]
  }]
}
```

## 生成`render`

拿到`ast`，经过静态内容处理，我们就到了把`ast`转换为`render`函数字符串的步骤。

`src/compiler/codegen/index.js`文件中对`v-if`的处理是在`genIf`函数中:

```JavaScript
function genIf (el: any): string {
  el.ifProcessed = true // avoid recursion
  return genIfConditions(el.ifConditions.slice())
}

function genIfConditions (conditions: ASTIfConditions): string {
  if (!conditions.length) {
    return '_e()'
  }

  const condition = conditions.shift()
  if (condition.exp) {
    return `(${condition.exp})?${genTernaryExp(condition.block)}:${genIfConditions(conditions)}`
  } else {
    return `${genTernaryExp(condition.block)}`
  }

  // v-if with v-once should generate code like (a)?_m(0):_m(1)
  function genTernaryExp (el) {
    return el.once ? genOnce(el) : genElement(el)
  }
}
```

`genIfConditions`会循环处理`ifConditions`里面的每一个元素，直到找到`exp`返回`true`的元素。

如果`conditions.length`为0，则返回`_e()`，该方法对应的是`createEmptyVNode`。

否则取出`conditions`中第一个元素，如果`condition.exp`不为空，则进入`if`块，此时返回的是一个三目运算符，如果表达式为真，则返回`genTernaryExp(condition.block)`的返回值，否则再次调用`genIfConditions(conditions)`。如果`condition.exp`为空，则直接返回`genTernaryExp(condition.block)`。

`genTernaryExp`会判断`el.once`即当前元素上是否有`v-once`指令，如果有，则返回`getOnce(el)`，否则返回`genElement(el)`。

最终生成的`render`函数字符串如下：

```JavaScript
with(this){return _c('div',{attrs:{"id":"app"}},[(value == 1)?_c('p',[_v("v-if块的内容")]):(value == 2)?_c('p',[_v("v-else-if块的内容")]):_c('p',[_v("v-else块的内容")])])}
```

直接看子元素数组部分，如果`value == 1`返回真，则创建第一个有`v-if`指令的`p`标签及其子内容，否则如果`value == 2`返回真，则创建第二个有`v-else-if`指令的`p`标签及其子内容，否则创建最后有`v-else`指令的`p`标签及其子内容。

和`v-for`类似，`v-if`也只是控制了要绘制哪些元素，相关数据不会带到`VNode`对象中。

## 补充

在`Vue`中，我们知道一个组件只能有一个根元素，但是如果根元素上有`v-if`指令，则可以有多个同级元素。

```HTML
<div id="app"></div>
<script type="text/javascript">
  new Vue({
    template: '<p v-if="value == 1">v-if块的内容</p>\
	<p v-else-if="value == 2">v-else-if块的内容</p>\
	<p v-else>v-else块的内容</p>',
    data: {
      value: 3
    }
  }).$mount('#app');
</script>
```

比如如上例子，是可以正常在页面中渲染的。在`parse`中，有如下代码：

```JavaScript
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
```

第一个`p`标签会当成根元素，所以解析第二个`p`标签时，会走到`else if`，之后的操作和我们上面的讲的大致相同。其实从上面内容我们也可以知道，对于`v-if`的解析，最终生成的`ast`中只有`v-if`所在的标签，其它关联内容都在`ifCondition`内。