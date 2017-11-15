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

* `directives`。这里包括`model`（`v-model`）、`html`（`v-html`）、`text`(`v-text`)三个指令。

* `isPreTag`。是否是`pre`标签。

* `isUnaryTag`。是否是单标签，比如`img`、`input`、`iframe`等。

* `mustUseProp`。需要使用`props`绑定的属性，比如`value`、`selected`等。

* `canBeLeftOpenTag`。可以不闭合的标签，比如`tr`、`td`等。

* `isReservedTag`。是否是保留标签，`html`标签和`SVG`标签。

* `getTagNamespace`。获取命名空间，`svg`和`math`。

* `staticKeys`。静态关键词，包括`staticClass,staticStyle`。

上面这些方法或者属性，在编译模板时会用到。这里只是简单的列出来它们的用途，方便看一眼。

我们来看`createCompiler`函数的实现。

```JavaScript
export function createCompiler (baseOptions: CompilerOptions) {
  const functionCompileCache: {
    [key: string]: CompiledFunctionResult;
  } = Object.create(null)

  // compile 函数的实现

  // compileToFunctions 函数的实现

  return {
    compile,
    compileToFunctions
  }
}
```

该函数只是`compile`和`compileToFunctions`的简单封装，开始定义了`functionCompileCache`，它用来缓存编译之后的模板，方便之后复用。

因为`compileToFunctions`里面调用了`compile`，所以我们先看一下`compile`。

```JavaScript
  function compile (
    template: string,
    options?: CompilerOptions
  ): CompiledResult {
    const finalOptions = Object.create(baseOptions)
    const errors = []
    const tips = []
    finalOptions.warn = (msg, tip) => {
      (tip ? tips : errors).push(msg)
    }

    if (options) {
      // merge custom modules
      if (options.modules) {
        finalOptions.modules = (baseOptions.modules || []).concat(options.modules)
      }
      // merge custom directives
      if (options.directives) {
        finalOptions.directives = extend(
          Object.create(baseOptions.directives),
          options.directives
        )
      }
      // copy other options
      for (const key in options) {
        if (key !== 'modules' && key !== 'directives') {
          finalOptions[key] = options[key]
        }
      }
    }

    const compiled = baseCompile(template, finalOptions)
    if (process.env.NODE_ENV !== 'production') {
      errors.push.apply(errors, detectErrors(compiled.ast))
    }
    compiled.errors = errors
    compiled.tips = tips
    return compiled
  }
```

我们从上往下，依次看看它都做了哪些事儿。它接收两个参数`template`和`options`，`template`不用过多解释，`options`在内部主要是用户自己定义的`delimiters`。

`finalOptions`继承自我们上面提到的`baseOptions`，并添加了一个搜集错误的`warn`方法，然后合并了`options`传入的各种配置选项。`modules`和`directives`合并方法不同是因为`modules`是数组，而`directives`是一个对象。

`baseCompile`中执行的就是模板编译的三个重要步骤，后面我们会详细讲解。

最终，返回编译之后的对象。

```JavaScript
function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    options = options || {}

    ...
    // check cache
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (functionCompileCache[key]) {
       return functionCompileCache[key]
    }

    // compile
    const compiled = compile(template, options)

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        warn(
          `Error compiling template:\n\n${template}\n\n` +
          compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
          vm
        )
      }
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(msg => tip(msg, vm))
      }
    }

    // turn code into functions
    const res = {}
    const fnGenErrors = []
    res.render = makeFunction(compiled.render, fnGenErrors)
    const l = compiled.staticRenderFns.length
    res.staticRenderFns = new Array(l)
    for (let i = 0; i < l; i++) {
      res.staticRenderFns[i] = makeFunction(compiled.staticRenderFns[i], fnGenErrors)
    }

    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }
    return (functionCompileCache[key] = res)
  }
```
`compileToFunctions`函数中，首先从缓存中获取编译结果，没有则调用`compile`函数来编译。在开发环境，我们在这里会抛出编译过程中产生的错误，最终返回一个含有`render`函数，和`staticRenderFns`数组的对象，并把它放在缓存中。

这里我们使用`makeFunction`来创建函数。

```JavaScript
function makeFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}
```

很简单，就是利用了我们`new Function`，并搜集了错误。

`compile`和`compileToFunctions`两个方法的不同之处有以下几点。

1、 `compile`返回的结果中`render`是字符串，`staticRenderFns`是字符串组成的数组，而`compileToFunctions`中把它们变成了函数。

2、 `compile`返回的结果中，有模板生成的`ast`和搜集到的错误。而`compileToFunctions`对其结果进行了一些处理。
