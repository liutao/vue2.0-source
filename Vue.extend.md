本篇文章讲的是`Vue`的一个全局属性`extend`，它的作用是返回一个`Vue`对象的子类，先来讲它的原因是我们在创建`VNode`对象时，如果当前元素是自定义组件，会用到它。

我们先来看一个使用它的例子：

```HTML
<div id="mount-point"></div>
var Profile = Vue.extend({
  template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>',
  data: function () {
    return {
      firstName: 'Walter',
      lastName: 'White',
      alias: 'Heisenberg'
    }
  }
})

new Profile().$mount('#mount-point')
```

上面的代码，会在页面中输出如下内容：

```HTML
<p>Walter White aka Heisenberg</p>
```

它是如何解析的呢？

该方法的定义是在`src/core/global-api/extend.js`中的`initExtend`方法内

```JavaScript
export function initExtend (Vue: GlobalAPI) {
  
  // 每个继承Vue的对象都有唯一的cid
  Vue.cid = 0
  let cid = 1

  Vue.extend = function (extendOptions: Object): Function {
    ...
  }
}
```

首先给`Vue`添加了一个`cid`，它的值为0，之后每次通过`Vue.extend`创建的子类的`cid`值依次递增。

我们按照刚才使用的例子来一步一步看看`Vue.extend`都执行了哪些操作。

```JavaScript
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }
```

`Super`保存了当前对象，这里是`Vue`本身，`SuperId`是`Vue.cid`即0。`extendOptions._Ctor`用于缓存构造函数，在`Vue`源码中，暂未找到它的用途。

之后定义了对象`Sub`，并给它添加了一系列的全局方法，我们看一下`Sub`对象上，有哪些全局的属性：

```JavaScript
Sub.cid 
Sub.options
Sub.extend
Sub.mixin
Sub.use
Sub.component
Sub.directive
Sub.filter

// 新增
Sub.super  // 指向父级构造函数
Sub.superOptions // 父级构造函数的options
Sub.extendOptions  // 传入的extendOptions
Sub.sealedOptions  // 保存定义Sub时，它的options值有哪些
```

它与`Vue`的构造函数相比，增加了四个全局属性，同时也少了一些全局属性。

`Vue`的全局属性见[Vue-globals](Vue-globals.md)

`Sub`上没有的属性包括：

```JavaScript
Vue.version = '__VERSION__'
Vue.compile = compileToFunctions
Vue.config 
Vue.util
Vue.set
Vue.delete
Vue.nextTick
```

当`new Profile()`时，同样会调用`this._init(options)`方法，我们在[《从一个小栗子查看Vue的声明周期》](从一个小栗子查看Vue的生命周期.md)中提到过，`_init`方法会合并传入的`options`和构造器上的`options`属性，当时对`resolveConstructorOptions`方法只是简单提了一下，这里我们再来看这个方法：

```JavaScript
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // 有super属性，说明Ctor是通过Vue.extend()方法创建的子类
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}
```

这里传入的`Ctor`就是`Profile`，也就是我们上面所说的`Sub`。`Ctor.super`即`Vue`，因为`Sub`上也有全局的`extend`方法，所以可能会有`Profile2 = Profile.extend({})`的请的情况，`superOptions`递归调用了`resolveConstructorOptions`来获得父级的`options`。

如果`Ctor`上保存的`superOptions`与通过递归调用`resolveConstructorOptions`获取到的`options`不同，则说明父级构造器上`options`属性值改变了，`if (superOptions !== cachedSuperOptions)`里面的操作其实就是更新`Ctor`上`options`相关属性。该种情况的出现比如如下例子：

```JavaScript
  var Profile = Vue.extend({
    template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>',
  });
  Vue.mixin({ data: function () {
    return {
      firstName: 'Walter',
      lastName: 'White',
      alias: 'Heisenberg'
    }
  }});
  new Profile().$mount('#mount-point');
```

该例子可以正常运行，但是如果你注释掉`if`块的内容，就无法运行了。页面中输出的文字就只剩下`aka`了。这是因为`Vue.mixin`执行时，会替换`Vue.options`的值。

```JavaScript
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
  }
```

而我们`new Profile`时，获取到`Vue`上的`options`的值还是旧的，所以没有正常渲染。

我们简单看一下更新的流程：

1、 `Ctor.superOptions`指向最新的`superOptions`

2、 通过`resolveModifiedOptions`方法获得修改的`options`值。

```JavaScript
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], sealed[key])
    }
  }
  return modified
}

function dedupe (latest, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    for (let i = 0; i < latest.length; i++) {
      if (sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
```

其实就是以`options`为基础，把`options`的值和`sealedOptions`的值作比较，如果不同，若为数组，则合并数组，否则舍弃`sealedOptions`的值。

3、如果`modifiedOptions`值不为空，则合并到`Ctor.extendOptions`

4、更新`Ctor.options`的值

以上基本就是`Vue.extend`的主要过程，如果之后发现有落下的，会接着补充。