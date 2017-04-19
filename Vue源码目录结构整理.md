vue源码根目录下有很多文件夹，下面先列出我知道的几个，后续会补充。

Vue

&nbsp;&nbsp;&nbsp;&nbsp;|--  build  打包相关的配置文件，其中最重要的是config.js。主要是根据不同的入口，打包为不同的文件。

&nbsp;&nbsp;&nbsp;&nbsp;|--  dist 打包之后文件所在位置

&nbsp;&nbsp;&nbsp;&nbsp;|--  examples 部分示例

&nbsp;&nbsp;&nbsp;&nbsp;|--  flow 因为Vue使用了[Flow](https://flow.org/)来进行静态类型检查，这里定义了声明了一些静态类型

&nbsp;&nbsp;&nbsp;&nbsp;|--  packages vue还可以分别生成其它的npm包

&nbsp;&nbsp;&nbsp;&nbsp;|--  src 主要源码所在位置

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- compiler 模板辨析解析的相关文件

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- core 核心代码

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- components 全局的组件，这里只有keep-alive

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- global-api 全局方法，也就是添加在Vue对象上的方法，比如Vue.use,Vue.extend,,Vue.mixin等

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- instance 实例相关内容，包括实例方法，生命周期，事件等

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- observer 双向数据绑定相关文件

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- util 工具方法

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- vdom 虚拟dom相关

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- entries 入口文件，也就是build文件夹下config.js中配置的入口文件。看源码可以从这里看起

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- platforms 平台相关的内容，分为web和weex

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- server 服务端渲染相关

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- sfc 暂时未知

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|-- shared 共享的工具方法

&nbsp;&nbsp;&nbsp;&nbsp;|-- test 测试用例
