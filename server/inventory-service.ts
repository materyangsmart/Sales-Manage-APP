/**
 * RC4 Epic 1: 智能仓储与防超卖风控服务
 * 
 * 核心机制：使用 MySQL 行级锁（SELECT ... FOR UPDATE）实现原子库存预扣减
 * 在无 Redis 环境下，通过数据库事务保证高并发场景的库存一致性
 */

import { getDb } from './db';
import { inventory, inventoryLog } from '../drizzle/schema';
import { eq, sql, and, lte } from 'drizzle-orm';

// ============================================================
// 库存预扣减（防超卖核心）
// ============================================================

export interface ReserveItem {
  productId: number;
  quantity: number;
}

export interface ReserveResult {
  success: boolean;
  message: string;
  reservedItems?: Array<{ productId: number; quantity: number; remainingStock: number }>;
  failedItems?: Array<{ productId: number; quantity: number; availableStock: number; reason: string }>;
}

/**
 * 原子库存预扣减（使用 MySQL 行级锁防超卖）
 * 
 * 流程：
 * 1. 开启事务
 * 2. SELECT ... FOR UPDATE 锁定库存行
 * 3. 检查可用库存 >= 需求量
 * 4. 原子更新 reserved_stock 和 available_stock
 * 5. 写入出入库流水
 * 6. 提交事务
 * 
 * 如果任一商品库存不足，整个事务回滚，不会部分扣减
 */
export async function reserveInventory(
  items: ReserveItem[],
  orderId?: number,
  operatorId?: number,
  operatorName?: string,
): Promise<ReserveResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, message: '数据库不可用' };
  }

  // 使用原始 SQL 事务（Drizzle MySQL 不直接支持 FOR UPDATE + transaction 组合）
  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.createConnection(process.env.DATABASE_URL!);

  try {
    await conn.beginTransaction();
    console.log(`[Inventory] BEGIN TRANSACTION - reserveInventory for ${items.length} items`);

    const reservedItems: Array<{ productId: number; quantity: number; remainingStock: number }> = [];
    const failedItems: Array<{ productId: number; quantity: number; availableStock: number; reason: string }> = [];

    for (const item of items) {
      // Step 1: SELECT FOR UPDATE（行级锁）- 包含 ATP 字段
      const lockSQL = `SELECT id, product_id, product_name, total_stock, reserved_stock, available_stock,
                              pending_delivery, locked_capacity, daily_idle_capacity
                        FROM inventory 
                        WHERE product_id = ? 
                        FOR UPDATE`;
      console.log(`[Inventory] SQL: ${lockSQL} [${item.productId}]`);
      const [rows] = await conn.query(lockSQL, [item.productId]) as any;

      if (!rows || rows.length === 0) {
        failedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          availableStock: 0,
          reason: `商品 ${item.productId} 不在库存系统中`,
        });
        await conn.rollback();
        console.log(`[Inventory] ROLLBACK - product ${item.productId} not found in inventory`);
        return {
          success: false,
          message: `库存不足：商品 ${item.productId} 不在库存系统中`,
          failedItems,
        };
      }

      const inv = rows[0];
      // RC5: ATP 可承诺量计算
      // ATP = 物理库存 + 剩余闲置产能 - 待交付量 - 锁定配额
      const physicalStock = inv.total_stock;
      const idleCapacity = inv.daily_idle_capacity || 0;
      const pendingDelivery = inv.pending_delivery || 0;
      const lockedCapacity = inv.locked_capacity || 0;
      const atp = physicalStock + idleCapacity - pendingDelivery - lockedCapacity;
      const currentAvailable = Math.max(0, atp - inv.reserved_stock); // 还要减去已预扣减的

      console.log(`[Inventory] ATP计算: 物理库存=${physicalStock} + 闲置产能=${idleCapacity} - 待交付=${pendingDelivery} - 锁定配额=${lockedCapacity} = ATP:${atp}, 已预扣=${inv.reserved_stock}, 可承诺=${currentAvailable}`);

      // Step 2: 检查 ATP 可承诺量
      if (currentAvailable < item.quantity) {
        failedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          availableStock: currentAvailable,
          reason: `ATP不足：${inv.product_name} 可承诺量 ${currentAvailable}，需要 ${item.quantity} (ATP=${atp}, 物理库存=${physicalStock}, 闲置产能=${idleCapacity}, 待交付=${pendingDelivery}, 锁定配额=${lockedCapacity})`,
        });
        await conn.rollback();
        console.log(`[Inventory] ROLLBACK - insufficient ATP for product ${item.productId}: atp=${atp}, available=${currentAvailable}, needed=${item.quantity}`);
        return {
          success: false,
          message: `ATP不足：${inv.product_name} 可承诺量 ${currentAvailable}，需要 ${item.quantity}`,
          failedItems,
        };
      }

      // Step 3: 原子更新库存（预扣减）
      const newReserved = inv.reserved_stock + item.quantity;
      const newAvailable = currentAvailable - item.quantity;
      const updateSQL = `UPDATE inventory 
                          SET reserved_stock = ?, available_stock = ?, updated_at = NOW() 
                          WHERE id = ? AND available_stock >= ?`;
      console.log(`[Inventory] SQL: UPDATE inventory SET reserved_stock=${newReserved}, available_stock=${newAvailable} WHERE id=${inv.id}`);
      const [updateResult] = await conn.query(updateSQL, [newReserved, newAvailable, inv.id, item.quantity]) as any;

      if (updateResult.affectedRows === 0) {
        // 并发冲突：另一个事务已经修改了库存
        await conn.rollback();
        console.log(`[Inventory] ROLLBACK - concurrent conflict for product ${item.productId}`);
        return {
          success: false,
          message: `并发冲突：商品 ${inv.product_name} 库存已被其他订单占用，请重试`,
          failedItems: [{ productId: item.productId, quantity: item.quantity, availableStock: 0, reason: '并发冲突' }],
        };
      }

      // Step 4: 写入出入库流水
      const logSQL = `INSERT INTO inventory_log (inventory_id, product_id, type, quantity, before_stock, after_stock, order_id, operator_id, operator_name, remark) 
                       VALUES (?, ?, 'RESERVE', ?, ?, ?, ?, ?, ?, ?)`;
      await conn.query(logSQL, [
        inv.id, item.productId, -item.quantity,
        currentAvailable, newAvailable,
        orderId || null, operatorId || null, operatorName || null,
        `订单预扣减：${item.quantity} ${inv.unit || '包'}`,
      ]);

      reservedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        remainingStock: newAvailable,
      });
    }

    // Step 5: 提交事务
    await conn.commit();
    console.log(`[Inventory] COMMIT - successfully reserved ${reservedItems.length} items`);

    return {
      success: true,
      message: `库存预扣减成功，共 ${reservedItems.length} 个商品`,
      reservedItems,
    };
  } catch (error: any) {
    await conn.rollback();
    console.error(`[Inventory] ROLLBACK - error: ${error.message}`);
    return {
      success: false,
      message: `库存操作失败：${error.message}`,
    };
  } finally {
    await conn.end();
  }
}

