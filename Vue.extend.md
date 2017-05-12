本篇文章讲的是`Vue`的一个全局属性`extend`，它的作用是返回一个`Vue`对象的子类，具体的文档见[这里](https://cn.vuejs.org/v2/api/#Vue-extend)，先来讲它的原因是我们在创建`VNode`对象时，如果当前元素是自定义组件，会用到它。

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
// 创建 Profile 实例，并挂载到一个元素上。
new Profile().$mount('#mount-point')
```
它的代码在`src/core/global-api/extend.js`中。

```JavaScript

```