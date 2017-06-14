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

