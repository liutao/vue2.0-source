原本想的`Vue`中对于自定义组件的处理，无非就是通过调用几个钩子，然后来创建原生的`dom`结构。当自己准备写这一部分的分析时，才发现给自己留了一个大坑。自定义组件的创建处理，涉及到整个`Vue`的各个阶段，本文可以说是[从一个小栗子查看Vue的生命周期](从一个小栗子查看Vue的生命周期.md)在生命周期处理阶段的一个补充。

在[vdom——VNode](vdom——VNode.md)一文的最后，讲解`createComponent`方法时，我们提到在这儿会给`data.hook`上添加四个钩子函数——`init`、`prepatch`、`insert`、`destroy`。我们一起来看一下每个时期，都分别作了哪些处理。

## `init`

回到`patch`方法中，我们在创建`dom`元素时，首先会调用一个`createComponent`方法来判断当前的`vnode`是不是一个自定义组件。

```JavaScript
  function createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested) {
    ...
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return
    }
    ...
  }
  function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
      if (isDef(i = i.hook) && isDef(i = i.init)) {
        i(vnode, false /* hydrating */, parentElm, refElm)
      }
      if (isDef(vnode.componentInstance)) {
        initComponent(vnode, insertedVnodeQueue)
        if (isTrue(isReactivated)) {
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
        }
        return true
      }
    }
  }
```

上面的代码中，我会调用`init`方法，并传入四个参数。从之前`patch`相关内容的讲解中，我们知道，第一个参数`vnode`就是当前自定义组件的`vnode`，第二个参数直接就是`false`，第三个参数`parentElm`是当前元素的父元素，第四个参数是值要把当前元素插入到`refElm`之前。

接着我们来看`init`方法里面都进行了哪些操作。

```JavaScript
  init (
    vnode: VNodeWithData,
    hydrating: boolean,
    parentElm: ?Node,
    refElm: ?Node
  ): ?boolean {
    if (!vnode.componentInstance || vnode.componentInstance._isDestroyed) {
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance,
        parentElm,
        refElm
      )
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    } else if (vnode.data.keepAlive) {
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    }
  }
```

对于`keep-alive`组件，我们暂且不管。如果`vnode.componentInstance`不存在或已经销毁，则通过`createComponentInstanceForVnode`方法来创建新的`Vue`实例。

```JavaScript
export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
  parentElm?: ?Node,
  refElm?: ?Node
): Component {
  const vnodeComponentOptions = vnode.componentOptions
  const options: InternalComponentOptions = {
    _isComponent: true,
    parent,
    propsData: vnodeComponentOptions.propsData,
    _componentTag: vnodeComponentOptions.tag,
    _parentVnode: vnode,
    _parentListeners: vnodeComponentOptions.listeners,
    _renderChildren: vnodeComponentOptions.children,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (inlineTemplate) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  return new vnodeComponentOptions.Ctor(options)
}
```

`componentOptions`中包括五项数据，`Ctor`是自定义组件的构造函数，`propsData`是父组件通过`props`传递的数据，`listeners`是添加在当前组件上的事件，`tag`是自定义的标签名，`children`即当前自定义组件的子元素。

`createComponentInstanceForVnode`接收了四个参数，第一个就是当前组件的`vnode`，第二个是父`Vue`实例，第三个是父元素，第四个是后面的兄弟元素。最终我们会调用`new vnodeComponentOptions.Ctor(options)`来创建一个新的`Vue`实例。

所以，我们又回到了创建`Vue`实例的生命周期。

回到`src/core/instance/init.js`中的`Vue.prototype._init`方法。

```JavaScript
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
```

这一次对于`options`的处理我们走进了`if`块。

```JavaScript
function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  opts.parent = options.parent
  opts.propsData = options.propsData
  opts._parentVnode = options._parentVnode
  opts._parentListeners = options._parentListeners
  opts._renderChildren = options._renderChildren
  opts._componentTag = options._componentTag
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}
```

[vdom——VNode](vdom——VNode.md)一文中我们也说过，自定义组件的构造函数，是`Vue`对象的一个子对象。在我们新建`Vue`对象时，会通过`mergeOptions`方法来把`vm.constructor`上的`options`值与传入的`options`合并然后赋值给`vm.$options`。而这里我们通过`Vue.extends`创建新的对象时，已经把当前自定义组件的配置项合并到了`vm.constructor.options`上，所以我们这里`vm.$options`只需要继承一下就可以了。

同时，我们还给`vm.$options`添加了一些内部属性，具体每个属性的含义，我总结在了[Vue实例属性](Vue实例属性.md)中。

`new vnodeComponentOptions.Ctor(options)`仅仅是初始化了一个新的`Vue`实例，真正挂载到页面中，是通过`child.$mount(hydrating ? vnode.elm : undefined, hydrating)`进行的。上面可以知道`hydrating`是`false`，所以第一个参数是`undefined`，第二个参数是`false`。

`$mount`方法会先处理模板，最终还是调用`src/core/instance/lifecycle`中的`Vue.prototype._update`方法渲染组件。

```JavaScript
  vm.$el = vm.__patch__(
    vm.$el, vnode, hydrating, false /* removeOnly */,
    vm.$options._parentElm,
    vm.$options._refElm
  )
```

