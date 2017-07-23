本篇文章，我们来看看`Vue`中`v-model`指令的实现，它也是内置指令中，实现最复杂的一个。它涉及到`select`、`input`、`textarea`等多种标签，`input`又分为`checkbox`、`radio`等多种类型。本篇文章可能会有些长，因为不同标签、类型的处理方式不同，我个人希望每一个的实现都过一下。

我们一起来揭开它的神秘面纱~

`ast`生成的处理流程，和其他普通指令都差不多，唯一不同的是，这里多了一个校验处理。

```JavaScript
function processAttrs (el) {
  ...
  addDirective(el, name, rawName, value, arg, modifiers)
  if (process.env.NODE_ENV !== 'production' && name === 'model'){
    checkForAliasModel(el, value)
  }
  ...
}
function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`
      )
    }
    _el = _el.parent
  }
}
```

上面的校验是告诉我们，不能用`for`循环的值来作为`value`。如下例子会报错：

```html
<div id="app">
  <p v-for="item in value">
    <input v-model="item"/>
  </p>
</div>
<script type="text/javascript">
  var vm = new Vue({
    el: '#app',
    data: {
      value: ['test','test1']
    }
  }).$mount('#app');
</script>
```

类似于`v-text`、`v-html`等指令，在函数生成时，`platformDirectives`中内置了对`v-model`的处理。

```JavaScript
export default function model (
  el: ASTElement,
  dir: ASTDirective,
  _warn: Function
): ?boolean {
  warn = _warn
  const value = dir.value
  const modifiers = dir.modifiers
  const tag = el.tag
  const type = el.attrsMap.type
  // input的type不支持动态绑定
  // file类型是只读的，不能用v-model
  ...
  if (tag === 'select') {
    genSelect(el, value, modifiers)
  } else if (tag === 'input' && type === 'checkbox') {
    genCheckboxModel(el, value, modifiers)
  } else if (tag === 'input' && type === 'radio') {
    genRadioModel(el, value, modifiers)
  } else if (tag === 'input' || tag === 'textarea') {
    genDefaultModel(el, value, modifiers)
  } else if (!config.isReservedTag(tag)) {
    genComponentModel(el, value, modifiers)
    // component v-model doesn't need extra runtime
    return false
  } else if (process.env.NODE_ENV !== 'production') {
    ...
	// 其它标签不支持v-model
  }
  // ensure runtime directive metadata
  return true
}
```

上面的代码，我精简了不合法提示的部分。我们可以看到，`v-model`的处理，主要分为四种情况，`select`、`checkbox`、`radio`、`其它input || textarea`以及自定义标签。

并且上面的几种情况中，只有自定义标签返回了`false`，其它返回的都是`true`，说明自定义标签不会把`v-model`指令添加到`directives`中，也就不会在`patch`过程中有钩子函数操作。而其它情况，在`patch`过程中，还会有一些操作。

接下来，我就带着大家一起来看看每种情况的实现。

### `select`

先来看一个例子

```html
<div id="app">
	<select v-model="value">
		<option>1</option>
		<option>2</option>
		<option>3</option>
	</select>
	<p>{{value}}</p>
</div>
<script type="text/javascript">
	var vm = new Vue({
		el: '#app',
		data: {
			value: 3
		}
	}).$mount('#app');
