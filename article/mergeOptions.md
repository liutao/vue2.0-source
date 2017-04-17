打开`mergeOptions`的大门，由于代码太多，大家手动打开`src/core/util/options.js`文件，我带着大家过一下这个文件都干了什么，其中重要的代码，我会在下面列出。

这里有一个很重要的合并对象`strats`，它保存了所有属性的合并策略是什么样的。`Vue`给我们提供了配置[`optionMergeStrategies`](https://cn.vuejs.org/v2/api/#optionMergeStrategies)对象，来让我们手动去控制属性的合并策略。`Vue`内置了集中