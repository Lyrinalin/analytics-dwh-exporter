import { writeFile } from 'fs/promises';

// --- [ 1. Типы и Интерфейсы ] ---

// Статусы заказа. Строгая типизация через union type.
export type OrderStatus = 'COMPLETED' | 'CANCELED' | 'PROCESSING' | 'SHIPPED';

export interface OrderItem {
  productId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  createdAt: string; // Ожидается дата в формате ISO 8601
  status: OrderStatus;
  items: OrderItem[];
}

export interface SalesByCategory {
  [category: string]: number; // Хранит суммарное количество проданных товаров в категории
}

export interface AnalyticsResult {
  reportDate: string;
  period: { start: string; end: string };
  totalRevenue: number;         // Общая выручка (до вычета комиссии)
  marketplaceCommission: number;// Комиссия маркетплейса
  salesByCategory: SalesByCategory; 
  processedOrdersCount: number; // Количество учтенных валидных заказов
}

// --- [ 2. Конфигурация и Константы ] ---

// Публичный мок-API. В реальности здесь endpoint, возвращающий массив заказов.
const API_URL = 'https://run.mocky.io/v3/4a29a584-6997-4fa5-9e6e-52ebc605d3c8'; 
const COMMISSION_RATE = 0.15; // Фиксированный процент комиссии (15%)
const EXPORT_FILE_PATH = './analytics_export_bigquery.json';

// --- [ 3. Работа с сетью (Асинхронные HTTP-запросы) ] ---

/**
 * Асинхронно получает массив заказов с API.
 * Используем fetch (доступен нативно в Node.js 18+).
 */
async function fetchOrders(): Promise<Order[]> {
    try {
        console.log(`[NETWORK] Fetching orders from ${API_URL}...`);
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Маппим ответ в наш строго типизированный интерфейс
        return await response.json() as Order[];
    } catch (error) {
        console.warn('[NETWORK] Fetch error or endpoint is unavailable. Applying fallback mock data...');
        // Фолбек-данные для демонстрации логики, если публичный mocky-URL устареет
        return generateFallbackMockData(); 
    }
}

// --- [ 4. Алгоритмическая обработка данных и Бизнес-логика ] ---

/**
 * Основная функция обработки массива заказов.
 * Извлекает аналитические метрики, фильтруя отмененные и старые заказы.
 */
function processOrders(orders: Order[]): AnalyticsResult {
    const now = new Date();
    
    // Вычисляем границы "последнего (предыдущего календарного) месяца"
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    let totalRevenue = 0;
    const salesByCategory: Record<string, number> = {};
    let processedOrdersCount = 0;

    // Используем цикл for...of для читаемости сложных пайплайнов
    for (const order of orders) {
        // 1. Фильтруем отмененные заказы (бизнес-логика)
        if (order.status === 'CANCELED') {
            continue;
        }

        // 2. Фильтруем заказы строго за последний месяц
        const orderDate = new Date(order.createdAt);
        if (orderDate < startOfLastMonth || orderDate > endOfLastMonth) {
            continue; 
        }

        processedOrdersCount++;

        // 3. Рассчитываем выручку и группируем товары по категориям
        for (const item of order.items) {
            const itemTotalRevenue = item.price * item.quantity;
            totalRevenue += itemTotalRevenue;

            // Группировка: инкрементируем счетчик проданных единиц в категории
            salesByCategory[item.category] = (salesByCategory[item.category] || 0) + item.quantity;
        }
    }

    const marketplaceCommission = totalRevenue * COMMISSION_RATE;

    // Возвращаем строго типизированный объект результата
    return {
        reportDate: now.toISOString(),
        period: {
            start: startOfLastMonth.toISOString(),
            end: endOfLastMonth.toISOString(),
        },
        totalRevenue: Number(totalRevenue.toFixed(2)),
        marketplaceCommission: Number(marketplaceCommission.toFixed(2)),
        salesByCategory,
        processedOrdersCount
    };
}

// --- [ 5. Работа с файловой системой (Подготовка данных) ] ---

/**
 * Асинхронно сохраняет результат аналитики в локальный JSON.
 * Имитация конечной точки ETL-процесса (например, дампа перед отправкой в BigQuery).
 */
async function exportToLocalJSON(data: AnalyticsResult, filepath: string): Promise<void> {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        await writeFile(filepath, jsonString, 'utf-8');
        console.log(`[SUCCESS] Analytics successfully exported to ${filepath}`);
    } catch (error) {
        console.error('[ERROR] Failed to export data:', error);
        throw error;
    }
}

// --- [ 6. Оркестрация (Entry point) ] ---

async function main() {
    console.log('--- STARTING ETL PIPELINE ---');
    const startTime = performance.now();
    
    // 1. EXTRACT
    const orders = await fetchOrders();

    // 2. TRANSFORM
    console.log(`[ETL] Processing ${orders.length} orders...`);
    const analyticsResult = processOrders(orders);

    // Вывод аналитической сводки
    console.table({
        'Processed Valid Orders': analyticsResult.processedOrdersCount,
        'Total Revenue ($)': analyticsResult.totalRevenue,
        'Marketplace Commission ($)': analyticsResult.marketplaceCommission,
    });
    console.log('\n[INFO] Sales Volume By Category:', analyticsResult.salesByCategory);

    // 3. LOAD
    await exportToLocalJSON(analyticsResult, EXPORT_FILE_PATH);
    
    const timeTaken = (performance.now() - startTime).toFixed(2);
    console.log(`--- PIPELINE COMPLETED in ${timeTaken}ms ---`);
}

// --- Вспомогательные данные ---

function generateFallbackMockData(): Order[] {
    const today = new Date();
    // Искусственно ставим дату на "прошлый месяц", чтобы заказы прошли фильтр по дате
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString();
    const oldMonth = new Date(today.getFullYear(), today.getMonth() - 3, 10).toISOString();
    
    return [
        {
            id: 'ORD-001', userId: 'U-123', createdAt: lastMonth, status: 'COMPLETED',
            items: [
                { productId: 'P-1', name: 'Laptop Pro', category: 'Electronics', price: 1200, quantity: 1 },
                { productId: 'P-2', name: 'Wireless Mouse', category: 'Accessories', price: 40, quantity: 2 }
            ]
        },
        {
            id: 'ORD-002', userId: 'U-456', createdAt: lastMonth, status: 'CANCELED', // Будет отфильтрован
            items: [
                { productId: 'P-3', name: 'Headphones', category: 'Electronics', price: 150, quantity: 1 }
            ] 
        },
        {
            id: 'ORD-003', userId: 'U-789', createdAt: lastMonth, status: 'SHIPPED',
            items: [
                { productId: 'P-4', name: 'Ergonomic Desk', category: 'Furniture', price: 300, quantity: 1 },
                { productId: 'P-5', name: 'Office Chair', category: 'Furniture', price: 150, quantity: 2 }
            ]
        },
        {
            id: 'ORD-004', userId: 'U-012', createdAt: oldMonth, status: 'COMPLETED', // Старый заказ (будет отфильтрован)
            items: [
                { productId: 'P-1', name: 'Laptop Pro', category: 'Electronics', price: 1200, quantity: 1 }
            ]
        }
    ];
}

// Запуск
main().catch(err => {
    console.error('Fatal pipeline error:', err);
    process.exit(1);
});
