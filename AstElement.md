```JavaScript
declare type ASTElement = {
  type: 1;  // ast类型，1是标签，2是有表达式的文本，3表示纯文本
  tag: string; // 标签名
  attrsList: Array<{ name: string; value: string }>; // 属性数组
  attrsMap: { [key: string]: string | null };  // 属性key-value对象
  parent: ASTElement | void; // 父元素的AST
  children: Array<ASTNode>; // 子元素的AST数组

  static?: boolean;  // 静态元素
  staticRoot?: boolean; // 静态根元素
  staticInFor?: boolean; // 静态内容是否在for循环内
  staticProcessed?: boolean; // 当前元素已经处理过静态内容
  hasBindings?: boolean; // 元素需要动态编译

  text?: string; // 文本内容
  attrs?: Array<{ name: string; value: string }>;  // 属性数组，name是属性名，value是属性值
  props?: Array<{ name: string; value: string }>;  // prop
  plain?: boolean; // 没有属性
  pre?: true;  // 标签上有v-pre指令，标识该元素和子元素不用编译
  ns?: string;  // 标签的命名空间

  component?: string; // component元素的is属性值
  inlineTemplate?: true; // 标签上有inline-template
  transitionMode?: string | null;

  // slot比较复杂，涉及到多个组件。涉及到声明周期的各个部分，涉及到vnode创建的过程，之后会详细说
  slotName?: ?string; // slot元素上name属性的值
  slotTarget?: ?string; // slot属性的值
  slotScope?: ?string; // 用于作用域插槽时template元素上，表示scope值
  scopedSlots?: { [name: string]: ASTElement }; // 添加作用域插槽时template元素父级上 键值对，键是slotTarget，值是当前template元素

  ref?: string; // ref属性
  refInFor?: boolean; // 是否包含在for循环内

  if?: string; // v-if的表达式
  ifProcessed?: boolean; // 标识当前元素已经处理过v-if
  elseif?: string;  // v-else-if的表达式
  else?: true; // v-else时为true
  ifConditions?: ASTIfConditions;  // 与v-if相关的一组元素

  // v-for="(item, index) in items"
  // v-for="(value, key, index) in object"
  for?: string; // 要遍历的数据items
  forProcessed?: boolean; // 标识当前元素已经处理过v-for
  key?: string; // 虚拟dom做diff时候的key，这里如果v-for在自定义元素上，则必须有key
  alias?: string; // 遍历数组时的元素item或遍历对象时的值value
  iterator1?: string; // 遍历数组的索引index或遍历对象时的键key
  iterator2?: string; // 遍历对象时的索引index

  staticClass?: string; // 静态class
  classBinding?: string; // 有数据绑定的class表达式
  staticStyle?: string;  // 静态style
  styleBinding?: string; // 有数据绑定的style表达式
  events?: ASTElementHandlers;  // 没有.native来修饰添加的事件
  nativeEvents?: ASTElementHandlers; // 通过.native来修饰添加的原生事件

  transition?: string | true;
  transitionOnAppear?: boolean;

  model?: {
    value: string;
    callback: string;
    expression: string;
  };

  directives?: Array<ASTDirective>; // 存放普通指令相关信息

  forbidden?: true;  // 为true时表示，该标签是style或包含脚本的script
  once?: true; // v-once
  onceProcessed?: boolean;
  wrapData?: (code: string) => string;

  // weex specific
  appendAsTree?: boolean;
}

```