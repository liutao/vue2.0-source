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

## `patchVnode`

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

## `updateChildren`

我们页面的`dom`是一个树状结构，上面所讲的`patchVnode`方法，是复用同一个`dom`元素，而如果新旧两个`VNnode`对象都有子元素，我们应该怎么去比较复用元素呢？这就是我们`updateChildren`方法所要做的事儿。

```JavaScript
  function updateChildren (parentElm, oldCh, newCh, insertedVnodeQueue, removeOnly) {
    let oldStartIdx = 0
    let newStartIdx = 0
    let oldEndIdx = oldCh.length - 1
    let oldStartVnode = oldCh[0]
    let oldEndVnode = oldCh[oldEndIdx]
    let newEndIdx = newCh.length - 1
    let newStartVnode = newCh[0]
    let newEndVnode = newCh[newEndIdx]
    let oldKeyToIdx, idxInOld, elmToMove, refElm

    // removeOnly使用在transition-group中，其它情况下都是false
    const canMove = !removeOnly

    // 新旧数组都没有遍历结束
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (isUndef(oldStartVnode)) {
        oldStartVnode = oldCh[++oldStartIdx] // Vnode has been moved left
      } else if (isUndef(oldEndVnode)) {
        oldEndVnode = oldCh[--oldEndIdx]
      // 头头比较
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue)
        oldStartVnode = oldCh[++oldStartIdx]
        newStartVnode = newCh[++newStartIdx]
      // 尾尾比较
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue)
        oldEndVnode = oldCh[--oldEndIdx]
        newEndVnode = newCh[--newEndIdx]
      // 头尾比较
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue)
        canMove && nodeOps.insertBefore(parentElm, oldStartVnode.elm, nodeOps.nextSibling(oldEndVnode.elm))
        oldStartVnode = oldCh[++oldStartIdx]
        newEndVnode = newCh[--newEndIdx]
      // 尾头比较
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue)
        canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
        oldEndVnode = oldCh[--oldEndIdx]
        newStartVnode = newCh[++newStartIdx]
      } else {
        if (isUndef(oldKeyToIdx)) oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)
        idxInOld = isDef(newStartVnode.key) ? oldKeyToIdx[newStartVnode.key] : null
        if (isUndef(idxInOld)) { // New element
          createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm)
          newStartVnode = newCh[++newStartIdx]
        } else {
          elmToMove = oldCh[idxInOld]
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !elmToMove) {
            warn(
              'It seems there are duplicate keys that is causing an update error. ' +
              'Make sure each v-for item has a unique key.'
            )
          }
          if (sameVnode(elmToMove, newStartVnode)) {
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue)
            oldCh[idxInOld] = undefined
            canMove && nodeOps.insertBefore(parentElm, newStartVnode.elm, oldStartVnode.elm)
            newStartVnode = newCh[++newStartIdx]
          } else {
            // same key but different element. treat as new element
            createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm)
            newStartVnode = newCh[++newStartIdx]
          }
        }
      }
    }

    if (oldStartIdx > oldEndIdx) {
      refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
      addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)
    } else if (newStartIdx > newEndIdx) {
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
    }
  }
```

乍一看这一块代码，可能有点儿懵。具体内容其实不复杂，我们先大体看一下整个判断流程，之后通过几个例子来详细过一下。

`oldStartIdx`、`newStartIdx`、`oldEndIdx`、`newEndIdx`都是指针，具体每一个指什么，相信大家都很明了，我们整个比较的过程，会不断的移动指针。

`oldStartVnode`、`newStartVnode`、`oldEndVnode`、`newEndVnode`与上面的指针一一对应，是它们所指向的`VNode`结点。

`while`循环在`oldCh`或`newCh`遍历结束后停止，否则会不断的执行循环流程。整个流程分为以下几种情况：

1、 如果`oldStartVnode`未定义，则`oldCh`数组遍历的起始指针后移一位。

```JavaScript
  if (isUndef(oldStartVnode)) {
    oldStartVnode = oldCh[++oldStartIdx] // Vnode has been moved left
  }
```

注：见第七种情况，`key`值相同可能会置为undefined

2、 如果`oldEndVnode`未定义，则`oldCh`数组遍历的起始指针前移一位。

```JavaScript
  else if (isUndef(oldEndVnode)) {
    oldEndVnode = oldCh[--oldEndIdx]
  } 
```

注：见第七种情况，`key`值相同可能会置为undefined

3、`sameVnode(oldStartVnode, newStartVnode)`，这里判断两个数组起始指针所指向的对象是否可以复用。如果返回真，则先调用`patchVnode`方法复用`dom`元素并递归比较子元素，然后`oldCh`和`newCh`的起始指针分别后移一位。

```JavaScript
  else if (sameVnode(oldStartVnode, newStartVnode)) {
    patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue)
    oldStartVnode = oldCh[++oldStartIdx]
    newStartVnode = newCh[++newStartIdx]
  }
```

4、`sameVnode(oldEndVnode, newEndVnode)`，这里判断两个数组结束指针所指向的对象是否可以复用。如果返回真，则先调用`patchVnode`方法复用`dom`元素并递归比较子元素，然后`oldCh`和`newCh`的结束指针分别前移一位。

