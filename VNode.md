```JavaScript
VNode: {
	tag: string | void; // 标签名
	data: VNodeData | void;  // 结点相关属性数据
	children: ?Array<VNode>; // 子节点
	text: string | void;  // 文本
	elm: Node | void;  // dom元素 
	ns: string | void;  // 命名空间
	context: Component | void; // VNode所处Vue对象
	functionalContext: Component | void; // only for functional component root nodes
	key: string | number | void; 
	componentOptions: VNodeComponentOptions | void; // VNode对象如果对应的是一个自定义组件，componentOptions保存组件相关事件、props数据等
	componentInstance: Component | void; // VNode对象如果对应的是一个自定义组件，componentInstance保存相对应的vue实例
	parent: VNode | void; // 当前自定义组件在父组件中的vnode
	raw: boolean; // contains raw HTML? (server only)
	isStatic: boolean; // 是否是静态内容
	isRootInsert: boolean; // necessary for enter transition check
	isComment: boolean; // empty comment placeholder?
	isCloned: boolean; // 是否是clone的VNode对象
	isOnce: boolean; // 是否是v-once元素的VNode对象
}
```