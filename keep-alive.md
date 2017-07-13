本篇文章，我们来讲一下`keep-alive`的实现。`Vue`中，有三个内置的抽象组件，分别是`keep-alive`、`transition`和`transition-group`，它们都有一个共同的特点，就是自身不会渲染一个DOM元素，也不会出现在父组件链中。`keep-alive`的作用，是包裹动态组件时，会缓存不活动的组件实例，而不是销毁它们。具体的用法见[这里](https://cn.vuejs.org/v2/api/#keep-alive)。

该组件的定义，是在`src/core/components/keep-alive.js`文件中。它会在`Vue`初始化时，添加在`Vue.options.components`上，所以在所有的组件中，都可以直接只用它。直接看代码：

```JavaScript
export default {
  name: 'keep-alive',
  abstract: true,

  props: {
    ...
  },

  created () {
    this.cache = Object.create(null)
  },

  destroyed () {
   ...
  },

  watch: {
    ...
  },

  render () {
    ...
  }
}
```

`name`不用多说，`abstract: true`这个条件我们自己定义组件时通常不会用，它是用来标识当前的组件是一个抽象组件，它自身不会渲染一个真实的DOM元素。比如在创建两个`vm`实例之间的父子关系时，会跳过抽象组件的实例:

```JavaScript
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }
```

`props`表示我们可以传入`include`来匹配哪些组件可以缓存，`exclude`来匹配哪些组件不缓存。

`created`钩子函数调用时，会创建一个`this.cache`对象用于缓存它的子组件。

`destroyed`表示`keep-alive`被销毁时，会同时销毁它缓存的组件，并调用`deactivated`钩子函数。

```JavaScript
function pruneCacheEntry (vnode: ?VNode) {
  if (vnode) {
    if (!vnode.componentInstance._inactive) {
      callHook(vnode.componentInstance, 'deactivated')
    }
    vnode.componentInstance.$destroy()
  }
}
```

`watch`是在我们改变`props`传入的值时，同时对`this.cache`缓存中的数据进行处理。

```JavaScript
function pruneCache (cache: VNodeCache, filter: Function) {
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cachedNode)
        cache[key] = null
      }
    }
  }
}
```

抽象组件没有实际的DOM元素，所以也就没有`template`模板，它会有一个`render`函数，我们就来看看里面进行了哪些操作。

```JavaScript
  render () {
    const vnode: VNode = getFirstComponentChild(this.$slots.default)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      const name: ?string = getComponentName(componentOptions)
      if (name && (
        (this.include && !matches(this.include, name)) ||
        (this.exclude && matches(this.exclude, name))
      )) {
        return vnode
      }
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (this.cache[key]) {
        vnode.componentInstance = this.cache[key].componentInstance
      } else {
        this.cache[key] = vnode
      }
      vnode.data.keepAlive = true
    }
    return vnode
  }
```

首先，调用`getFirstComponentChild`方法，来获取`this.$slots.default`中的第一个元素。

```JavaScript
export function getFirstComponentChild (children: ?Array<VNode>): ?VNode {
  return children && children.filter((c: VNode) => c && c.componentOptions)[0]
}
```

`this.$slots.default`中包含的是什么内容，我们在[《slot和作用域插槽》](slot和作用域插槽.md)中已经详细的做了讲解。从上面的方法我们可以看到，在我们会过滤掉非自定义的标签，然后获取第一个自定义标签所对应的`vnode`。所以，如果`keep-alive`里面包裹的是`html`标签，是不会渲染的。

然后获取`componentOptions`，[vdom——VNode](vdom——VNode.md)中我们介绍过`componentOptions`包含五个元素`{ Ctor, propsData, listeners, tag, children }`。

```JavaScript
function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}
```

通过`getComponentName`方法来获取组件名，然后判断该组件是否合法，如果`include`不匹配或`exclude`匹配，则说明该组件不需要缓存，此时直接返回该`vnode`。

否则，`vnode.key`不存在则生成一个，存在则就用`vnode.key`作为`key`。然后把该`vnode`添加到`this.cache`中，并设置`vnode.data.keepAlive = true`。最终返回该`vnode`。

以上只是`render`函数执行的过程，`keep-alive`本身也是一个组件，在`render`函数调用生成`vnode`后，同样会走`__patch__`。在创建和`diff`的过程中，也会调用`init`、`prepatch`、`insert`和`destroy`钩子函数。不过，每个钩子函数中所做的处理，和普通组件有所不同。

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
  },
```

在`keep-alive`组件内调用`__patch__`时，如果`render`返回的`vnode`是第一次使用，则走正常的创建流程，如果之前创建过且添加了`vnode.data.keepAlive`，则直接调用`prepatch`方法，且传入的新旧`vnode`相同。

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

`prepatch`函数做了哪些工作，之前也详细的介绍过，这里就不多说了。简单的总结，就是依据新`vnode`中的数据，更新组件内容。

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

在组件插入到页面后，如果是`vnode.data.keepAlive`则会调用`activateChildComponent`，这里面主要是调用子组件的`activated`钩子函数，并设置`vm._inactive`的标识状态。

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

在组件销毁时，如果是`vnode.data.keepAlive`返回`true`，则只调用`deactivateChildComponent`，这里面主要是调用子组件的`deactivated`钩子函数，并设置`vm._directInactive`的标识状态。因为`vnode.data.keepAlive`为`true`的组件，是会被`keep-alive`缓存起来的，所以不会直接调用它的`$destroy()`方法，上面我们也提到了，当`keep-alive`组件被销毁时，会触发它缓存中所有组件的`$destroy()`。

因为`keep-alive`包裹的组件状态变化，还会触发其子组件的`activated`或`deactivated`钩子函数，`activateChildComponent`和`deactivateChildComponent`也会做一些这方面的处理，细节大家可以自行查看。