之前我们讲解了把`HTML`模板字符串，解析成`render`函数的过程。从`render`函数，到真真切切把内容渲染到页面中，还需要经过哪些步骤呢？这就是我们接下来要说的内容。

我们都知道`Vue2.0`之后，引入了虚拟dom。那么虚拟dom到底是个什么东西呢？其实它就是一个有着一定数据结构的对象，因为我们原生创建一个dom对象时，会给它添加许许多多的属性。在控制台执行如下代码试试：

```JavaScript
var div = document.createElement('div');
for(var k in div ){
  console.log(k)
}
```

我们看到，打印了几十个属性。当我们页面中dom数比较多的时候，频繁的修改、增加dom的数量，对性能会有极大的浪费。虚拟dom就是为了解决这个问题而生，它建立在真实的dom之上。当数据驱动dom修改时，它会通过diff计算，来尽量少的创建新元素，而尽可能多地复用旧的om，这样就可以减少频繁创建新dom带来的消耗。

其实调用`render`函数，返回的就是一个虚拟动dom——`vnode`。它很简单，就是保存了一些当前dom相关的数据，以及与其它`vnode`之间的父子关系等，具体结构见(VNode)[VNode.md]。

那`vnode`如何绘制到页面上呢？我们回到`Vue.prototype._update`

```JavaScript
Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    ...
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    ...
  }

```

别的暂且不管，我们看到这里有一个特别重要的方法`vm.__patch__`。这就是我们元素渲染、`vnode`做diff并修改、元素销毁的地方。

上面的代码中，`prevVnode`指的是旧的`vnode`，我们第一次创建时，没有旧的`vnode`，所以`!prevVnode`返回`true`，此时的操作就是创建根据`vnode`直接绘制dom到页面中。

当数据更新再次调用`_update`方法时，`prevVnode`是旧的`vnode`，此时传入新旧两个虚拟dom对象，`__patch__`会对它们做diff，并相应修改页面展现。

```JavaScript
// 销毁对象同样是通过__patch__方法。
Vue.prototype.$destroy = function () {
    ...
    vm.__patch__(vm._vnode, null)
    ...
  }
```

从上面的代码我们看到销毁`vue`对象时，通过给`__patch__`第二个参数传入`null`，来从页面中删除相应dom。

该方法添加到`Vue.prototype`上是在`src/entries/web-runtime.js`中：

```JavaScript
Vue.prototype.__patch__ = inBrowser ? patch : noop
```

我们看到，只有是在浏览器中，该方法是`patch`，否则，它是一个空函数。

文件开头有该方法引入的地方`import { patch } from 'web/runtime/patch'`，其实该方法在`src/platforms/web/runtime/patch.js`。

```JavaScript
import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

const modules = platformModules.concat(baseModules)

export const patch: Function = createPatchFunction({ nodeOps, modules })

```
这个文件夹下的内容，其实我们也比较熟悉，就是区分`web`和`weex`不同内容的地方。

**`nodeOps`** 封装了许许多多对原生dom操作的方法，基本上都很简单，大家自己看一眼就好了。

**`modules`** 和之前编译`html`文本时类似，这里是对一些特殊内容的特殊处理，它内部提供了一组又一组的`create`、`update`、`destroy`方法，在`patch`的不同时间分别调用。

**`baseModules`** 是`web`和`weex`都有的处理，包括`directives`和`ref`属性的处理。

**`platformModules`** 很明显就是平台相关的一些属性的处理，这里包括`attrs`、`class`、`domProps`、`on`、`style`和`show`。

其实这些属性对应的都是生成`render`字符串调用的`generate`函数中，给`_c`传入的第二个参数，也就是创建`vnode`时传入的一些属性。

具体的`patch`还是来自`createPatchFunction`，具体的操作都在这里，之后我会单独拿出来讲解，今天就是简单的带大家过一下。

