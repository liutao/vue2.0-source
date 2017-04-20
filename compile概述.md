从[《从一个小栗子查看Vue的生命周期》](从一个小栗子查看Vue的生命周期.md)一文中，我们可以看到，`Vue`的核心可以分为三个大块：**数据处理和双向绑定**、**模板编译**、**虚拟dom**。前面我们对第一部分的主要内容**双向绑定**做了一个分析讲解，接下来我们说一说**模板编译**。

这一部分的内容比较多，也比较复杂。由于所涉及的情况太多了，我也不可能把每一种情况都覆盖到。尽量做到既不啰嗦，又能分享更多的内容。前面我们也提到过，**模板编译**分为三个阶段：生成`ast`、优化静态内容、生成`render`。

官方文档中提到`render`比`template`更加底层，许多人对`render`函数都不是很明白，相信通过这一部分的分析，你可以对`render`基本做到了如指掌。如果你在创建对象时直接传入`render`函数，模板编译这一步就可以直接跳过，这样效率肯定更高，但同时我们编写代码的难度会增加很多。实际开发过程中，根据需要，恰当选择。

`Vue`对象上有一个全局函数`compile`，在`src/entries/web-runtime-with-compiler.js`中。

```JavaScript
import { compileToFunctions } from 'web/compiler/index'
...
...
...
Vue.compile = compileToFunctions
```
该方法来自`src/platforms/web/compiler/index`文件。

```JavaScript
import { isUnaryTag, canBeLeftOpenTag } from './util'
import { genStaticKeys } from 'shared/util'
import { createCompiler } from 'compiler/index'

import modules from './modules/index'
import directives from './directives/index'

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,
  directives,
  isPreTag,
  isUnaryTag,
  mustUseProp,
  canBeLeftOpenTag,
  isReservedTag,
  getTagNamespace,
  staticKeys: genStaticKeys(modules)
}

const { compile, compileToFunctions } = createCompiler(baseOptions)
export { compile, compileToFunctions }

```
该文件中主要定义了一个`baseOptions`，它主要保存了解析模板时和平台相关的一些配置。对应的`src/platforms/weex/compiler/index`中也有一份名称一样的配置。这里我们简单说说`web`相关的这些配置都是什么意思。

* `expectHTML`。目前具体还不是很明白，`weex`中没有改项，从字面意思来看，应该是是否期望`HTML`。

* `modules`。包括`klass`和`style`，对模板中类和样式的解析。

* `directives`。这里包括`model`（`v-model`）、`html`（`v-html`）、`text`(`v-text`)三个





