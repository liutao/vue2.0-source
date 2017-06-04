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

我们直接来看`patchVnode`的实现：

```JavaScript
	function patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly) {
    if (oldVnode === vnode) {
      return
    }
    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.
    if (isTrue(vnode.isStatic) &&
        isTrue(oldVnode.isStatic) &&
        vnode.key === oldVnode.key &&
        (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))) {
      vnode.elm = oldVnode.elm
      vnode.componentInstance = oldVnode.componentInstance
      return
    }
    let i
    const data = vnode.data
    if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
      i(oldVnode, vnode)
    }
    const elm = vnode.elm = oldVnode.elm
    const oldCh = oldVnode.children
    const ch = vnode.children
    if (isDef(data) && isPatchable(vnode)) {
      // 这里会处理元素上的属性等
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
      if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
    }
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
    } else if (oldVnode.text !== vnode.text) {
      nodeOps.setTextContent(elm, vnode.text)
    }
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.postpatch)) i(oldVnode, vnode)
    }
  }
```

