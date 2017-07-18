本篇文章，我们说的是一个我们经常用的指令`v-show`，它的功能其实很简单，就是控制一个元素是否显示。`v-show`的实现也比较简单，它走的完全是我们[自定义指令](自定义指令.md)走的那一套，它内置在`Vue.options.directives`上。

所以我们要看`v-show`的实现，其实就是看它各个钩子函数的实现。代码见`src/platforms/web/runtimes/directives/show.js`。

### `bind`

```JavaScript
bind (el: any, { value }: VNodeDirective, vnode: VNodeWithData) {
  vnode = locateNode(vnode)
  const transition = vnode.data && vnode.data.transition
  const originalDisplay = el.__vOriginalDisplay =
        el.style.display === 'none' ? '' : el.style.display
  if (value && transition && !isIE9) {
    vnode.data.show = true
    enter(vnode, () => {
      el.style.display = originalDisplay
    })
  } else {
    el.style.display = value ? originalDisplay : 'none'
  }
},
```

`locateNode`是对自定义组件的`vnode`进行处理，获取真实dom元素的`vnode`。如果当前元素包裹在`transition`组件中，说明我们添加了过渡的动画，此时`transition`值不为空。

`vnode.data.show`是一个标示，用于在过渡中对`v-show`的特殊处理。

`el.__vOriginalDisplay`是保存元素显示时`display`的值是什么。如果`value`返回`true`（说明显示）且有动画且非IE9（IE9不支持动画），则执行显示动画，后设置`el.style.display`值。

否则，直接通过`value`的值，设置它的展现还是隐藏。

### `update`

```javascript
  update (el: any, { value, oldValue }: VNodeDirective, vnode: VNodeWithData) {
    if (value === oldValue) return
    vnode = locateNode(vnode)
    const transition = vnode.data && vnode.data.transition
    if (transition && !isIE9) {
      vnode.data.show = true
      if (value) {
        enter(vnode, () => {
          el.style.display = el.__vOriginalDisplay
        })
      } else {
        leave(vnode, () => {
          el.style.display = 'none'
        })
      }
    } else {
      el.style.display = value ? el.__vOriginalDisplay : 'none'
    }
  },
```

`update`是在页面`diff`之后调用，大体上的流程和`bind`类似，只不过这里多了一个消失时的动画处理。

### `unbind`

```JavaScript
unbind (
  el: any,
  binding: VNodeDirective,
  vnode: VNodeWithData,
  oldVnode: VNodeWithData,
  isDestroy: boolean
) {
  if (!isDestroy) {
    el.style.display = el.__vOriginalDisplay
  }
}
```

`unbind`中只做了一个处理，如果`isDestroy`返回`false`，说明我们当前的dom元素并没有真实销毁（diff过程中被复用），只是`vnode`中没有`v-show`的指令，这时，设置`el.style.display`等于初始值。这个地方为什么这样做，主要是为了解决一个[bug](https://github.com/vuejs/vue/issues/4484)，整个bug的缘由，里面已经表述的很清晰。

