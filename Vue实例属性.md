```JavaScript
  vm._uid // 自增的id
  vm._isVue // 标示是vue对象，避免被observe
  vm._renderProxy // Proxy代理对象
  vm._self // 当前vm实例

  vm.$parent // 用于自定义子组件中，指向父组件的实例
  vm.$root // 指向根vm实例
  vm.$children // 当前组件的子组件实例数组
  vm.$refs 

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false // 标识是否已挂载
  vm._isDestroyed = false // 标识是否已销毁
  vm._isBeingDestroyed = false // 标识是否正在销毁
 
  vm._events // 当前元素上绑定的自定义事件
  vm._hasHookEvent // 标示是否有hook:开头的事件

  vm.$vnode // 当前自定义组件在父组件中的vnode，等同于vm.$options._parentVnode
  vm._vnode // 当前组件的vnode
  vm._staticTrees // 当前组件模板内分析出的静态内容的render函数数组
  vm.$el // 当前组件对应的根元素

  vm.$slots // 定义在父组件中的slots，是个对象键为name，值为响应的数组
  vm.$scopedSlots = emptyObject
  // 内部render函数使用的创建vnode的方法
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // 用户自定义render方法时，传入的参数
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  vm._props // 被observe的存储props数据的对象
  vm._data // 被observe的存储data数据的对象
  vm._computedWatchers // 保存计算属性创建的watcher对象


```

## `vm.$options`

```JavaScript
declare type ComponentOptions = {
  // data
  data: Object | Function | void;  // 传入的data数据
  props?: { [key: string]: PropOptions }; // props传入的数据
  propsData?: ?Object;  // 对于自定义组件，父级通过`props`传过来的数据
  computed?: {  // 传入的计算属性
    [key: string]: Function | {
      get?: Function;
      set?: Function;
      cache?: boolean
    }
  };
  methods?: { [key: string]: Function }; // 传入的方法
  watch?: { [key: string]: Function | string };  // 传入的watch

  // DOM
  el?: string | Element;  // 传入的el字符串
  template?: string;  // 传入的模板字符串
  render: (h: () => VNode) => VNode;  // 传入的render函数
  renderError?: (h: () => VNode, err: Error) => VNode;
  staticRenderFns?: Array<() => VNode>;

  // 钩子函数
  beforeCreate?: Function;
  created?: Function;
  beforeMount?: Function;
  mounted?: Function;
  beforeUpdate?: Function;
  updated?: Function;
  activated?: Function;
  deactivated?: Function;
  beforeDestroy?: Function;
  destroyed?: Function;

  // assets
  directives?: { [key: string]: Object }; // 指令
  components?: { [key: string]: Class<Component> }; // 子组件的定义
  transitions?: { [key: string]: Object };
  filters?: { [key: string]: Function }; // 过滤器

  // context
  provide?: { [key: string | Symbol]: any } | () => { [key: string | Symbol]: any };
  inject?: { [key: string]: string | Symbol } | Array<string>;

  // component v-model customization
  model?: {
    prop?: string;
    event?: string;
  };

  // misc
  parent?: Component; // 父组件实例
  mixins?: Array<Object>; // mixins传入的数据
  name?: string; // 当前的组件名
  extends?: Class<Component> | Object; // extends传入的数据
  delimiters?: [string, string]; // 模板分隔符

  // 私有属性，均为内部创建自定义组件的对象时使用
  _isComponent?: true;  // 是否是组件
  _propKeys?: Array<string>; // props传入对象的键数组
  _parentVnode?: VNode; // 当前组件，在父组件中的VNode对象
  _parentListeners?: ?Object; // 当前组件，在父组件上绑定的事件
  _renderChildren?: ?Array<VNode>; // 父组件中定义在当前元素内的子元素的VNode数组（slot）
  _componentTag: ?string;  // 自定义标签名
  _scopeId: ?string;
  _base: Class<Component>; // Vue
  _parentElm: ?Node; // 当前自定义组件的父级dom结点
  _refElm: ?Node; // 当前元素的nextSlibing元素，即当前dom要插入到_parentElm结点下的_refElm前
}
```
