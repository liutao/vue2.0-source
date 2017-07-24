# vue2.0-source
vue 2.2.6源码分析

最近一直在看vue2.2.6的源码，所以准备分几个模块分别记录一下。由于水平有限，对整个框架的源码还没有整体的把握。所以前期内容可能比较零散，更多的是记录自己看的过程。慢慢整理成比较完整的源码分析。这是一场持久战~

该源码分析，会带着大家一起学习`Vue`的大部分代码，而不是简单的讲一下它的原理，我会尽可能的多解释每一行主要的代码含义，另外一些辅助方法什么的，大家可以在学习的过程中，自己看一眼就知道了。

[Vue源码目录结构整理](Vue源码目录结构整理.md)

[从入口文件查看Vue源码](从入口文件查看Vue源码.md)

[从小栗子查看Vue的生命周期](从一个小栗子查看Vue的生命周期.md)

[双向数据绑定](双向数据绑定.md)

[compile概述](compile概述.md)

[compile——生成ast](compile——生成ast.md)

[compile——优化静态内容](compile——优化静态内容.md)

[compile——生成render字符串](compile——生成render字符串.md)

[vdom概述](vdom概述.md)

[Vue.extend](Vue.extend.md)

[vdom——VNode](vdom——VNode.md)

[children的归一化处理](children的归一化处理.md)

[patch——创建dom](patch——创建dom.md)

[patch——diff](patch——diff.md)

[patch——自定义组件的处理流程](patch——自定义组件的处理流程.md)

[事件处理](事件处理.md)

指令的处理

[directives概述](directives概述.md)

[自定义指令](自定义指令.md)

[v-for](v-for.md)

[v-if](v-if.md)

[v-once](v-once.md)

[v-show](v-show.md)

[v-text、v-html、v-cloak、v-pre](v-text、v-html、v-cloak、v-pre.md)

[v-model](v-model.md)

内置组件和标签

[slot和作用域插槽](slot和作用域插槽.md)

[keep-alive](keep-alive.md)

以下是整理一些比较零散的数据，主要是记录结构中每个数据表示什么意思，会不断完善更新：

[Vue全局属性](Vue-globals.md)

[Vue实例属性](Vue实例属性.md)

[AstElement](AstElement.md)

[VNode](VNode.md)