```JavaScript
  else if (sameVnode(oldEndVnode, newEndVnode)) {
    patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue)
    oldEndVnode = oldCh[--oldEndIdx]
    newEndVnode = newCh[--newEndIdx]
  } 
```

5、`sameVnode(oldStartVnode, newEndVnode)`，这里判断`oldCh`起始指针指向的对象和`newCh`结束指针所指向的对象是否可以复用。如果返回真，则先调用`patchVnode`方法复用`dom`元素并递归比较子元素，因为复用的元素在`newCh`中是结束指针所指的元素，所以把它插入到`oldEndVnode.elm`的前面。最后`oldCh`的起始指针后移一位，`newCh`的起始指针分别前移一位。

```JavaScript
  else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
    patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue)
    canMove && nodeOps.insertBefore(parentElm, oldStartVnode.elm, nodeOps.nextSibling(oldEndVnode.elm))
    oldStartVnode = oldCh[++oldStartIdx]
    newEndVnode = newCh[--newEndIdx]
  }
```

6、`sameVnode(oldEndVnode, newStartVnode)`，这里判断`oldCh`结束指针指向的对象和`newCh`起始指针所指向的对象是否可以复用。如果返回真，则先调用`patchVnode`方法复用`dom`元素并递归比较子元素，因为复用的元素在`newCh`中是起始指针所指的元素，所以把它插入到`oldStartVnode.elm`的前面。最后`oldCh`的结束指针前移一位，`newCh`的起始指针分别后移一位。

```JavaScript
  else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
    patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue)
    canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
    oldEndVnode = oldCh[--oldEndIdx]
    newStartVnode = newCh[++newStartIdx]
  }
```

7、如果上述六种情况都不满足，则走到这里。前面的比较都是头尾组合的比较，这里的情况，稍微更加复杂一些，其实主要就是根据`key`值来复用元素。

① 遍历`oldCh`数组，找出其中有`key`的对象，并以`key`为键，索引值为`value`，生成新的对象`oldKeyToIdx`。

```JavaScript
if (isUndef(oldKeyToIdx)) oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)
function createKeyToOldIdx (children, beginIdx, endIdx) {
  let i, key
  const map = {}
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key
    if (isDef(key)) map[key] = i
  }
  return map
}
```

② 查询`newStartVnode`是否有`key`值，并查找`oldKeyToIdx`是否有相同的`key`。

```JavaScript
  idxInOld = isDef(newStartVnode.key) ? oldKeyToIdx[newStartVnode.key] : null
```

③ 如果`newStartVnode`没有`key`或`oldKeyToIdx`没有相同的`key`，则调用`createElm`方法创建新元素，`newCh`的起始索引后移一位。

```JavaScript
  if (isUndef(idxInOld)) { // New element
    createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm)
    newStartVnode = newCh[++newStartIdx]
  } 
```

④ `elmToMove`保存的是要移动的元素，如果`sameVnode(elmToMove, newStartVnode)`返回真，说明可以复用，这时先调用`patchVnode`方法复用`dom`元素并递归比较子元素，重置`oldCh`中相对于的元素为`undefined`，然后把当前元素插入到`oldStartVnode.elm`前面，`newCh`的起始索引后移一位。如果`sameVnode(elmToMove, newStartVnode)`返回假，例如`tag`名不同，则调用`createElm`方法创建新元素，`newCh`的起始索引后移一位。

```JavaScript
  elmToMove = oldCh[idxInOld]
  if (sameVnode(elmToMove, newStartVnode)) {
    patchVnode(elmToMove, newStartVnode, insertedVnodeQueue)
    oldCh[idxInOld] = undefined
    canMove && nodeOps.insertBefore(parentElm, newStartVnode.elm, oldStartVnode.elm)
    newStartVnode = newCh[++newStartIdx]
  } else {
    // same key but different element. treat as new element
    createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm)
    newStartVnode = newCh[++newStartIdx]
  }
```

上面的内容比较枯燥，我们一起通过几个例子来看一下它的处理流程。

### 没有`key`值的情况

假设`oldCh`上有五个元素`a`、`b`、`c`、`d`、`e`，`newCh`有六个元素`d`、`e`、`b`、`f`、`d`、`a`，且没有`key`值。初始情况下，页面中`dom`顺序为`abcde`。

第一次`while`循环，`oldStartVnode`和`newEndVnode`都是`a`，所以会走到第五种情况,`a`元素会把插入到`e`元素的下一个元素前。此时页面中`dom`变为`bcdea`，`oldStartVnode`指向`b`，`newEndVnode`指向`d`。

第二次`while`循环，因为头尾都不相同，走到最后第七种情况，然后会创建新的元素`d`并插入到`b`前面。此时页面中`dom`变为`dbcdea`，`newStartVnode`指向`e`。

第三次`while`循环，`oldEndVnode`和`newStartVnode`都是`e`，所以会走到第六种情况，`e`元素会把插入到`b`元素之前。此时页面中`dom`变为`debcda`，`oldEndVnode`指向`d`，`newStartVnode`指向`b`。