</script>
```

上面的例子，是最简单的`select`绑定`v-model`的例子。从上面的分析我们可以看到它是调用`genSelect`处理的。

```javascript
function genSelect (
    el: ASTElement,
    value: string,
    modifiers: ?ASTModifiers
) {
  const number = modifiers && modifiers.number
  const selectedVal = `Array.prototype.filter` +
    `.call($event.target.options,function(o){return o.selected})` +
    `.map(function(o){var val = "_value" in o ? o._value : o.value;` +
    `return ${number ? '_n(val)' : 'val'}})`

  const assignment = '$event.target.multiple ? $$selectedVal : $$selectedVal[0]'
  let code = `var $$selectedVal = ${selectedVal};`
  code = `${code} ${genAssignmentCode(value, assignment)}`
  addHandler(el, 'change', code, null, true)
}
```

有`number`修饰符，表示值要作为数字来处理，`_n`函数其实就是把`val`转换成数字。`selectedVal`中的含义是先获取`options`中`selected`的元素，然后依次获取`_value || value`的值。如果下拉列表是多选的，`assignment`值为数组，否则就是单个`val`。

这里有一个比较重要的函数`genAssignmentCode`，所有情况的操作过程中，都用到了它。

```JavaScript
export function genAssignmentCode (
  value: string,
  assignment: string
): string {
  const modelRs = parseModel(value)
  if (modelRs.idx === null) {
    return `${value}=${assignment}`
  } else {
    return `var $$exp = ${modelRs.exp}, $$idx = ${modelRs.idx};` +
      `if (!Array.isArray($$exp)){` +
        `${value}=${assignment}}` +
      `else{$$exp.splice($$idx, 1, ${assignment})}`
  }
}
```

`parseModel`是解析`value`，因为我们绑定`value`可以有多种情况，比如`value`、`value.a`、`value['a']`、`value[0]`等。

```JavaScript
export function parseModel (val: string): Object {
  str = val
  len = str.length
  index = expressionPos = expressionEndPos = 0
  // 没有中括号或不是以中括号结尾的
  if (val.indexOf('[') < 0 || val.lastIndexOf(']') < len - 1) {
    return {
      exp: val,
      idx: null
    }
  }

  while (!eof()) {
    chr = next()
    /* istanbul ignore if */
    if (isStringStart(chr)) {
      parseString(chr)
    } else if (chr === 0x5B) {
      parseBracket(chr)
    }
  }

  return {
    exp: val.substring(0, expressionPos),
    idx: val.substring(expressionPos + 1, expressionEndPos)
  }
}
```

如果有中括号，且是以中括号结尾的，则会执行一个`while`循环。该部分操作代码比较多，我就不列出来了，大体的过程是遍历每一个字符，最终找出与最后一个`]`对应的`[`，然后把`[`之前的内容放到`exp`中，中括号中间的内容放到`idx`中。例如`value`值为`value[0]`，最终解析之后返回的值为`{exp: "value", idx: "0"}`。

回到`genAssignmentCode`，如果`modelRs.idx`为`null`，则直接给`value`赋值，这时就会直接触发模板的更新。否则如果`exp`不是数组，也直接赋值，如果`exp`是数组，则会直接删除之前的值，并在原来的位置插入新的值。

`genSelect`的最后，会通过`addHandler`方法(我们在[事件处理](事件处理.md)中讲过事件处理的整体流程)，把生成的回调函数内容，添加到元素的`change`事件中，所以改变下拉框的值时，会触发`change`事件，进而会修改`value`的值，触发模板的整体更新。

我们上面的例子，最终生成的`render`函数字符串如下：

```JavaScript
"with(this){return _c('div',{attrs:{"id":"app"}},[_c('select',{directives:[{name:"model",rawName:"v-model",value:(value),expression:"value"}],on:{"change":function($event){var $$selectedVal = Array.prototype.filter.call($event.target.options,function(o){return o.selected}).map(function(o){var val = "_value" in o ? o._value : o.value;return val}); value=$event.target.multiple ? $$selectedVal : $$selectedVal[0]}}},[_c('option',[_v("1")]),_v(" "),_c('option',[_v("2")]),_v(" "),_c('option',[_v("3")])]),_v(" "),_c('p',[_v(_s(value))])])}"
```

整体比较长，我们注意到`select`的`data`的`directives`中包含了我们的`v-model`指令，并且`on`中有一个`change`事件，对应的函数体就是刚才我们讲过的处理操作。

以上是编译阶段的操作，有了`directives`，我们在`patch`的过程中，还会调用相应的钩子函数来处理，`runtime/directives/model.js`中，主要有两个钩子函数`inserted`和`componentUpdated`：

```JavaScript
inserted (el, binding, vnode) {
    if (vnode.tag === 'select') {
      const cb = () => {
        setSelected(el, binding, vnode.context)
      }
      cb()
      /* istanbul ignore if */
      if (isIE || isEdge) {
        setTimeout(cb, 0)
      }
    } else if (vnode.tag === 'textarea' || el.type === 'text' || el.type === 'password') {
      ...
    }
  },
```

先来看`inserted`，它是在dom已经绘制到页面之后调用。这里主要调用了一个`setSelected`方法：

```JavaScript
function setSelected (el, binding, vm) {
  const value = binding.value
  const isMultiple = el.multiple
  if (isMultiple && !Array.isArray(value)) {
    process.env.NODE_ENV !== 'production' && warn(
      `<select multiple v-model="${binding.expression}"> ` +
      `expects an Array value for its binding, but got ${
        Object.prototype.toString.call(value).slice(8, -1)
      }`,
      vm
    )
    return
  }
  let selected, option
  for (let i = 0, l = el.options.length; i < l; i++) {
    option = el.options[i]
    if (isMultiple) {
      selected = looseIndexOf(value, getValue(option)) > -1
      if (option.selected !== selected) {
        option.selected = selected
      }
    } else {
      if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) {
          el.selectedIndex = i
        }
        return
      }
    }
  }
  if (!isMultiple) {
    el.selectedIndex = -1
  }
}
```

首先，如果我们的下拉列表是多选的，我们的`value`值必须是一个数组，否则会报错。

然后遍历所有的`option`，如果是多选下拉列表，则依次判断`option`的值是否在`value`中，如果在则选中。如果是单选下拉框，则是通过修改`select`的`selectedIndex`值来控制哪一项被选中。

```JavaScript
componentUpdated (el, binding, vnode) {
    if (vnode.tag === 'select') {
      setSelected(el, binding, vnode.context)
      // in case the options rendered by v-for have changed,
      // it's possible that the value is out-of-sync with the rendered options.
      // detect such cases and filter out values that no longer has a matching
      // option in the DOM.
      const needReset = el.multiple
        ? binding.value.some(v => hasNoMatchingOption(v, el.options))
        : binding.value !== binding.oldValue && hasNoMatchingOption(binding.value, el.options)
      if (needReset) {
        trigger(el, 'change')
      }
    }
  }
