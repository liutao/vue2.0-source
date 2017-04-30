```JavaScript

// src/core/index.js
Vue.version = '__VERSION__'

// src/entries/web-runtime-with-compiler.js
Vue.compile = compileToFunctions    // 把模板template转换为render函数

// src/core/global-api 在目录结构中，我们指出，Vue的静态方法大多都是在该文件夹中定义的
// src/core/global-api/index.js
Vue.config //不过以直接替换整个config对象
Vue.util //几个工具方法，但是官方不建议使用
Vue.set
Vue.delete
Vue.nextTick
Vue.options = {
  components: {KeepAlive: KeepAlive}
  directives: {},
  filters: {},
  _base: Vue
}

// src/core/global-api/use.js
Vue.use

// src/core/global-api/mixin.js
Vue.mixin

// src/core/global-api/extend.js
Vue.extend

// src/core/global-api/assets.js
Vue.component
Vue.directive
Vue.filter
```