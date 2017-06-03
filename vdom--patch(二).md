[vdom--patch(一)](vdom--patch(一).md)我们讲了，整个`Vue`对象初始化并渲染到页面中的过程。本篇文章我们主要来谈谈当页面绑定的数据修改后，是如何更新`dom`结构的，即`vdom`的`diff`算法，网上讲解这部分内容的文章有很多，可以互相借鉴补充。

`Vue`和`React`在更新`dom`时，使用的算法相同，都是基于[snabbdom](https://github.com/snabbdom/snabbdom)。

我们前面提到过，当页面绑定的数据修改时，会触发监听该数据的`watcher`对象更新，而从`src/core/lifecycle.js`中的`mountComponent`内，我们看到`watcher`对象更新时会调用`updateComponent`，进而调用`vm._update`方法，`vm._render()`方法会依据新的数据生成新的`VNode`对象，在`Vue.prototype._update`我们会将旧新两个`VNode`对象传入到`__patch__`方法中，所以，最终还是回到了`__patch__`方法。