```

`componentUpdated`是在dom模板更新之后调用，我们看到这了只有对`select`的操作。首先同样是通过`setSelected`来设置元素被选中。

由于我们的`option`可能是通过`v-for`生成，如果`v-for`中的数据改变了，则`option`也会随之改变。

```JavaScript
function hasNoMatchingOption (value, options) {
  for (let i = 0, l = options.length; i < l; i++) {
    if (looseEqual(getValue(options[i]), value)) {
      return false
    }
  }
  return true
}
```

`hasNoMatchingOption`是判断`value`的值中，是否都有`option`与之对应，如果是`needReset`返回`false`，否则返回`true`。如果有不匹配的，则触发一次元素的`change`事件，来更新数据和模板。

### `checkbox`

同样看一个例子：

```html
<div id="app">
  <input type="checkbox" v-model="value" true-value="1" false-value="0" />
  <p>{{value}}</p>
</div>
<script>
  var vm = new Vue({
    el: '#app',
    data: {
      value: 1
    }
  }).$mount('#app');
</script>

```

`checkbox`比较特殊，它有两种状态，一个真一个假。我们可以通过`true-value`和`false-value`分别设置复选框选中时和未选中时的`value`值。如上面的例子中，选中时`value`为1，未选中时为0。`true-value`的默认值是"true"，同理`false-value`的默认值是"false"。如果我们没有设置，当我们改变复选框状态时，`value`的值就会是"true"或"false"。当然这只是基本的一种情况，`value`如果是一个数组，处理方式就会又有所不同。

它是由`genCheckboxModel`进行处理的。

```JavaScript
function genCheckboxModel (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
) {
  const number = modifiers && modifiers.number
  const valueBinding = getBindingAttr(el, 'value') || 'null'
  const trueValueBinding = getBindingAttr(el, 'true-value') || 'true'
  const falseValueBinding = getBindingAttr(el, 'false-value') || 'false'
  addProp(el, 'checked',
    `Array.isArray(${value})` +
      `?_i(${value},${valueBinding})>-1` + (
        trueValueBinding === 'true'
          ? `:(${value})`
          : `:_q(${value},${trueValueBinding})`
      )
  )
  addHandler(el, CHECKBOX_RADIO_TOKEN,
    `var $$a=${value},` +
        '$$el=$event.target,' +
        `$$c=$$el.checked?(${trueValueBinding}):(${falseValueBinding});` +
    'if(Array.isArray($$a)){' +
      `var $$v=${number ? '_n(' + valueBinding + ')' : valueBinding},` +
          '$$i=_i($$a,$$v);' +
      `if($$c){$$i<0&&(${value}=$$a.concat($$v))}` +
      `else{$$i>-1&&(${value}=$$a.slice(0,$$i).concat($$a.slice($$i+1)))}` +
    `}else{${value}=$$c}`,
    null, true
  )
}
```

从上面的代码中，我们看到除了`true-value`和`false-value`，我们还可以传一个`value`属性，它的默认值是`null`。它的作用我们稍后再说。

因为我们设置复选框是否选中，是通过`checked`属性来控制的。如果我们的`value`绑定的数据是一个数组，则判断我们设置的"value"属性值是否在数组中，如果在则返回`true`，不在则返回`false`。如果`value`绑定的数据不是一个数组，则判断`trueValueBinding === 'true'`，如果返回真，则直接返回`value`绑定的值，否则判断`value`和`trueValueBinding`绑定的值是否相等。以上都是在模板第一次初始化时的处理。

同样，为了做的数据的双向绑定，我们需要给元素添加事件回调。这里添加的事件时`CHECKBOX_RADIO_TOKEN`，在[事件绑定](事件绑定.md)的讲解中，我们提到在`addEventListener`之前，需要对`on`中的事件进行处理：

```JavaScript
function normalizeEvents (on) {
  let event
  /* istanbul ignore if */
  if (on[RANGE_TOKEN]) {
    // IE input[type=range] only supports `change` event
    event = isIE ? 'change' : 'input'
    on[event] = [].concat(on[RANGE_TOKEN], on[event] || [])
    delete on[RANGE_TOKEN]
  }
  if (on[CHECKBOX_RADIO_TOKEN]) {
    // Chrome fires microtasks in between click/change, leads to #4521
    event = isChrome ? 'click' : 'change'
    on[event] = [].concat(on[CHECKBOX_RADIO_TOKEN], on[event] || [])
    delete on[CHECKBOX_RADIO_TOKEN]
  }
}
```

这里其实就是主要对`CHECKBOX_RADIO_TOKEN`和`RANGE_TOKEN`的处理。根据不同的浏览器，绑定不同的事件。

我们`checkbox`事件的处理就是下面的一大段字符串，我们把它整理成可读的`JavaScript`代码：

```JavaScript
var $$a=${value},
  $$el=$event.target,
  $$c=$$el.checked?(${trueValueBinding}):(${falseValueBinding});
