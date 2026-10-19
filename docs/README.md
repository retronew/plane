# 文档索引

本页汇总仓库内的文档入口。应用、包和部署指南保留在各自目录，具体操作请以对应指南及当前代码、配置为准。

## 开发与测试

- [开发指南](development.md)：环境准备、本地开发、Docker 迁移、构建与隔离测试。
- [Lint 使用说明](linting.md)：检查命令、规则与编辑器集成。
- [API 隔离测试运行指南](../apps/api/tests/RUNNING_TESTS.md)：Docker 测试栈、定向运行与排错。
- [API 测试目录说明](../apps/api/plane/tests/README.md)与[测试编写指南](../apps/api/plane/tests/TESTING_GUIDE.md)：测试分类、约定和 fixtures。
- [贡献指南](../CONTRIBUTING.md)与[Agent 开发指南](../AGENTS.md)。

## 功能专项

- [项目工作项、类型、工作流与层级](project-work-items.md)。
- [项目工作流、审批与 Runner](project-workflows.md)。
- [项目与工作区视图](workspace-views.md)。
- [工作区周期](workspace-cycles.md)。
- [工作区分析与图表](analytics.md)。
- [分析图表口径与修复记录](analytics-chart-audit.md)：带日期的专项记录。
- [Webhooks](webhooks.md)。

## 应用与包

- [Space 应用](../apps/space/README.md)。
- [Workflow Runner](../apps/workflow-runner/README.md)。
- [API Django 5.2 迁移计划](../apps/api/docs/django-5.2-migration-plan.md)。
- [API 导出工具](../apps/api/plane/utils/exporters/README.md)与[OpenAPI 工具](../apps/api/plane/utils/openapi/README.md)。
- [Editor](../packages/editor/Readme.md)、[Decorators](../packages/decorators/README.md)、[Logger](../packages/logger/README.md)。
- [Codemods 使用说明](../packages/codemods/instructions.md)。

## 部署

- [社区版 CLI 部署](../deployments/cli/community/README.md)。
- [社区版 Kubernetes 部署](../deployments/kubernetes/community/README.md)。
- [社区版 All-in-One 部署](../deployments/aio/community/README.md)。

## 历史归档

[归档索引](archive/README.md)收录 Lint / Doctor 报告、诊断 JSON 和本地与云端功能差异研究。归档内容为历史快照，不代表当前扫描结果或当前功能状态。
