-- ============================================
-- 数据库性能优化索引脚本
-- 目标：确保百万级数据查询性能 <2s
-- ============================================

-- 1. Orders表索引优化
-- 用途：订单列表查询、按客户查询、按日期范围查询

-- 检查并创建customer_id索引
SELECT CONCAT('Creating index on orders.customer_id...') AS status;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- 检查并创建order_date索引
SELECT CONCAT('Creating index on orders.order_date...') AS status;
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);

-- 检查并创建status索引（用于按状态过滤）
SELECT CONCAT('Creating index on orders.status...') AS status;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 检查并创建batch_no索引（用于追溯查询）
SELECT CONCAT('Creating index on orders.batch_no...') AS status;
CREATE INDEX IF NOT EXISTS idx_orders_batch_no ON orders(batch_no);

-- 复合索引：org_id + order_date（用于组织内按日期查询）
SELECT CONCAT('Creating composite index on orders(org_id, order_date)...') AS status;
CREATE INDEX IF NOT EXISTS idx_orders_org_date ON orders(org_id, order_date);

-- 复合索引：customer_id + order_date（用于客户订单历史查询）
SELECT CONCAT('Creating composite index on orders(customer_id, order_date)...') AS status;
CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders(customer_id, order_date);

-- 2. AR Payments表索引优化
-- 用途：回款记录查询、按订单查询、按银行流水号查询

-- 检查并创建order_id索引
SELECT CONCAT('Creating index on ar_payments.order_id...') AS status;
CREATE INDEX IF NOT EXISTS idx_ar_payments_order_id ON ar_payments(order_id);

-- 检查并创建payment_date索引
SELECT CONCAT('Creating index on ar_payments.payment_date...') AS status;
CREATE INDEX IF NOT EXISTS idx_ar_payments_payment_date ON ar_payments(payment_date);

-- 检查并创建bank_ref索引（银行流水号，用于对账）
SELECT CONCAT('Creating index on ar_payments.bank_ref...') AS status;
CREATE INDEX IF NOT EXISTS idx_ar_payments_bank_ref ON ar_payments(bank_ref);

-- 3. AR Invoices表索引优化
-- 用途：发票查询、按订单查询、按开票日期查询

-- 检查并创建order_id索引
SELECT CONCAT('Creating index on ar_invoices.order_id...') AS status;
CREATE INDEX IF NOT EXISTS idx_ar_invoices_order_id ON ar_invoices(order_id);

-- 检查并创建invoice_date索引
SELECT CONCAT('Creating index on ar_invoices.invoice_date...') AS status;
CREATE INDEX IF NOT EXISTS idx_ar_invoices_invoice_date ON ar_invoices(invoice_date);

-- 检查并创建invoice_no索引（发票号，用于查询）
SELECT CONCAT('Creating index on ar_invoices.invoice_no...') AS status;
CREATE INDEX IF NOT EXISTS idx_ar_invoices_invoice_no ON ar_invoices(invoice_no);

-- 4. Customers表索引优化
-- 用途：客户列表查询、按类型查询

-- 检查并创建category索引
SELECT CONCAT('Creating index on customers.category...') AS status;
CREATE INDEX IF NOT EXISTS idx_customers_category ON customers(category);

-- 检查并创建created_at索引（用于新客户统计）
SELECT CONCAT('Creating index on customers.created_at...') AS status;
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- 复合索引：org_id + category（用于组织内按类型查询）
SELECT CONCAT('Creating composite index on customers(org_id, category)...') AS status;
CREATE INDEX IF NOT EXISTS idx_customers_org_category ON customers(org_id, category);

-- 5. Order Items表索引优化
-- 用途：订单明细查询、产品销量统计

-- 检查并创建order_id索引
SELECT CONCAT('Creating index on order_items.order_id...') AS status;
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 检查并创建product_id索引
SELECT CONCAT('Creating index on order_items.product_id...') AS status;
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- 6. Commission Rules表索引优化
-- 用途：提成规则查询

-- 检查并创建version索引
SELECT CONCAT('Creating index on sales_commission_rules.version...') AS status;
CREATE INDEX IF NOT EXISTS idx_commission_rules_version ON sales_commission_rules(version);

-- 检查并创建effective_from索引
SELECT CONCAT('Creating index on sales_commission_rules.effective_from...') AS status;
CREATE INDEX IF NOT EXISTS idx_commission_rules_effective_from ON sales_commission_rules(effective_from);

-- 7. 显示所有索引信息
SELECT CONCAT('Index creation completed. Showing all indexes...') AS status;

SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS,
    INDEX_TYPE,
    NON_UNIQUE
FROM 
    INFORMATION_SCHEMA.STATISTICS
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('orders', 'ar_payments', 'ar_invoices', 'customers', 'order_items', 'sales_commission_rules')
GROUP BY 
    TABLE_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE
ORDER BY 
    TABLE_NAME, INDEX_NAME;

-- 8. 分析表以更新统计信息
SELECT CONCAT('Analyzing tables to update statistics...') AS status;
ANALYZE TABLE orders;
ANALYZE TABLE ar_payments;
ANALYZE TABLE ar_invoices;
ANALYZE TABLE customers;
ANALYZE TABLE order_items;
ANALYZE TABLE sales_commission_rules;

SELECT CONCAT('Performance optimization completed!') AS status;
