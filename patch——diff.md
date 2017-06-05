[vdom--patch(一)](vdom--patch(一).md)我们讲了，整个`Vue`对象初始化并渲染到页面中的过程。本篇文章我们主要来谈谈当页面绑定的数据修改后，是如何更新`dom`结构的，即`vdom`的`diff`算法，网上讲解这部分内容的文章有很多，可以互相借鉴补充。

`Vue`和`React`在更新`dom`时，使用的算法相同，都是基于[snabbdom](https://github.com/snabbdom/snabbdom)。

我们前面提到过，当页面绑定的数据修改时，会触发监听该数据的`watcher`对象更新，而从`src/core/lifecycle.js`中的`mountComponent`内，我们看到`watcher`对象更新时会调用`updateComponent`，进而调用`vm._update`方法，`vm._render()`方法会依据新的数据生成新的`VNode`对象，在`Vue.prototype._update`我们会将旧新两个`VNode`对象传入到`__patch__`方法中，所以，最终还是回到了`__patch__`方法。

## 流程浅析

```JavaScript
return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {
    ...

    let isInitialPatch = false
    const insertedVnodeQueue = []

    if (isUndef(oldVnode)) {
     ...
    } else {
      // oldValue不是VNode，而是真实的dom元素
      const isRealElement = isDef(oldVnode.nodeType)
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // patch existing root node
        patchVnode(oldVnode, vnode, insertedVnodeQueue, removeOnly)
      } else {
        if (isRealElement) {
          ...
        }
        // replacing existing element
        const oldElm = oldVnode.elm
        const parentElm = nodeOps.parentNode(oldElm)
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          oldElm._leaveCb ? null : parentElm,
          nodeOps.nextSibling(oldElm)
        )

        if (isDef(vnode.parent)) {
          // component root element replaced.
          // update parent placeholder node element, recursively
          let ancestor = vnode.parent
          while (ancestor) {
            ancestor.elm = vnode.elm
            ancestor = ancestor.parent
          }
          if (isPatchable(vnode)) {
            for (let i = 0; i < cbs.create.length; ++i) {
              cbs.create[i](emptyNode, vnode.parent)
            }
          }
        }

        if (isDef(parentElm)) {
          removeVnodes(parentElm, [oldVnode], 0, 0)
        } else if (isDef(oldVnode.tag)) {
          invokeDestroyHook(oldVnode)
        }
      }
    }

    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch)
    return vnode.elm
  }
```

这次我们只传入了两个参数，分别是之前的`oldVnode`和数据更新后生成的新的`vnode`，且它们两个都是`VNode`的实例。所以以上代码中如果`sameVnode(oldVnode, vnode)`返回`true`，则执行`patchVnode`方法，否则和第一次渲染元素时一样，走下面的流程。

```JavaScript
function sameVnode (a, b) {
  return (
    a.key === b.key &&
    a.tag === b.tag &&
    a.isComment === b.isComment &&
    isDef(a.data) === isDef(b.data) &&
    sameInputType(a, b)
  )
}

// Some browsers do not support dynamically changing type for <input>
// so they need to be treated as different nodes
function sameInputType (a, b) {
  if (a.tag !== 'input') return true
  let i
  const typeA = isDef(i = a.data) && isDef(i = i.attrs) && i.type
  const typeB = isDef(i = b.data) && isDef(i = i.attrs) && i.type
  return typeA === typeB
}
```

`sameVnode`方法是判断两个`vnode`可不可以复用为一个节点。我们前面提到过，在原生创建一个`dom`对象时，会创建许多属性，频繁的添加删除`dom`元素，会造成性能的浪费。所以更好的做法是尽可能的复用原有的`dom`。在`Vue`中，判断两个元素可不可以复用的方法就是上面的`sameVnode`方法，即若两个`vnode`的`key`相同，`tag`名相同，都是或都不是注释，都有或没有`data`，如果是`input`则要`data`和`attrs`都有或都没有，且`type`必须相同。

因为我们的自定义的`Vue`组件，一般情况下都必须包裹在一个根元素中，这时`sameVnode`比较两个`vnode`对象返回的是`true`，所以会直接走`patchVnode`方法，`patchVnode`方法的精髓，也就是我们常说的`diff`。

唯一的一种情况，就是如果组件最外层包裹的元素上有`v-if`语句，则可以通过`v-else`添加多个跟元素。其实这种情况，在真实渲染时，也只有一个根元素。但是这种情况就有可能出现可以`v-if`和`v-else`的指令完全不同，这时就会走到下面的流程。

## `diff`

走到`patchVnode`方法的前提，就是我们上面所说的`oldVnode`和`vnode`是`sameVnode`，该方法的功能其实就是复用`dom`元素。我们来一步步看看它里面的逻辑处理。

1、如果`oldVnode`和`vnode`是同一个对象，则直接返回。

```JavaScript
  if (oldVnode === vnode) {
    return
  }
```

2、如果下面的表达式为真，则直接用的`oldVnode`的`elm`和`componentInstance`替换`vnode`上的相同属性。

```JavaScript
  if (isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))) {
    vnode.elm = oldVnode.elm
    vnode.componentInstance = oldVnode.componentInstance
    return
  }
```

该条件判断主要分三部分：

①`isTrue(vnode.isStatic) && isTrue(oldVnode.isStatic)` `isStatic`属性为`true`的条件是当前节点是静态内容根节点，所以这里`vnode`和`oldVnode`都是静态内容根节点。

②`vnode.key === oldVnode.key` 两个对象的`key`值相同

③`(isTrue(vnode.isCloned) || isTrue(vnode.isOnce))` 我们在生成`render`函数字符串中，会有`_m`或`_o`，他们分别是`renderStatic`和`markOnce`方法(`src/core/instance/render-static.js`中)。我们的`patchVnode`是在数据变化后调用，`render`方法是不变的，只不过因为执行`render`函数时数据变了，所以生成的`vnode`对象和之前不同。以`_m`为例，再次执行`_m`函数，会直接从`vm._staticTrees`中获取`tree`，并通过`cloneVNode`方法克隆一份出来，这种情况下`vnode.isCloned`值为`true`。

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

所以这一步主要是处理静态根节点的`diff`操作。

3、以上是两种特殊情况的简单处理，通常我们会有各种各样的结点，它们就会走下面处理流程：

```JavaScript
  let i
  const data = vnode.data
  // 调用prepatch钩子函数
  if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
    i(oldVnode, vnode)
  }
  // vnode对应的dom指向oldVnode的dom
  const elm = vnode.elm = oldVnode.elm
  // 分别获取oldVnode和vnode的子元素
  const oldCh = oldVnode.children
  const ch = vnode.children
  if (isDef(data) && isPatchable(vnode)) {
    // 更新元素上相关各种属性
    for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
    // 调用update钩子函数
    if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
  }
```

处理完属性相关内容，就是对子元素内容的处理了：

```JavaScript
  if (isUndef(vnode.text)) {
    if (isDef(oldCh) && isDef(ch)) {
      if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
    } else if (isDef(ch)) {
      if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
      addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
    } else if (isDef(oldCh)) {
      removeVnodes(elm, oldCh, 0, oldCh.length - 1)
    } else if (isDef(oldVnode.text)) {
      nodeOps.setTextContent(elm, '')
    }
  // 如果vnode是文本结点，且text有变化，则修改elm的文本内容
  } else if (oldVnode.text !== vnode.text) {
    nodeOps.setTextContent(elm, vnode.text)
  }
```

3.1 如果`vnode.text`不是文本节点
  
3.1.1 `isDef(oldCh) && isDef(ch)` 如果新旧`Vnode`对象都有子元素，且子元素不同时，通过`updateChildren`方法来更新子元素。这个方法是做子元素`diff`的重要方法，后面详细介绍。

3.1.2 `isDef(ch)` `vnode`有子元素，而`oldVnode`没有子元素。如果`oldVnode`是文本结点，则置空（理论上新旧`Vnode`必须是`sameVnode`不应该出现这种情况）。这种情况，只需要把`ch`中的元素依次添加到`elm`中。

```JavaScript
  function addVnodes (parentElm, refElm, vnodes, startIdx, endIdx, insertedVnodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      createElm(vnodes[startIdx], insertedVnodeQueue, parentElm, refElm)
    }
  }
```

该方法也很简单，就是依次调用`createElm`方法来创建子元素并添加到`parentElm`上。该方法我们在[patch——创建dom](patch——创建dom.md)中已经讲解。

3.1.3 `isDef(oldCh)` `vnode`没有子元素，而`oldVnode`有子元素。这种情况只需要删掉`oldVnode`的子元素。

```JavaScript
  function removeVnodes (parentElm, vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx]
      if (isDef(ch)) {
        if (isDef(ch.tag)) {
          removeAndInvokeRemoveHook(ch)
          invokeDestroyHook(ch)
        } else { // Text node
          removeNode(ch.elm)
        }
      }
    }
  }
```

如果是标签元素，则调用销毁相关的钩子函数；如果是文本结点，则直接删除文本。

3.1.4 `isDef(oldVnode.text)` 否则如果`oldVnode`是文本结点，则直接内容置空。

3.2 `oldVnode.text !== vnode.text` 如果新旧`VNode`对象都是文本结点，则直接修改文本内容。

最后，调用`postpatch`钩子函数

```JavaScript
  if (isDef(data)) {
    if (isDef(i = data.hook) && isDef(i = i.postpatch)) i(oldVnode, vnode)
  }
```