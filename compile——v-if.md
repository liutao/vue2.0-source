本篇文章，我们要讲解的是`v-if`指令从解析到生成`render`函数的过程。

同样假定你已经阅读了[compile——生成ast](compile——生成ast.md)和[compile——生成render字符串](compile——生成render字符串.md)这两篇文章，知道了`html`模板处理的基本流程。

例子如下：

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

我们这里有三个`p`标签，所以会分别生成`ast`。我们一个一个来看~

## `v-if`

