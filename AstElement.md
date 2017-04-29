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
  staticInFor?: boolean;
  staticProcessed?: boolean;
  hasBindings?: boolean; // 元素需要动态编译

  text?: string;
  attrs?: Array<{ name: string; value: string }>;  // 属性数组，name是属性名，value是属性值
  props?: Array<{ name: string; value: string }>;  // prop
  plain?: boolean; // 没有属性
  pre?: true;  // 标签上有v-pre指令，标识该元素和子元素不用编译
  ns?: string;  // 标签的命名空间

  component?: string;
  inlineTemplate?: true; // 标签上有inline-template
  transitionMode?: string | null;
  slotName?: ?string; // slot名称
  slotTarget?: ?string;
  slotScope?: ?string;
  scopedSlots?: { [name: string]: ASTElement };

  ref?: string; // ref属性
  refInFor?: boolean; // 是否包含在for循环内

  if?: string; // v-if的表达式
  ifProcessed?: boolean;
  elseif?: string;  // v-else-if的表达式
  else?: true;
  ifConditions?: ASTIfConditions;  // 与if表达式一致的标签AST数组

  // v-for="(item, index) in items"
  // v-for="(value, key, index) in object"
  for?: string; // 要遍历的数据items
  forProcessed?: boolean;
  key?: string;
  alias?: string; // 遍历数组时的元素item或遍历对象时的值value
  iterator1?: string; // 遍历数组的索引index或遍历对象时的键key
  iterator2?: string; // 遍历对象时的索引index

  staticClass?: string;
  classBinding?: string;
  staticStyle?: string;
  styleBinding?: string;
  events?: ASTElementHandlers;
  nativeEvents?: ASTElementHandlers;

  transition?: string | true;
  transitionOnAppear?: boolean;

  model?: {
    value: string;
    callback: string;
    expression: string;
  };

  directives?: Array<ASTDirective>;

  forbidden?: true;  // 为true时表示，该标签是style或包含脚本的script
  once?: true; // v-once
  onceProcessed?: boolean;
  wrapData?: (code: string) => string;

  // weex specific
  appendAsTree?: boolean;
}

```