又回到了多次谈到的`__patch__`方法。

```JavaScript
  function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {
    ...
    let isInitialPatch = false
    const insertedVnodeQueue = []

    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      isInitialPatch = true
      createElm(vnode, insertedVnodeQueue, parentElm, refElm)
    } else {
      ...
    }

    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch)
    return vnode.elm
  }
```

这一次`oldVnode`就是`undefined`，所以直接走到`if`块代码中，然后调用`createElm`方法来创建`dom`结点。之后的流程，见[patch——创建dom](patch——创建dom.md)。

## `prepatch`

从名字我们也可以看出，该方法是在进行`diff`操作之前进行的处理。它的调用之处在`patchVnode`中：

```JavaScript
  function patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly) {
    if (oldVnode === vnode) {
      return
    }
    ...
    let i
    const data = vnode.data
    if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
      i(oldVnode, vnode)
    }
    ...
  }
```

来看看它里面进行了哪些操作。

```JavaScript
  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },
```

该方法接受两个参数，分别是旧新`Vnode`实例。如果数据有所更新，会再次调用`render`函数生成新的`VNode`实例，这个过程中会再次调用`createComponent`函数生成新的自定义组件的`vnode`。

调用`prepatch`钩子函数的前提，说明该自定义组件得到了复用，也就是说该自定义组件本身没有被替换，我们只需要根据传入的`props`或者`slots`等来更新子模板的内容。这里我们直接复用`oldVnode.componentInstance`，然后调用`updateChildComponent`方法来更新子内容。

```JavaScript
export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: VNode,
  renderChildren: ?Array<VNode>
) {
  
  const hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  )
  // 更新vnode相关关系
  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render
  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // 更新 props
  if (propsData && vm.$options.props) {
    observerState.shouldConvert = false
    if (process.env.NODE_ENV !== 'production') {
      observerState.isSettingProps = true
    }
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    if (process.env.NODE_ENV !== 'production') {
      observerState.isSettingProps = false
    }
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }
  // 更新 listeners
  if (listeners) {
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)
  }
  // 处理slots并强制更新
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }
}
```

该方法所要做的工作主要有以下几个方面。

1、更新`vm`上绑定的有关`vnode`的各项数据。之前我们通过`vm.$options._parentVnode`、`vm.$vnode`、`vm.$options._renderChildren`等保存了当前自定义组件在父组件中的`vnode`以及在父组件中当前自定义组件的子元素，`patch`时会生成新的`vnode`，所以需要更新相应的内容。

2、更新保存父组件传递过来的数据`propsData`，并对传递的数据类型等进行校验。

3、更新绑定的事件

4、更新`slots`相关内容

## `insert`

`insert`方法的调用是在`dom`插入到页面之后调用的。具体方法是在`__patch__`中的`invokeInsertHook`方法。

```JavaScript
  function invokeInsertHook (vnode, queue, initial) {
    if (isTrue(initial) && isDef(vnode.parent)) {
      vnode.parent.data.pendingInsert = queue
    } else {
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i])
      }
    }
  }
```

`insert`钩子函数的具体实现如下所示：

```JavaScript
  insert (vnode: MountedComponentVNode) {
    if (!vnode.componentInstance._isMounted) {
      vnode.componentInstance._isMounted = true
      callHook(vnode.componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      activateChildComponent(vnode.componentInstance, true /* direct */)
    }
  },
```

我们发现，这里的主要操作是调用`mounted`钩子函数。回顾一下之前讲的调用`mounted`钩子函数的代码：

```JavaScript
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
```

`vm.$vnode`保存的是上面`init`时传入的`_parentVnode`，即自定义组件在父组件中的`VNode`对象。根组件的该值为`null`，所以在上面代码中调用`mounted`，而对于自定义组件，则在`insert`钩子函数中调用。

## `destroy`

该钩子函数的调用，是在自定义组件销毁时调用。

```JavaScript
  destroy (vnode: MountedComponentVNode) {
    if (!vnode.componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        vnode.componentInstance.$destroy()
      } else {
        deactivateChildComponent(vnode.componentInstance, true /* direct */)
      }
    }
  }
```

在`patch`过程中调用该钩子函数，是因为在做`diff`的过程中，要删除当前的组件。对于普通组件，我们直接调用`vnode.componentInstance.$destroy()`方法来销毁。

```JavaScript
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    if (vm._isBeingDestroyed) {
      return
    }
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // teardown watchers
    if (vm._watcher) {
      vm._watcher.teardown()
    }
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // call the last hook...
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook
    callHook(vm, 'destroyed')
    // turn off all instance listeners.
    vm.$off()
    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // remove reference to DOM nodes (prevents leak)
    vm.$options._parentElm = vm.$options._refElm = null
  }
}
```

函数定义如上：

1、调用`beforeDestroy`钩子函数，并通过`vm._isBeingDestroyed`来标识正在销毁，避免重复调用。

2、从父元素中删除当前元素。

3、销毁`watcher`

4、`vm._data_`的监听对象的`vmCount`减1

5、标识`vm`已销毁

6、销毁当前组件

7、调用`destroyed`钩子函数

8、销毁事件

9、消除各种引用的资源