/**
 * 释放库存预扣减（订单取消/拒绝时调用）
 */
export async function releaseInventory(
  items: ReserveItem[],
  orderId?: number,
  operatorName?: string,
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: '数据库不可用' };

  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.createConnection(process.env.DATABASE_URL!);

  try {
    await conn.beginTransaction();

    for (const item of items) {
      const [rows] = await conn.query(
        'SELECT id, reserved_stock, available_stock FROM inventory WHERE product_id = ? FOR UPDATE',
        [item.productId]
      ) as any;

      if (rows.length === 0) continue;
      const inv = rows[0];

      const newReserved = Math.max(0, inv.reserved_stock - item.quantity);
      const newAvailable = inv.available_stock + item.quantity;

      await conn.query(
        'UPDATE inventory SET reserved_stock = ?, available_stock = ? WHERE id = ?',
        [newReserved, newAvailable, inv.id]
      );

      await conn.query(
        `INSERT INTO inventory_log (inventory_id, product_id, type, quantity, before_stock, after_stock, order_id, operator_name, remark) 
         VALUES (?, ?, 'RELEASE', ?, ?, ?, ?, ?, ?)`,
        [inv.id, item.productId, item.quantity, inv.available_stock, newAvailable, orderId || null, operatorName || null, '订单取消/拒绝，释放预扣减']
      );
    }

    await conn.commit();
    return { success: true, message: '库存释放成功' };
  } catch (error: any) {
    await conn.rollback();
    return { success: false, message: error.message };
  } finally {
    await conn.end();
  }
}

// ============================================================
// 库存查询
// ============================================================

export interface ATPInventoryItem {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  unit: string;
  warehouseCode: string;
  physicalStock: number;      // 物理库存
  reservedStock: number;      // 预扣减锁定
  pendingDelivery: number;    // 待交付量
  lockedCapacity: number;     // 锁定配额
  dailyIdleCapacity: number;  // 剩余闲置产能
  atp: number;                // ATP 可承诺量
  lowStockThreshold: number;
  isLowStock: boolean;
  isATPCritical: boolean;     // ATP < 低库存阈值
}