if(Array.isArray($$a)){
  var $$v=${number ? '_n(' + valueBinding + ')' : valueBinding},
    $$i=_i($$a,$$v);
  if($$c){
    $$i<0&&(${value}=$$a.concat($$v))
  } else {
    $$i>-1&&(${value}=$$a.slice(0,$$i).concat($$a.slice($$i+1)))
  }
} else {
  ${value}=$$c
}
```

赋值什么的就不多说了，

1、如果`value`绑定的值是数组

根据复选框的选中状态来获取`trueValueBinding`或`falseValueBinding`的值并添加到`$$c`上。如果`$$c`返回真且`valueBinding`的值不在`value`绑定的数组中，则把`valueBingding`的值添加到数组的最后。如果`$$c`返回假且`valueBinding`的值在`value`绑定的数组中，则从数组中删除该值。

2、如果`value`绑定的值不是数组

直接把`$$c`的值赋值给数组

`value`不是数组的情况，我们上面的例子已经满足，我们在给一个`value`是数组的例子：

```html
<div id="app">
 	<input type="checkbox" v-model.number="trueVal" value="3" />
 	<p>{{trueVal}}</p>
</div>
<script>
  var vm = new Vue({
    el: '#app',
    data: {
      trueVal: [1,2]
    }
  }).$mount('#app');
</script>
```

该例子运行，我们可以看到因为`trueVal`的值不包括3，所以初始情况复选框是没有被选中的。我们改变复选框的选中状态，发现选中时`trueVal`的值为`[1,2,3]`，未选中时值为`[1,2]`。