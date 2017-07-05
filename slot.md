`slot`的用法相信大家都已经很熟悉了，通过合理的使用它我们可以把在父组件中定在子组件内的元素传递到子元素内，本篇文章就带着大家来看一下`Vue`中`slot`功能是如何实现的。`Vue`中原生提供的三个全局抽象组件`keep-alive`、`transition`以及`transition-group`都是基于`slot`实现的。

我们先来看一个简单的例子，然后跟着例子往下看：

```JavaScript
<div id="app">
	<app-layout>
		<p>主要内容的一个段落。</p>
		<h1 slot="header">这里可能是一个页面标题</h1>
		<div>另一个主要段落。</div>
		<p slot="footer">这里有一些联系信息</p>
	</app-layout>
</div>
<script type="text/javascript">
	var vm = new Vue({
		el: '#app',
		components: {
			AppLayout: {
				template: '<div class="container">\
					<header>\
						<slot name="header"></slot>\
					</header>\
					<main>\
						<slot></slot>\
					</main>\
					<footer>\
						<slot name="footer"></slot>\
					</footer>\
				</div>'
			}
		}
	})
</script>
```

以上例子运行结果我就不再多说，大家自行查看。这里的模板解析，涉及到了父组件和子组件两个组件的内容，我们先来看父组件。

我们前面讲`parser`时，在`html -> ast`的这一过程，会把标签上的属性、指令等抽取出来放到`ast`中。对`slot`的解析，是在`processSlot`方法中。

```JavaScript
function processSlot (el) {
  if (el.tag === 'slot') {
    el.slotName = getBindingAttr(el, 'name')
    if (process.env.NODE_ENV !== 'production' && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`
      )
    }
  } else {
    const slotTarget = getBindingAttr(el, 'slot')
    if (slotTarget) {
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
    }
    if (el.tag === 'template') {
      el.slotScope = getAndRemoveAttr(el, 'scope')
    }
  }
}

```