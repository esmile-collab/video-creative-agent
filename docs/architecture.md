# 模块协作架构：依据与维护

核对日期：2026-11-07。代码 / 文档基线：`635d3c13ac9ebb80263849bc06959b55b6fb95d4`。

## 图源与读法

`architecture.svg` 是可编辑图源，README 直接展示；英文版本存在时同步维护。图片无动画、脚本、外部字体或图片依赖。
图中只保留模块名与连线。实线表示模块协作，包含调用、读写与评测依赖；双向箭头包含结果返回。虚线表示人工迭代。模块职责、接口数据与实现边界见下表。
图按当前职责分组，保留实际依赖与直接访问路径。

## 模块与协作依据

| 模块 | 对应文件 | 接口与边界 |
| --- | --- | --- |
| 运行编排 | [scripts/run-demo.mjs](../scripts/run-demo.mjs) | 读取输入，依次调用策略、Provider、分镜与评测函数；由编排层归档请求、脚本、分镜和报告。各能力通过返回值交换数据。 |
| 策略与编译 | [core/strategy/compiler.mjs](../core/strategy/compiler.mjs) | retriever 先返回策略选择结果；compiler 结合 Brief、基础规则与输出约束生成 compiledRequest，不直接调用模型。 |
| 模型适配 | [core/providers/openai-compatible.mjs](../core/providers/openai-compatible.mjs) | generateScript(compiledRequest) 返回 content / usage；默认 Demo 显式创建 Mock，兼容适配器需要显式接入。 |
| 分镜引擎 | [core/storyboard/pipeline.mjs](../core/storyboard/pipeline.mjs) | buildStoryboard(approvedScript) 返回 storyboard / validation；负责切分、时间预算、画面规划和结构校验。 |
| 分镜评测 | [core/evaluation/storyboard-eval.mjs](../core/evaluation/storyboard-eval.mjs) | evaluateStoryboard 接收分镜、原脚本和可选参考切点；复用分镜模块的 validateStoryboard，返回评测报告。保留这一已有依赖。 |
| 回归用例 | [tests/evaluation.test.mjs](../tests/evaluation.test.mjs) | 用例调用评测能力并断言结果。报告中的问题由维护者复现后，修改输入、规则或用例并重跑。 |

## 随代码维护

模块职责、调用方、输入输出、共享校验、持久化或回流方式变化时，在同一提交中更新 SVG、README 和本文。不要将人工操作写成自动模块，也不要删除仍然存在的耦合关系。
图片仅显示简短模块名。使用细框线和充分间距，保持简洁图例；具体职责、接口、路径与限制维护在本文。
提交前检查 XML 解析、文字边界、连线与节点、README 引用以及静态资源大小。代码行为没有变化时无需为图增加运行依赖。
