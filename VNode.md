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
	componentOptions: VNodeComponentOptions | void;
	componentInstance: Component | void; // component instance
	parent: VNode | void; // component placeholder node
	raw: boolean; // contains raw HTML? (server only)
	isStatic: boolean; // hoisted static node
	isRootInsert: boolean; // necessary for enter transition check
	isComment: boolean; // empty comment placeholder?
	isCloned: boolean; // is a cloned node?
	isOnce: boolean; // is a v-once node?
}
```