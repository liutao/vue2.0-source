在[vdom概述](vdom概述.md)中，我们提到`patch`方法，可以根据`VNode`创建`dom`元素、对新旧`VNode`对象进行`diff`操作并更新`dom`、销毁`dom`。

这里，我们来看第一种情况是如何处理的。

```JavaScript
vm.$el = vm.__patch__(
	vm.$el, vnode, hydrating, false /* removeOnly */,
	vm.$options._parentElm,
	vm.$options._refElm
)
```


当整个`vm`实例第一次初始化的时候，上面`vm.__patch__`传入的参数中，`vm.$el`是挂载的根元素，`vnode`是根元素对应的虚拟dom元素，`hydrating`是`false`，`vm.$options._parentElm`和`vm.$options._refElm`都是`undefined`。

我们用一个最简单的示例来分析：

```HTML
<div id="app">
	<p>初始化{{value}}</p>
</div>
<script type="text/javascript">
	new Vue({
		data: {
			value: 'text'
		}
	}).$mount('#app');
</script>

```

打开`src/core/vdom/patch.js`文件，我们对照着最下方的`patch`方法的代码，一一来看：

```JavaScript
  return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {
    if (isUndef(vnode)) {
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode)
      return
    }

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
          oldVnode = emptyNodeAt(oldVnode)
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

如果`vnode`未定义，若`oldVnode`有值则销毁`vnode`，否则返回。

如果`oldVnode`未定义，`isInitialPatch`置为`true`，然后调用`createElm`。

以上都不是我们这次要讨论的东西，我们这里`oldVnode`是真实的dom元素，所以会走到上面代码`else`代码块里面的`else`中，同时`isRealElement`返回`true`。所以会先执行`oldVnode = emptyNodeAt(oldVnode)`。

```JavaScript
  function emptyNodeAt (elm) {
    return new VNode(nodeOps.tagName(elm).toLowerCase(), {}, [], undefined, elm)
  }
```

该方法会创建一个`div`元素对应的最简单的`vnode`实例。`parentElm`是`div`的父级元素，这里也就是`body`。

接着调用了一个很重要的方法`createElm`，第三个参数注释中说是极其罕见的情况下才会传入`null`，我们这里是`parentElm`。

```JavaScript
  let inPre = 0
  function createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested) {
    vnode.isRootInsert = !nested // for transition enter check
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return
    }

    const data = vnode.data
    const children = vnode.children
    const tag = vnode.tag
    if (isDef(tag)) {
      if (process.env.NODE_ENV !== 'production') {
        if (data && data.pre) {
          inPre++
        }
        if (
          !inPre &&
          !vnode.ns &&
          !(config.ignoredElements.length && config.ignoredElements.indexOf(tag) > -1) &&
          config.isUnknownElement(tag)
        ) {
          warn(
            'Unknown custom element: <' + tag + '> - did you ' +
            'register the component correctly? For recursive components, ' +
            'make sure to provide the "name" option.',
            vnode.context
          )
        }
      }
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode)
      setScope(vnode)

      if (__WEEX__) {
        ...
      } else {
        createChildren(vnode, children, insertedVnodeQueue)
        if (isDef(data)) {
          invokeCreateHooks(vnode, insertedVnodeQueue)
        }
        insert(parentElm, vnode.elm, refElm)
      }

      if (process.env.NODE_ENV !== 'production' && data && data.pre) {
        inPre--
      }
    } else if (isTrue(vnode.isComment)) {
      vnode.elm = nodeOps.createComment(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    } else {
      vnode.elm = nodeOps.createTextNode(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    }
  }
```

如果当前`vnode`是一个组件，`createComponent`方法会初始化该组件，并最终返回`true`，否则返回`undefined`。关于自定义组件的初始化等过程，我们之后单独详细说。

如果`tag`定义了，则先对`tag`校验。在[vdom——VNode](vdom——VNode.md)中，我们提到创建`VNode`对象有四种情况。如果是第三种，则会抛出错误。

然后`vnode.elm`指向真实创建的`dom`元素。

`setScope`函数的的作用是为了在使用`scoped CSS`时，给元素添加相应的属性。

之后，调用`createChildren`方法:

```JavaScript
function createChildren (vnode, children, insertedVnodeQueue) {
	if (Array.isArray(children)) {
	  for (let i = 0; i < children.length; ++i) {
	    createElm(children[i], insertedVnodeQueue, vnode.elm, null, true)
	  }
	} else if (isPrimitive(vnode.text)) {
	  nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(vnode.text))
	}
}
```

该方法中先判断了`children`是不是数组，如果是则循环递归调用`createElm`方法创建每一个子元素。否则，若`vnode.text`是字符串或数字，也就是说当前节点是文本节点，则添加到`vnode.elm`上，但是`vnode`对象上一般`elm`和`text`不会同时有。

再回到`createElm`，如果`data`值不为空，则调用`invokeCreateHooks`方法，从函数名中我们可以猜到，这里是调用创建时的一些钩子函数的。

```JavaScript
function invokeCreateHooks (vnode, insertedVnodeQueue) {
  for (let i = 0; i < cbs.create.length; ++i) {
    cbs.create[i](emptyNode, vnode)
  }
  i = vnode.data.hook // Reuse variable
  if (isDef(i)) {
    if (isDef(i.create)) i.create(emptyNode, vnode)
    if (isDef(i.insert)) insertedVnodeQueue.push(vnode)
  }
}
```

首先会调用`cbs`中`create`数组中添加的方法，这些方法是在`createPatchFunction`函数一开始定义的：

```JavaScript
	export const emptyNode = new VNode('', {}, [])
	const hooks = ['create', 'activate', 'update', 'remove', 'destroy']

	let i, j
  const cbs = {}
  const { modules, nodeOps } = backend
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]])
      }
    }
  }
```

`modules`我们在[vdom概述](vdom概述.md)中也提到过，它里面保存了一系列对`data`中传入的属性的处理。主要包括`directives`、`ref`、`attrs`、`class`、`domProps`、`on`、`style`和`show`。

如果`vnode.data.hook`存在，如果有`create`方法，则直接调用，如果有`insert`方法，则把`vnode`添加到`insertedVnodeQueue`数组中。

`createElm`中最后会调用`insert`来把当前元素插入到父级元素中。

```JavaScript
function insert (parent, elm, ref) {
  if (isDef(parent)) {
    if (isDef(ref)) {
      nodeOps.insertBefore(parent, elm, ref)
    } else {
      nodeOps.appendChild(parent, elm)
    }
  }
}
```

在我们这里`parent`是`body`，`elm`是当前的`div`元素，`ref`是`div`的下一个兄弟元素。所以会调用`nodeOps.insertBefore(parent, elm, ref)`把`elm`插入到合适的位置。

因为在`createChildren`方法中，我们递归调用`createElm`方法，所以会先把子元素都拼装好，最后才把`div`插入到`body`上。

