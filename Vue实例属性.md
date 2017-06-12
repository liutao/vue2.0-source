```JavaScript
declare type ComponentOptions = {
  // data
  data: Object | Function | void;  // 传入data数据
  props?: { [key: string]: PropOptions }; // props传入的数据
  propsData?: ?Object;  // 根Vue对象传入props数据
  computed?: {
    [key: string]: Function | {
      get?: Function;
      set?: Function;
      cache?: boolean
    }
  };
  methods?: { [key: string]: Function };
  watch?: { [key: string]: Function | string };

  // DOM
  el?: string | Element;
  template?: string;
  render: (h: () => VNode) => VNode;
  renderError?: (h: () => VNode, err: Error) => VNode;
  staticRenderFns?: Array<() => VNode>;

  // lifecycle
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
  directives?: { [key: string]: Object };
  components?: { [key: string]: Class<Component> };
  transitions?: { [key: string]: Object };
  filters?: { [key: string]: Function };

  // context
  provide?: { [key: string | Symbol]: any } | () => { [key: string | Symbol]: any };
  inject?: { [key: string]: string | Symbol } | Array<string>;

  // component v-model customization
  model?: {
    prop?: string;
    event?: string;
  };

  // misc
  parent?: Component;
  mixins?: Array<Object>;
  name?: string;
  extends?: Class<Component> | Object;
  delimiters?: [string, string];

  // 私有属性，均为内部创建自定义组件的对象时使用
  _isComponent?: true;  // 是否是组件
  _propKeys?: Array<string>;
  _parentVnode?: VNode; // 当前组件，在父组件中的VNode对象
  _parentListeners?: ?Object; // 当前组件，在父组件实例中，VNode上绑定的事件
  _renderChildren?: ?Array<VNode>; // 自定义标签子元素的VNode数组
  _componentTag: ?string;  // 自定义标签名
  _scopeId: ?string;
  _base: Class<Component>; // Vue
  _parentElm: ?Node; // 当前自定义组件的父级dom结点
  _refElm: ?Node; // 当前元素的nextSlibing元素，即当前dom要插入到_parentElm结点下的_refElm前
}
```