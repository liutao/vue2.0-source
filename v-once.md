本篇文章，我们要讲的是`v-once`的实现，添加了该指令的元素及其子内容，将只会渲染一次。

`v-once`的处理还是比较复杂的，因为它涉及到和`v-if`、`v-for`等指令在一起使用时的特殊情况。`Vue`需要保证在多个指令混合使用时，依然可以正常运行。

`v-once`和`v-if`、`v-for`类似，它影响的是最终生成的`render`函数。`parser`的过程中`processOnce`函数用来获取`v-once`标识并设置`el.once`。

```JavaScript
function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}
```

因为`v-once`的元素在第一次渲染之后，会被当做静态内容来处理，所以它的处理和我们之前讲过的[静态内容](compile——优化静态内容.md)有很多相似的地方。其中主要一点是标记是否在`for`循环包裹内。

```JavaScript
function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    ...
  }
}
```

在生成`render`函数时，对`el.once`的处理放在第二位：

```JavaScript
function genElement (el: ASTElement): string {
  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el)
  } else if (el.once && !el.onceProcessed) {
    return genOnce(el)
  } else if (el.for && !el.forProcessed) {
    ...
  }
}
```

我们一起来看`genOnce`

```JavaScript
function genOnce (el: ASTElement): string {
  el.onceProcessed = true
  if (el.if && !el.ifProcessed) {
    return genIf(el)
  } else if (el.staticInFor) {
    let key = ''
    let parent = el.parent
    while (parent) {
      if (parent.for) {
        key = parent.key
        break
      }
      parent = parent.parent
    }
    if (!key) {
      process.env.NODE_ENV !== 'production' && warn(
        `v-once can only be used inside v-for that is keyed. `
      )
      return genElement(el)
    }
    return `_o(${genElement(el)},${onceCount++}${key ? `,${key}` : ``})`
  } else {
    return genStatic(el)
  }
}
```

1、如果和`v-if`同时使用，则调用` genIf`来进行处理。在[`v-if`](v-if.md)的讲解中，我们讲过它的处理流程，最终会再次调用`genOnce`方法来处理。这也说明，`v-if`是优于`v-once`来进行处理的。

2、如果父辈元素中使用了`v-for`，`el.staticInFor`就会返回`true`。首先会获取到添加`v-for`指令元素的`ast`，然后获取它的`key`值，如果没有`key`则抛出异常，并返回`genElement(el)`，这种情况其实就相当于`v-once`失效。

例：

```html
<div id="app">
  <div v-for="item in list">
    <div v-once>
      <p>{{msg}}{{item}}</p>
    </div>
  </div>
</div>
<script type="text/javascript">
  var vm = new Vue({
    el: '#app',
    data: {
      msg: "message",
      list: [1, 2, 3]
    }
  })
</script>
```

以上示例可以正常运行，但会抛出`v-once can only be used inside v-for that is keyed.`的错误。

生成的`render`函数如下：

```JavaScript
"with(this){return _c('div',{attrs:{"id":"app"}},_l((list),function(item){return _c('div',[_c('div',[_c('p',[_v(_s(msg)+_s(item))])])])}))}"
```

此时我们修改`list`的值，我们会发现`v-once`包裹的内容，会跟着改变。从上面的`render`函数我们也可以看出，`v-once`没有失效。

如果有`key`，则返回`_o`函数。我们给上面有`v-for`指令的`div`添加一个`key`，它的`render`函数就会变成如下，自增的`onceCount`是因为一个`v-for`中，可能会包含多个`v-once`，它用于给`vnode`生成唯一的`key`。

```JavaScript
"with(this){return _c('div',{attrs:{"id":"app"}},_l((list),function(item){return _c('div',{key:"a"},[_o(_c('div',[_c('p',[_v(_s(msg)+_s(item))])]),0,"a")])}))}"
```

`_o`其实就是`markOnce`方法：

```JavaScript
export function markOnce (
  tree: VNode | Array<VNode>,
  index: number,
  key: string
) {
  markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
  return tree
}

function markStatic (
  tree: VNode | Array<VNode>,
  key: string,
  isOnce: boolean
) {
  if (Array.isArray(tree)) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  } else {
    markStaticNode(tree, key, isOnce)
  }
}

function markStaticNode (node, key, isOnce) {
  node.isStatic = true
  node.key = key
  node.isOnce = isOnce
}
```

`tree`其实就是当前元素的`vnode`，`markOnce`里面的操作，其实就是给`vnode`添加了`key`，同时设置`vnode.isStatic = true`、`vnode.once = true`。

那么这种情况，在`list`改变时，是如何保证不会再次渲染呢？

我们之前讲过，`list`改变之后，会触发`render`函数重新执行，然后新旧`vnode`树进行`diff`操作，如果两个元素可以复用，就会调用`patchVnode`方法：

```JavaScript
function patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly) {
  if (oldVnode === vnode) {
    return
  }
  if (isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))) {
    vnode.elm = oldVnode.elm
    vnode.componentInstance = oldVnode.componentInstance
    return
  }
  ...
}
```

我们的`v-once`元素，在这里就会直接复用之前的`elm`，并直接返回。

3、如果以上两种情况都不符合，就当做静态内容来处理。

```JavaScript
function genStatic (el: ASTElement): string {
  el.staticProcessed = true
  staticRenderFns.push(`with(this){return ${genElement(el)}}`)
  return `_m(${staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}
```

这里我们会把`vnode`的生成函数，直接添加到`staticRenderFns`数组中，然后在`render`函数中，通过`_m`接收一个索引值来引用。

```html
<div id="app">
  <div v-once>
    <p>{{msg}}</p>
  </div>
</div>
<script type="text/javascript">
  var vm = new Vue({
    el: '#app',
    data: {
      msg: "message"
    }
  })
</script>
```

上面例子最终生成的`render`函数如下：

```JavaScript
render: "with(this){return _c('div',{attrs:{"id":"app1"}},[_m(0)])}"
staticRenderFns: ["with(this){return _c('div',[_c('p',[_v(_s(msg))])])}"]
```

`_m`对应的是`renderStatic`方法：

```JavaScript
export function renderStatic (
  index: number,
  isInFor?: boolean
): VNode | Array<VNode> {
  let tree = this._staticTrees[index]
  if (tree && !isInFor) {
    return Array.isArray(tree)
      ? cloneVNodes(tree)
      : cloneVNode(tree)
  }
  // otherwise, render a fresh tree.
  tree = this._staticTrees[index] =
    this.$options.staticRenderFns[index].call(this._renderProxy)
  markStatic(tree, `__static__${index}`, false)
  return tree
}
```

当模板第一次渲染时，会把`staticRenderFns`中对应函数生成的`vnode`放到`_staticTrees`中。`markStatic`方法会给它添加`key`，同时设置`vnode.isStatic = true`、`vnode.once = false`。

当数据变化再次渲染时，会直接从`_staticTrees`中获取，然后通过`cloneVNode`方法来复制一份。

```JavaScript
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isCloned = true
  return cloned
}
```

`cloneVNode`其实就是会复制之前的所有值，来重新创建一个`vnode`，同时给它添加`vnode.isCloned = true`。同第二种情况下一样，在`patchVNode`的过程中，直接复用之前的`elm`，并直接返回。