第四次`while`循环，`oldStartVnode`和`newStartVnode`都指向`b`，所以会走到第三种情况，直接复用`b`元素。此时页面中`dom`依然为`debcda`，`oldStartVnode`指向`c`，`newStartVnode`指向`f`。

第五次`while`循环，`oldEndVnode`和`newEndVnode`都指向`d`，所以会走到第四种情况，直接复用`d`元素。此时页面中`dom`依然为`debcda`，`oldEndVnode`指向`c`，`newEndVnode`指向`f`。

第六次`while`循环，两个数组中都只剩下一个没有遍历的元素且不相同，所以会走到第七种情况。然后会创建新的元素`f`并插入到`c`前面。此时页面中`dom`变为`debfcda`，`newStartVnode`指向`b`。

这时`newStartIdx`会大于`newEndIdx`，所以会终止循环。这时我们发现，页面中多了`c`元素。所以`updateChildren`方法在循环之后还有删除无用的旧结点的操作。

```JavaScript
if (oldStartIdx > oldEndIdx) {
  refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
  addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)
} else if (newStartIdx > newEndIdx) {
  removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
}
```

第一种情况是`oldCh`中的元素全部复用。则依次把`newStartIdx`和`newEndIdx`之间的元素插入到相应的位置。

第二种情况是`newCh`中的元素全部复用。则依次删除`oldStartIdx`和`oldEndIdx`之间的元素，我们上面例子中的`c`元素在这里就会被删除。

### 有`key`值的情况

假设`oldCh`上有五个元素`a`、`div[key=1]`、`footer[key=3]`、`span[key=2]`、`p`，`newCh`有六个元素`p[key=3]`、`span[key=2]`、`p`、`div[key=1]`、`a`、`span`。初始情况下，页面中`dom`顺序为`a、div[key=1]、footer[key=3]、span[key=2]、p`。

第一次`while`循环，头尾都不可复用，所以会走到第七种情况，此时会生成`oldKeyToIdx`，如下：

```JavaScript
oldKeyToIdx = {
  '1': 1,
  '2': 3,
  '3': 2
}
```

`newStartVnode`元素`p[key=3]`根据`key`值比较，`elmToMove`会指向`footer[key=3]`，但因为它们标签名不一样，所以`sameVNode`判断会返回`false`。所以直接插入到`a`前面，页面中`dom`变为`p[key=3]、a、div[key=1]、footer[key=3]、span[key=2]、p`，`newStartVnode`指向`span[key=2]`。

第二次`while`循环，同样头尾都不可复用，所以会走到第七种情况，`newStartVnode`元素`span[key=2]`根据`key`值比较，`elmToMove`会指向`span[k=2]`，两元素可以复用，`span[k=2]`会被插入到`a`前面，页面中`dom`变为`p[key=1]、span[key=2]、a、div[key=1]、footer[k=3]、p`，`newStartVnode`指向`div`。同时`oldCh`变为[`a`, `div[key=1]`, `footer[k=3]`, undefined, `p`]。

第三次`while`循环，`oldEndVnode`和`newStartVnode`都是`p`，所以走到第六种情况，`dom`中最后的`p`元素会插入到`a`元素，页面中`dom`顺序变为`p[key=1]、span[key=2]、p、a、div[key=1]、footer[k=3]`，`oldEndVnode`前移一位指向了`undefined`，`newStartVnode`后移一位指向`div[key=1]`。

第四次`while`循环，`oldEndVnode`返回`undefined`所以会走到第二种情况。页面中`dom`不变，`oldEndVnode`指向`footer[k=3]`。

第五次`while`循环，依然头尾都不可复用，走到第七种情况，`newStartVnode`根据`key=1`找到可以复用的`div[key=1]`，该元素会插入到`a`元素之前，页面中的`dom`变为`p[key=1]、span[key=2]、p、div[key=1]、a、footer[k=3]`，同时`oldCh`变为[`a`, undefined, `footer[k=3]`, undefined, `p`]，`，`newStartVnode`后移一位指向`a`。

第六次`while`循环，`newStartVnode`和`oldStartVnode`都指向`a`，可以直接复用走到第三种情况。页面中`dom`不变，`newStartVnode`后移一位指向`span`，`oldStartVnode`后移一位指向`undefined`。

第七次`while`循环，`oldStartVnode`返回`undefined`所以会走到第一种情况。页面中`dom`不变，`oldStartVnode`指向`footer[k=3]`。

第八次`while`循环，新旧没有比较的子元素都只剩一个，且不可复用，会走到第七种情况，页面中会创建`span`，并插入到`footer[k=3]`之前。此时页面中`dom`变为`p[key=1]、span[key=2]、p、div[key=1]、a、span、footer[k=3]`，`newStartVnode`指向超出`newCh`范围，指向`undefined`。

这时`newStartIdx`会大于`newEndIdx`，所以会终止循环。与之前例子一样，最终会删除多余的`footer[k=3]`。

以上基本就是`vdom`的`diff`相关主要内容。
