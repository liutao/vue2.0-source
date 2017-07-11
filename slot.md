`slot`的用法相信大家都已经很熟悉了，通过合理使用它我们可以把在父组件中定义的元素传递到子元素内使用，`Vue`中原生提供的三个全局抽象组件`keep-alive`、`transition`以及`transition-group`都是基于`slot`实现的。

`Vue`在2.1.0中还新增了作用域插槽，它和`slot`关系密切，但实现方式又不尽相同。本篇文章，前半部分带着大家看一下`Vue`中`slot`功能是如何实现的，后半部分讲解一下作用域插槽功能的实现。

## `slot`

按照惯例，我们还是先从一个比较全面的[例子](example/slot.html)入手：

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
						<slot name="notExist"><p>这是降级使用的段落</p></slot>\
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

以上例子运行结果我就不再多说，大家自行查看。这个例子比较全面的包含了`slot`的多种用法。这里的模板解析，涉及到了父组件和子组件两个组件的内容，我们依次来看。


### 父组件解析

我们前面讲`parser`时，在`html -> ast`的这一过程，会把标签上的属性、指令等抽取出来放到`ast`中。对`slot`的解析，是在`processSlot`方法中。

```JavaScript
function processSlot (el) {
  if (el.tag === 'slot') {
    ...
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

简单看一下这个方法内的部操作，`el.tag === 'slot'`是用于子组件中。父组件并没有`slot`标签，所以会走到`else`里面，如果有`slot`属性，则给`el`上添加`slotTarget`属性，来作为具名`slot`。`template`主要是作用域插槽处理稍后再说。

在生成`render`字符串时，会把它添加到元素的`data`中，如下：

```JavaScript
  // slot target
  if (el.slotTarget) {
    data += `slot:${el.slotTarget},`
  }
```

父组件的处理其实比较简单，仅仅是获取`slot`属性，并添加到了当前元素的`data`上。

前面讲`patch`的时候，我们知道元素渲染到页面上或`diff`的过程，是从父级元素向下，一层一层处理。当处理到自定义组件时，会调用组件的各种钩子函数，子组件内部的内容，都交付给子组件来处理。

创建组件`VNode`时的一些操作，[之前](vdom——VNode.md)已经讲过，我们会调用它的`init`钩子函数，来创建一个新的`Vue`实例。

### 子组件处理

在创建新对象时会把`app-layout`的子元素，传递给构造函数。在`initRender`时，把子内容处理后添加给`vm.$slots`。

```JavaScript
export function initRender (vm: Component) {
  ...
  const parentVnode = vm.$options._parentVnode
  const renderContext = parentVnode && parentVnode.context
  vm.$slots = resolveSlots(vm.$options._renderChildren, renderContext)
  ...
}
```

上面`vm.$options._renderChildren`就是父组件中，`app-layout`生成的`VNode`对象的`children`数组，`renderContext`指向的是父组件的运行环境。

`resolveSlots`的实现如下：

```JavaScript
	export function resolveSlots (
	  children: ?Array<VNode>,
	  context: ?Component
	): { [key: string]: Array<VNode> } {
	  const slots = {}
	  if (!children) {
	    return slots
	  }
	  const defaultSlot = []
	  let name, child
	  for (let i = 0, l = children.length; i < l; i++) {
	    child = children[i]
	    // named slots should only be respected if the vnode was rendered in the
	    // same context.
	    if ((child.context === context || child.functionalContext === context) &&
	        child.data && (name = child.data.slot)) {
	      const slot = (slots[name] || (slots[name] = []))
	      if (child.tag === 'template') {
	        slot.push.apply(slot, child.children)
	      } else {
	        slot.push(child)
	      }
	    } else {
	      defaultSlot.push(child)
	    }
	  }
	  // ignore whitespace
	  if (!defaultSlot.every(isWhitespace)) {
	    slots.default = defaultSlot
	  }
	  return slots
	}

	function isWhitespace (node: VNode): boolean {
	  return node.isComment || node.text === ' '
	}
```

该函数其实就是根据`slot`属性值进行分组，默认的是`default`。因为我们的换行符等会生成空的文本，`isWhitespace`是判断元素是评论或空文本。最终生成的`slots`是一个键值对，键是`slot`属性值，值是对应元素的`vnode`数组。

最终生成的`slots`如下：

```JavaScript
{
	default: [p, ' ', ' ', div, ' '],
	header: [h1], 
	footer: [p] 
}
```

之后，我们会对子组件的模板进行解析，这一次`processSlot`函数的处理，会走到`if`块。

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
    ...
  }
}
```

