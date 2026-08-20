---
name: self-heal
description: >-
  Automatically diagnose and fix AiHub verify/lint/typecheck/test failures in
  up to 3 rounds. Use when make verify, lint, typecheck, or vitest fails, or
  when the user asks to self-heal / auto-fix CI or local checks.
---

# Self-Heal

## 触发条件

- `make verify` / `make verify-full` / `make lint` / `make typecheck` / `make test-critical` / `make test-full` 失败
- 用户明确要求自动修复检查失败
- 实现改动后本地门禁报错

## 修复流程（最多 3 轮）

1. **收集**：完整命令、exit code、相关 stderr/stdout；定位到文件与规则 ID。
2. **分类**：按下表归类；若属于「需确认 / 阻塞」，停止自动改代码并输出阻塞报告。
3. **最小修复**：只改导致失败的最小集合；禁止顺手重构。
4. **重跑**：只重跑失败的那一类 target（或 `make verify`）；仍失败则进入下一轮。
5. **三轮用尽**：输出阻塞报告，停止；不再扩大修复面。

## 错误分类策略表

| 类别 | 典型信号 | 策略 |
|------|----------|------|
| 格式 / Lint | eslint 规则、未使用变量 | 按规则自动修；冲突则问用户 |
| 类型错误 | `tsc` / `vue-tsc` 报错 | 补类型或收窄；不随意 `any` 逃逸除非用户允许 |
| 测试断言 | vitest assertion | 先分辨是产品 bug 还是过时测试；行为歧义则确认 |
| 缺依赖 / 脚本 | command not found、npm script 缺失 | 报告缺口；不擅自加重大依赖 |
| 架构违规 | 前端碰 DB、Express、并行评测 | 回退违规实现；按约束重做 |
| 环境 / 部署 | DB_PATH、端口 8082、原生模块编译 | 视为阻塞：说明环境需求，不在 2G2C 假设下强行重型安装 |
| 领域歧义 | 需求多种解释 | **立即停止**，向用户确认 |

## 阻塞报告格式

```markdown
## Self-Heal 阻塞报告

- **失败命令**：
- **轮次**：n/3
- **错误分类**：
- **关键日志摘要**：（≤20 行）
- **已尝试修复**：
- **阻塞原因**：
- **需要用户决定**：
- **建议下一步**：
```
