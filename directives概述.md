本篇文章，我们来聊一聊，`Vue`中的指令。`Vue`内置的指令有很多，包括`v-text`、`v-html`、`v-show`、`v-if`、`v-else`、`v-else-if`、`v-for`、`v-on`、`v-bind`、`v-model`、`v-pre`、`v-cloak`、`v-once`。每个指令的用途，大家可以自行查看[文档](https://cn.vuejs.org/v2/api/#指令)。

因为指令都是添加在模板的标签上的，所以第一步都是要经过模板编译的洗礼。

```JavaScript
	if (!inVPre) {
    processPre(element)
    if (element.pre) {
      inVPre = true
    }
  }
  if (platformIsPreTag(element.tag)) {
    inPre = true
  }
  if (inVPre) {
    processRawAttrs(element)
  } else {
    processFor(element)
    processIf(element)
    processOnce(element)
    processKey(element)

    // determine whether this is a plain element after
    // removing structural attributes
    element.plain = !element.key && !attrs.length

    processRef(element)
    processSlot(element)
    processComponent(element)
    for (let i = 0; i < transforms.length; i++) {
      transforms[i](element, options)
    }
    processAttrs(element)
  }
```

以上代码摘自`src/compiler/parser/index.js`文件，这是标签处理的流程。本篇文章不会涉及每个指令解析的细节，只是概述一下整体上的处理流程。

`processPre`是用于解析`v-pre`，`processFor`解析`v-for`，`processIf`解析`v-if`、`v-else-if`和`v-else`，`processOnce`解析`v-once`，`processKey`解析`key`，`processRef`解析`ref`，`processSlot`解析`slot`，`processComponent`解析`component`，剩下的指令和属性统一都交给了`processAttrs`处理，比如`v-bind`、`v-on`、上面提到的其它指令以及普通属性等。

```JavaScript
function processAttrs (el) {
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    // 指令
    if (dirRE.test(name)) {
      // mark element as dynamic
      el.hasBindings = true
      // modifiers
      modifiers = parseModifiers(name)
      if (modifiers) {
        name = name.replace(modifierRE, '')
      }
      if (bindRE.test(name)) { // v-bind
        name = name.replace(bindRE, '')
        ...
      } else if (onRE.test(name)) { // v-on
        ...
      } else { // normal directives
        ...
        addDirective(el, name, rawName, value, arg, modifiers)
        ...
      }
    } else {
      ...
    }
  }
}
```

`processAttrs`中会遍历所有的属性，整体上分为两部分，一种是指令，一种是普通属性。指令又分`v-bind`、`v-on`和其它指令的处理。

`v-bind`和`v-on`之后单独讲，我们来看通用指令的处理流程，在注释“normal directives”的代码块中，有一个主要的处理函数`addDirective`，它只是把指令相关信息存到了`el.directives`数组中。

```JavaScript
export function addDirective (
  el: ASTElement,
  name: string,
  rawName: string,
  value: string,
  arg: ?string,
  modifiers: ?ASTModifiers
) {
  (el.directives || (el.directives = [])).push({ name, rawName, value, arg, modifiers })
}
```

以上是生成`ast`的处理，普通指令在生成`render`函数字符串时，会添加到`data`数据上，且在`data`的第一位。

```JavaScript
function genData (el: ASTElement): string {
  let data = '{'
  // directives first.
  // directives may mutate the el's other properties before they are generated.
  const dirs = genDirectives(el)
  if (dirs) data += dirs + ','
  ...
  return data
}
function genDirectives (el: ASTElement): string | void {
  const dirs = el.directives
  if (!dirs) return
  let res = 'directives:['
  let hasRuntime = false
  let i, l, dir, needRuntime
  for (i = 0, l = dirs.length; i < l; i++) {
    dir = dirs[i]
    needRuntime = true
    const gen: DirectiveFunction = platformDirectives[dir.name] || baseDirectives[dir.name]
    if (gen) {
      // compile-time directive that manipulates AST.
      // returns true if it also needs a runtime counterpart.
      needRuntime = !!gen(el, dir, warn)
    }
    if (needRuntime) {
      hasRuntime = true
      res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
        dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
      }${
        dir.arg ? `,arg:"${dir.arg}"` : ''
      }${
        dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
      }},`
    }
  }
  if (hasRuntime) {
    return res.slice(0, -1) + ']'
  }
}
```

`platformDirectives`是平台相关的一些指令处理，`web`端包括`v-html`、`v-model`、`v-text`，`baseDirectives`包括`v-bind`和`v-cloak`的处理。

如果我们自定义的指令，返回的`gen`是`false`，所以`needRuntime`返回的永远都是`true`，然后拼接好数据，添加到`res`上。对于上面这五个指令，只有`v-model`返回的是`true`，其它的指令不会添加到`directive`数组中在`patch`过程中处理。

对于添加到`directives`上的数据，像`class`或`style`等处理方式一致，是在`patch`中通过添加到`cbs`中的钩子函数处理的。具体过程见`src/core/vdom/modules/directives.js`文件中。

```JavaScript
export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode: VNodeWithData) {
    updateDirectives(vnode, emptyNode)
  }
}
```

这三个钩子函数，最终调用的都是`updateDirectives`方法，`updateDirectives`接受旧新两个`vnode`对象作为参数。

```JavaScript
function updateDirectives (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}
```

如果新或旧`vnode`的`data`中有`directives`属性，则调用`_update`方法来进行处理。`_update`方法的主要操作，其实就是调用指令的各种钩子函数。具体讲解，见[自定义指令](自定义指令.md)。
