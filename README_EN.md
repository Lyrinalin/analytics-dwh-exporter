[English](README_EN.md) | [中文](README_ZH.md) | [Русский](README.md)

# Analytics DWH Exporter (TypeScript)

This is a test project demonstrating skills in writing strictly typed, asynchronous, and performant TypeScript code.

The script (`analyticsJob.ts`) operates as a mini ETL (Extract, Transform, Load) pipeline: it downloads "orders" from an external API, filters out invalid data, aggregates financial metrics, and saves the final dump into JSON (simulating data preparation for a DWH, e.g., Google BigQuery).

## What does the script do?

1. **Extract:** 
   - Performs an HTTP GET request to a public mock API using native `fetch`.
   - If the external API is unavailable (e.g., the mock is deleted), it seamlessly switches to fallback data (`generateFallbackMockData`) to ensure the pipeline completes without failure.

2. **Transform:**
   - Discards canceled orders (`status === 'CANCELED'`).
   - Filters orders strictly by date — keeping only purchases made in the **previous calendar month** relative to the script's execution date.
   - Calculates total gross revenue (Total Revenue) for the remaining valid orders.
   - Calculates the marketplace commission (defined in constants, default is `15%`).
   - Aggregates the volume of sold items (quantity) by product category.

3. **Load:**
   - Asynchronously saves the final aggregated analytics into the `analytics_export_bigquery.json` file.
   - Prints a beautifully formatted summary and script execution time to the console.

## Technologies & Approaches (How it works)

- **TypeScript (Strict Mode):** Usage of `interface`, `type` (e.g., Union: `'COMPLETED' | 'CANCELED'`), and explicit return types. No `any` types.
- **Data Casting:** Safe casting of API responses to the required interfaces (e.g., `await response.json() as Order[]`).
- **Modern asynchronous Node.js:** 
  - `async/await` syntax.
  - Native `fetch` (Node 18+).
  - `fs/promises` module for safe, non-blocking file system operations.
- **Performance Optimization:** Using the `for...of` loop for a single iteration over a large array rather than resource-heavy `.filter().map().reduce()` chains.
- **Profiling:** Measuring script performance via `performance.now()`.

## How to use

### 1. Requirements

You need **Node.js** (preferably version 18 or higher) installed on your machine.

### 2. Install dependencies

Open a terminal in the project folder (where `analyticsJob.ts` is located) and install the necessary types and tools:

```bash
npm install
```
*(If you haven't initialized the project yet, run `npm init -y; npm i --save-dev @types/node tsx typescript`)*

### 3. Run

The script can be executed without prior compilation (`.ts` to `.js`) using the `tsx` utility installed in the previous step:

```bash
npx tsx analyticsJob.ts
```

### 4. Expected result

After running the script, a detailed progress report will appear in the console:

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

A file named `analytics_export_bigquery.json` will be generated in the script's directory, containing the aggregated data.
