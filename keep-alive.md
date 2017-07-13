本篇文章，我们来讲一下`keep-alive`的实现。`Vue`中，有三个内置的抽象组件，分别是`keep-alive`、`transition`和`transition-group`，它们都有一个共同的特点，就是自身不会渲染一个DOM元素，也不会出现在父组件链中。`keep-alive`的作用，是包裹动态组件时，会缓存不活动的组件实例，而不是销毁它们。具体的用法见[这里](https://cn.vuejs.org/v2/api/#keep-alive)。

该组件的定义，是在`src/core/components/keep-alive.js`文件中。它会在`Vue`初始化时，添加在`Vue.options.components`上，所以在所有的组件中，都可以直接只用它。直接看代码：

```JavaScript
export default {
  name: 'keep-alive',
  abstract: true,

  props: {
    include: patternTypes,
    exclude: patternTypes
  },

  created () {
    this.cache = Object.create(null)
  },

  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache[key])
    }
  },

  watch: {
    include (val: string | RegExp) {
      pruneCache(this.cache, name => matches(val, name))
    },
    exclude (val: string | RegExp) {
      pruneCache(this.cache, name => !matches(val, name))
    }
  },

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