其实也很简单，只是拿到了`slot`标签的`name`属性，并赋值给`el.slotName`。在生成`render`函数字符串时，会进行如下处理。

```JavaScript
	function genSlot (el: ASTElement): string {
	  const slotName = el.slotName || '"default"'
	  const children = genChildren(el)
	  let res = `_t(${slotName}${children ? `,${children}` : ''}`
	  const attrs = el.attrs && `{${el.attrs.map(a => `${camelize(a.name)}:${a.value}`).join(',')}}`
	  const bind = el.attrsMap['v-bind']
	  if ((attrs || bind) && !children) {
	    res += `,null`
	  }
	  if (attrs) {
	    res += `,${attrs}`
	  }
	  if (bind) {
	    res += `${attrs ? '' : ',null'},${bind}`
	  }
	  return res + ')'
	}
```

如果是`slot`元素，就会执行`genSlot`函数。首先，获取`el.slotName`的值，默认是`"default"`。`children`是当前`slot`的子元素数组，这里我们是作为没有匹配的`slot`时，降级显示。我们上面的那个例子中，在`<slot name="notExist"><p>这是降级使用的段落</p></slot>`中，`children`就是生成`p`元素的`vnode`对象的函数，其它`slot`都是空。`attrs`是把`el.attrs`上属性名从中划线连接变为驼峰式，`bind`是`v-bind`通过属性绑定的对象，`attrs`和`bind`主要都用于作用域插槽中传值。最终子组件生成的`render`函数如下：

```JavaScript
"with(this){return _c('div',{staticClass:"container"},[_c('header',[_t("header")],2),_v(" "),_c('main',[_t("default"),_v(" "),_t("notExist",[_c('p',[_v("这是降级使用的段落")])])],2),_v(" "),_c('footer',[_t("footer")],2)])}"
```

我们注意到，每个`slot`最终的`vnode`生成，是通过`_t`方法。从`src/core/instance/render`文件中我们可以知道`_t`对应的是`renderSlot`方法。

```JavaScript
	export function renderSlot (
	  name: string,
	  fallback: ?Array<VNode>,
	  props: ?Object,
	  bindObject: ?Object
	): ?Array<VNode> {
	  const scopedSlotFn = this.$scopedSlots[name]
	  if (scopedSlotFn) { // scoped slot
	    ...
	  } else {
	    const slotNodes = this.$slots[name]
	    // warn duplicate slot usage
	    if (slotNodes && process.env.NODE_ENV !== 'production') {
	      slotNodes._rendered && warn(
	        `Duplicate presence of slot "${name}" found in the same render tree ` +
	        `- this will likely cause render errors.`,
	        this
	      )
	      slotNodes._rendered = true
	    }
	    return slotNodes || fallback
	  }
	}
```
该方法接收四个参数，第一个就是`slot`的`name`属性值，第二个是降级用的`vnode`数组，第三个就是我们上面的`attrs`，第四个是上面的`bind`。

`scopedSlots`是作用域插槽相关的内容，我们稍后讲解，这里来看`else`块内容。首先会从`this.$slots`中找有没有`name`匹配的内容，如果有则直接放回，没有则返回降级的`fallback`。

在我们的例子中，`notExist`没有对应的元素，所以会渲染里面的`p`标签，其它的`slot`都会渲染名字相对应的在父组件中定义的元素。从这里我们也可以看到，父组件中定义一次的元素，子组件中可以通过多个`slot`来多次渲染。


## 作用域插槽

接着我们再来看作用域插槽，同样还是从一个[例子](example/template-slot.html)入手:

```JavaScript
<div id="app">
	<app-layout :items="items">
		<template slot="item" scope="aaa">
			<li>{{ aaa.text }}{{ aaa.name }}</li>
		</template>
	</app-layout>
</div>
<script type="text/javascript">
	var vm = new Vue({
		el: '#app',
		components: {
			AppLayout: {
				template: '<ul>\
						<slot name="item"\
							v-for="item in items"\
							:text="item.text" v-bind="{name: \'liutao\'}">\
						</slot>\
					</ul>',
				props: {
					items: Array
				}
			}
		},
		data: {
			items: [{
				text: 'text1'
			}, {
				text: 'text2'
			}, {
				text: 'text3'
			}]
		}
	})
</script>
```

同样，分为父组件和子组件两个部分处理，我们依次讲解。

### 父组件解析

还是`processSlot`方法，这次我们`else`块中，会给`el`添加两个属性`slotTarget`和`slotScope`，它们分别是`slot`和`scope`属性的值。

```JavaScript
function processSlot (el) {
  if (el.tag === 'slot') {
    ...
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

与之前不同，因为我们的`template`不对应真实的元素，它只是一个容器，所以在父组件的模板解析过程中，还对它进行了处理。

```JavaScript
  if (currentParent && !element.forbidden) {
    if (element.elseif || element.else) {
      ...
    } else if (element.slotScope) { // scoped slot
      currentParent.plain = false
      const name = element.slotTarget || '"default"'
      ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
    } else {
      currentParent.children.push(element)
      element.parent = currentParent
    }
  }
```

如果有`element.slotScope`不为空，我们会给它的父元素（这里的`app-layout`）的`ast`添加一个`scopedSlots`对象，用于保存`slotTarget`对应元素的`ast`。同时，`template`和`app-layout`是没有父子关系的。

在生成`render`函数时，会执行如下操作：

```JavaScript
  // scoped slots
  if (el.scopedSlots) {
    data += `${genScopedSlots(el.scopedSlots)},`
  }
```

`genScopedSlots`函数会将`scopedSlots`属性添加给元素的`data`中。

```JavaScript
	function genScopedSlots (slots: { [key: string]: ASTElement }): string {
	  return `scopedSlots:_u([${
	    Object.keys(slots).map(key => genScopedSlot(key, slots[key])).join(',')
	  }])`
	}

	function genScopedSlot (key: string, el: ASTElement) {
	  return `[${key},function(${String(el.attrsMap.scope)}){` +
	    `return ${el.tag === 'template'
	      ? genChildren(el) || 'void 0'
	      : genElement(el)
	  }}]`
	}
```

具体处理就是每个`key`都对应一个数组，数组第一个元素是`key`值，第二个元素是返回生成`vnode`对象的函数。更直观的结果如下：

```JavaScript
"with(this){return _c('div',{attrs:{"id":"app"}},[_c('app-layout',{attrs:{"items":items},scopedSlots:_u([["item",function(aaa){return [_c('li',[_v(_s(aaa.text))])]}]])})],1)}"
```

`item`对应`slot`属性的值，`aaa`对应`scope`属性的值。我们重点来看一下`_u`的实现，从`src/core/instance/render`文件中我们可以知道`_u`对应的是`resolveScopedSlots`方法。

```JavaScript
	export function resolveScopedSlots (
	  fns: Array<[string, Function]>
	): { [key: string]: Function } {
	  const res = {}
	  for (let i = 0; i < fns.length; i++) {
	    res[fns[i][0]] = fns[i][1]
	  }
	  return res
	}
```

它的功能也很简单，就是把传入的二维数组转变成键值对，键是`slot`的`name`对应的名字，值是一个函数。以上就是父组件中所做的操作，接着在创建子组件时，会在子组件中获取`data`中的`scopedSlots`。

### 子组件的处理

视线再来到子组件的创建过程，在`render`函数的执行之前，我们会从`_parentVnode.data`中获取`scopedSlots`并赋值给`vm.$scopedSlots`。

```JavaScript
  Vue.prototype._render = function (): VNode {
    ...
    vm.$scopedSlots = (_parentVnode && _parentVnode.data.scopedSlots) || emptyObject
    ...
  }

```

我们先看一下子组件生成的`render`函数

```JavaScript
"with(this){return _c('ul',[_l((items),function(item){return _t("item",null,{text:item.text},{name: 'liutao'})})],2)}"
```

`_l`是循环生成元素，在[`v-for`](v-for.md)的讲解中，我们已经介绍过。这里我们用的还是`_t`，本例子中，我们传递了属性值`{text:item.text}`，以及通过`v-bind`绑定的`{name: 'liutao'}`。

又回到了`renderSlot`方法。

```JavaScript
	export function renderSlot (
	  name: string,
	  fallback: ?Array<VNode>,
	  props: ?Object,
	  bindObject: ?Object
	): ?Array<VNode> {
	  const scopedSlotFn = this.$scopedSlots[name]
	  if (scopedSlotFn) { // scoped slot
	    props = props || {}
	    if (bindObject) {
	      extend(props, bindObject)
	    }
	    return scopedSlotFn(props) || fallback
	  } else {
	    ...
	  }
	}
```

首先我们根据`name`获取`this.$scopedSlots`上对于的函数，然后把`bindObject`对象绑定的值合并到`props`中，最后调用函数传入`props`属性，最终会根据函数中定义的`render`字符串返回创建后的`vnode`对象。

## 总结

以上就是我们`slot`和作用域插槽相关的内容。两者最终渲染的方式一致，但处理的流程是不同的。有了以上的基础，以后学习一些抽象组件时的实现时，就会更加清晰。