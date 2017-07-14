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
      }
    } else {
      ...
    }
  }
}
```

`processAttrs`中会遍历所有的属性，整体上分为两部分，一种是指令，一种是普通属性。指令又分`v-bind`、`v-on`和其它指令的处理。