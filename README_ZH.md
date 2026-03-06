[English](README_EN.md) | [中文](README_ZH.md) | [Русский](README.md)

# Analytics DWH Exporter (TypeScript)

这是一个测试项目，用于展示编写强类型、异步和高性能 TypeScript 代码的技能。

脚本 (`analyticsJob.ts`) 作为一个微型 ETL（提取、转换、加载）流水线运行：它从外部 API 下载“订单”，过滤掉无效数据，汇总财务指标，并将最终的数据转储保存为 JSON（模拟为数据仓库，例如 Google BigQuery，准备数据）。

## 脚本的作用是什么？

1. **Extract (提取):** 
   - 使用原生的 `fetch` 对公共模拟 API 执行 HTTP GET 请求。
   - 如果外部 API 不可用（例如，模拟数据已删除），它会无缝切换到备用数据 (`generateFallbackMockData`)，以确保流水线能够无故障完成。

2. **Transform (转换):**
   - 丢弃已取消的订单 (`status === 'CANCELED'`)。
   - 严格按日期过滤订单 — 仅保留相对于脚本执行日期的**上一个日历月**内的购买记录。
   - 计算剩余有效订单的总毛收入（Total Revenue）。
   - 计算平台佣金（在常量中定义，默认为 `15%`）。
   - 按商品类别汇总售出商品的数量（quantity）。

3. **Load (加载):**
   - 异步将汇总的最终分析结果保存到 `analytics_export_bigquery.json` 文件中。
   - 在控制台中打印格式美观的摘要和脚本的执行时间。

## 技术和方法（工作原理）

- **TypeScript (严格模式):** 使用 `interface`、`type`（例如联合类型: `'COMPLETED' | 'CANCELED'`）以及明确返回类型。不使用 `any` 类型。
- **数据转换 (Data Casting):** 安全地将 API 响应转换为所需的接口类型（例如，`await response.json() as Order[]`）。
- **现代异步 Node.js:** 
  - `async/await` 语法。
  - 原生的 `fetch` (Node 18+)。
  - `fs/promises` 模块用于安全、非阻塞的文件系统操作。
- **性能优化:** 对于大型数组，使用 `for...of` 循环进行单次迭代，而不是消耗资源的 `.filter().map().reduce()` 链式调用。
- **性能分析:** 通过 `performance.now()` 测量脚本的执行性能。

## 如何使用

### 1. 要求

您的计算机上需要安装 **Node.js**（建议 18 或更高版本）。

### 2. 安装依赖

在项目文件夹（`analyticsJob.ts` 所在位置）中打开终端，安装必要的类型和工具：

```bash
npm install
```
*(如果您尚未初始化项目，请运行 `npm init -y; npm i --save-dev @types/node tsx typescript`)*

### 3. 运行

可以使用上一步安装的 `tsx` 工具直接执行脚本，无需先将其编译（从 `.ts` 转为 `.js`）：

```bash
npx tsx analyticsJob.ts
```

### 4. 预期结果

运行脚本后，控制台中将显示详细的进度报告：

```
--- STARTING ETL PIPELINE ---
[NETWORK] Fetching orders from https://run.mocky.io/v3/4a29a584-6997-4fa5-9e6e-52ebc605d3c8...
[NETWORK] Fetch error or endpoint is unavailable. Applying fallback mock data...
[ETL] Processing 4 orders...
┌────────────────────────────┬────────┐
│          (index)           │ Values │
├────────────────────────────┼────────┤
│   Processed Valid Orders   │   2    │
│     Total Revenue ($)      │  1880  │
│ Marketplace Commission ($) │  282   │
└────────────────────────────┴────────┘

[INFO] Sales Volume By Category: { Electronics: 1, Accessories: 2, Furniture: 3 }
[SUCCESS] Analytics successfully exported to ./analytics_export_bigquery.json
--- PIPELINE COMPLETED in 12.34ms ---
```

脚本所在目录中将生成一个名为 `analytics_export_bigquery.json` 的文件，其中包含汇总的数据。