export async function getInventoryList(filters?: { lowStockOnly?: boolean; warehouseCode?: string }): Promise<ATPInventoryItem[]> {
  const db = await getDb();
  if (!db) return [];

  const items = await db.select().from(inventory).orderBy(inventory.productId);
  
  const atpItems: ATPInventoryItem[] = items.map((i: any) => {
    const physicalStock = i.totalStock;
    const idleCapacity = i.dailyIdleCapacity || 0;
    const pendingDelivery = i.pendingDelivery || 0;
    const lockedCapacity = i.lockedCapacity || 0;
    const atp = physicalStock + idleCapacity - pendingDelivery - lockedCapacity;
    
    return {
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      unit: i.unit,
      warehouseCode: i.warehouseCode,
      physicalStock,
      reservedStock: i.reservedStock,
      pendingDelivery,
      lockedCapacity,
      dailyIdleCapacity: idleCapacity,
      atp,
      lowStockThreshold: i.lowStockThreshold,
      isLowStock: i.availableStock <= i.lowStockThreshold,
      isATPCritical: atp <= i.lowStockThreshold,
    };
  });

  if (filters?.lowStockOnly) {
    return atpItems.filter(i => i.isATPCritical || i.isLowStock);
  }

  return atpItems;
}

/** 更新 ATP 相关字段（待交付量、锁定配额、闲置产能） */
export async function updateATPFields(
  productId: number,
  fields: { pendingDelivery?: number; lockedCapacity?: number; dailyIdleCapacity?: number },
  operatorName?: string,
): Promise<{ success: boolean; message: string }> {
  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.createConnection(process.env.DATABASE_URL!);
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    if (fields.pendingDelivery !== undefined) {
      setClauses.push('pending_delivery = ?');
      values.push(fields.pendingDelivery);
    }
    if (fields.lockedCapacity !== undefined) {
      setClauses.push('locked_capacity = ?');
      values.push(fields.lockedCapacity);
    }
    if (fields.dailyIdleCapacity !== undefined) {
      setClauses.push('daily_idle_capacity = ?');
      values.push(fields.dailyIdleCapacity);
    }
    if (setClauses.length === 0) return { success: false, message: '未指定更新字段' };
    
    setClauses.push('updated_at = NOW()');
    values.push(productId);
    
    await conn.query(`UPDATE inventory SET ${setClauses.join(', ')} WHERE product_id = ?`, values);
    console.log(`[Inventory] ATP字段更新: productId=${productId}, fields=${JSON.stringify(fields)}, operator=${operatorName}`);
    return { success: true, message: 'ATP参数更新成功' };
  } catch (error: any) {
    return { success: false, message: error.message };
  } finally {
    await conn.end();
  }
}

export async function getInventoryLogs(productId?: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  if (productId) {
    return db.select().from(inventoryLog)
      .where(eq(inventoryLog.productId, productId))
      .orderBy(sql`${inventoryLog.createdAt} DESC`)
      .limit(limit);
  }

  return db.select().from(inventoryLog)
    .orderBy(sql`${inventoryLog.createdAt} DESC`)
    .limit(limit);
}

/**
 * 手动调整库存（入库/出库/盘点调整）
 */
export async function adjustInventory(
  productId: number,
  adjustType: 'INBOUND' | 'OUTBOUND' | 'ADJUST',
  quantity: number,
  operatorId?: number,
  operatorName?: string,
  remark?: string,
  batchNo?: string,
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: '数据库不可用' };

  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.createConnection(process.env.DATABASE_URL!);

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, total_stock, reserved_stock, available_stock FROM inventory WHERE product_id = ? FOR UPDATE',
      [productId]
    ) as any;

    if (rows.length === 0) {
      await conn.rollback();
      return { success: false, message: '商品不在库存系统中' };
    }

    const inv = rows[0];
    let newTotal = inv.total_stock;
    let newAvailable = inv.available_stock;

    if (adjustType === 'INBOUND') {
      newTotal += quantity;
      newAvailable += quantity;
    } else if (adjustType === 'OUTBOUND') {
      if (newAvailable < quantity) {
        await conn.rollback();
        return { success: false, message: `可用库存不足：当前 ${newAvailable}，需出库 ${quantity}` };
      }
      newTotal -= quantity;
      newAvailable -= quantity;
    } else {
      // ADJUST: 直接设置总库存
      newTotal = quantity;
      newAvailable = quantity - inv.reserved_stock;
    }

    await conn.query(
      'UPDATE inventory SET total_stock = ?, available_stock = ? WHERE id = ?',
      [newTotal, newAvailable, inv.id]
    );

    const logQty = adjustType === 'OUTBOUND' ? -quantity : quantity;
    await conn.query(
      `INSERT INTO inventory_log (inventory_id, product_id, type, quantity, before_stock, after_stock, order_id, batch_no, operator_id, operator_name, remark) 
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      [inv.id, productId, adjustType, logQty, inv.available_stock, newAvailable, batchNo || null, operatorId || null, operatorName || null, remark || `${adjustType} 操作`]
    );

    await conn.commit();
    return { success: true, message: `库存${adjustType === 'INBOUND' ? '入库' : adjustType === 'OUTBOUND' ? '出库' : '调整'}成功` };
  } catch (error: any) {
    await conn.rollback();
    return { success: false, message: error.message };
  } finally {
    await conn.end();
  }
}
