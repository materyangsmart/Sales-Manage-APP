-- 禁用外键检查
SET FOREIGN_KEY_CHECKS = 0;

-- 清空旧数据
DELETE FROM ar_apply;
DELETE FROM ar_payments;
DELETE FROM ar_invoices;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM customers;
DELETE FROM products;

-- 插入产品数据
INSERT INTO products (org_id, product_name, sku, unit_price, stock_quantity, created_by, created_at, updated_at) VALUES
(2, '千张（标准装）', 'QZ-STD-001', 850, 1000, 1, NOW(), NOW()),
(2, '千张（精品装）', 'QZ-PRE-001', 1200, 1000, 1, NOW(), NOW()),
(2, '豆腐皮（标准装）', 'DFP-STD-001', 700, 1000, 1, NOW(), NOW()),
(2, '豆腐皮（精品装）', 'DFP-PRE-001', 1050, 1000, 1, NOW(), NOW()),
(2, '腐竹（标准装）', 'FZ-STD-001', 1500, 1000, 1, NOW(), NOW());

-- 插入客户数据（30个客户）
INSERT INTO customers (org_id, customer_code, customer_name, name, category, status, created_by, created_at) VALUES
-- 菜市场类（15个）
(2, 'WM000001', '李记菜市场', '李记菜市场', 'WET_MARKET', 'ACTIVE', 1, '2026-01-05 08:30:00'),
(2, 'WM000002', '王家菜市场', '王家菜市场', 'WET_MARKET', 'ACTIVE', 1, '2026-01-08 09:15:00'),
(2, 'WM000003', '张氏菜市场', '张氏菜市场', 'WET_MARKET', 'ACTIVE', 1, '2026-01-10 10:20:00'),
(2, 'WM000004', '刘记菜市场', '刘记菜市场', 'WET_MARKET', 'ACTIVE', 1, '2026-01-12 11:00:00'),
(2, 'WM000005', '陈记菜市场', '陈记菜市场', 'WET_MARKET', 'ACTIVE', 1, '2026-01-15 08:45:00'),
(2, 'WM000006', '李记菜市场2', '李记菜市场2', 'WET_MARKET', 'ACTIVE', 1, '2026-01-18 09:30:00'),
(2, 'WM000007', '王家菜市场2', '王家菜市场2', 'WET_MARKET', 'ACTIVE', 1, '2026-01-20 10:00:00'),
(2, 'WM000008', '张氏菜市场2', '张氏菜市场2', 'WET_MARKET', 'ACTIVE', 1, '2026-01-22 11:15:00'),
(2, 'WM000009', '刘记菜市场2', '刘记菜市场2', 'WET_MARKET', 'ACTIVE', 1, '2026-01-25 08:20:00'),
(2, 'WM000010', '陈记菜市场2', '陈记菜市场2', 'WET_MARKET', 'ACTIVE', 1, '2026-01-28 09:00:00'),
(2, 'WM000011', '李记菜市场3', '李记菜市场3', 'WET_MARKET', 'ACTIVE', 1, '2026-02-01 10:30:00'),
(2, 'WM000012', '王家菜市场3', '王家菜市场3', 'WET_MARKET', 'ACTIVE', 1, '2026-02-05 11:45:00'),
(2, 'WM000013', '张氏菜市场3', '张氏菜市场3', 'WET_MARKET', 'INACTIVE', 1, '2026-02-08 08:15:00'),
(2, 'WM000014', '刘记菜市场3', '刘记菜市场3', 'WET_MARKET', 'INACTIVE', 1, '2026-02-10 09:45:00'),
(2, 'WM000015', '陈记菜市场3', '陈记菜市场3', 'WET_MARKET', 'INACTIVE', 1, '2026-02-12 10:15:00'),
-- 商超类（8个）
(2, 'SM000001', '华联上海店', '华联上海店', 'SUPERMARKET', 'ACTIVE', 1, '2026-01-06 09:00:00'),
(2, 'SM000002', '世纪联华杭州店', '世纪联华杭州店', 'SUPERMARKET', 'ACTIVE', 1, '2026-01-10 10:30:00'),
(2, 'SM000003', '家乐福南京店', '家乐福南京店', 'SUPERMARKET', 'ACTIVE', 1, '2026-01-15 11:00:00'),
(2, 'SM000004', '沃尔玛苏州店', '沃尔玛苏州店', 'SUPERMARKET', 'ACTIVE', 1, '2026-01-20 09:30:00'),
(2, 'SM000005', '大润发上海店', '大润发上海店', 'SUPERMARKET', 'ACTIVE', 1, '2026-01-25 10:00:00'),
(2, 'SM000006', '华联杭州店', '华联杭州店', 'SUPERMARKET', 'ACTIVE', 1, '2026-02-01 11:30:00'),
(2, 'SM000007', '世纪联华南京店', '世纪联华南京店', 'SUPERMARKET', 'INACTIVE', 1, '2026-02-05 09:00:00'),
(2, 'SM000008', '家乐福苏州店', '家乐福苏州店', 'SUPERMARKET', 'INACTIVE', 1, '2026-02-10 10:30:00'),
-- 批发商类（5个）
(2, 'WB000001', '东方食品批发', '东方食品批发', 'WHOLESALE_B', 'ACTIVE', 1, '2026-01-08 08:45:00'),
(2, 'WB000002', '华东食品批发', '华东食品批发', 'WHOLESALE_B', 'ACTIVE', 1, '2026-01-15 09:30:00'),
(2, 'WB000003', '江浙食品批发', '江浙食品批发', 'WHOLESALE_B', 'ACTIVE', 1, '2026-01-22 10:15:00'),
(2, 'WB000004', '长三角食品批发', '长三角食品批发', 'WHOLESALE_B', 'ACTIVE', 1, '2026-02-01 11:00:00'),
(2, 'WB000005', '东方食品批发2', '东方食品批发2', 'WHOLESALE_B', 'INACTIVE', 1, '2026-02-10 08:30:00'),
-- 电商类（2个）
(2, 'EC000001', '李记电商', '李记电商', 'ECOMMERCE', 'ACTIVE', 1, '2026-01-12 09:00:00'),
(2, 'EC000002', '王家电商', '王家电商', 'ECOMMERCE', 'ACTIVE', 1, '2026-02-05 10:30:00');

-- 获取客户ID（使用变量）
SET @cust1 = (SELECT id FROM customers WHERE customer_code='WM000001');
SET @cust2 = (SELECT id FROM customers WHERE customer_code='WM000002');
SET @cust3 = (SELECT id FROM customers WHERE customer_code='WM000003');
SET @cust16 = (SELECT id FROM customers WHERE customer_code='SM000001');
SET @cust26 = (SELECT id FROM customers WHERE customer_code='WB000001');
SET @cust29 = (SELECT id FROM customers WHERE customer_code='EC000001');

-- 获取产品ID
SET @prod1 = (SELECT id FROM products WHERE sku='QZ-STD-001');
SET @prod2 = (SELECT id FROM products WHERE sku='QZ-PRE-001');
SET @prod3 = (SELECT id FROM products WHERE sku='DFP-STD-001');
SET @prod4 = (SELECT id FROM products WHERE sku='DFP-PRE-001');
SET @prod5 = (SELECT id FROM products WHERE sku='FZ-STD-001');

-- 插入订单数据（20笔订单）
INSERT INTO orders (org_id, customer_id, order_no, order_date, total_amount, status, created_by) VALUES
-- 客户1的订单（李记菜市场）
(2, @cust1, 'ORD-00000001', '2026-01-06', 85000, 'FULFILLED', 1),
(2, @cust1, 'ORD-00000002', '2026-01-15', 120000, 'FULFILLED', 1),
(2, @cust1, 'ORD-00000003', '2026-01-25', 70000, 'FULFILLED', 1),
(2, @cust1, 'ORD-00000004', '2026-02-05', 105000, 'FULFILLED', 1),
-- 客户2的订单（王家菜市场）
(2, @cust2, 'ORD-00000005', '2026-01-10', 90000, 'FULFILLED', 1),
(2, @cust2, 'ORD-00000006', '2026-01-20', 150000, 'FULFILLED', 1),
(2, @cust2, 'ORD-00000007', '2026-02-01', 80000, 'FULFILLED', 1),
-- 客户3的订单（张氏菜市场）
(2, @cust3, 'ORD-00000008', '2026-01-12', 95000, 'FULFILLED', 1),
(2, @cust3, 'ORD-00000009', '2026-01-22', 110000, 'FULFILLED', 1),
(2, @cust3, 'ORD-00000010', '2026-02-08', 75000, 'FULFILLED', 1),
-- 客户16的订单（华联上海店 - 商超）
(2, @cust16, 'ORD-00000011', '2026-01-08', 200000, 'FULFILLED', 1),
(2, @cust16, 'ORD-00000012', '2026-01-18', 250000, 'FULFILLED', 1),
(2, @cust16, 'ORD-00000013', '2026-02-05', 180000, 'FULFILLED', 1),
(2, @cust16, 'ORD-00000014', '2026-02-15', 220000, 'FULFILLED', 1),
-- 客户26的订单（东方食品批发 - 批发商）
(2, @cust26, 'ORD-00000015', '2026-01-10', 500000, 'FULFILLED', 1),
(2, @cust26, 'ORD-00000016', '2026-01-25', 600000, 'FULFILLED', 1),
(2, @cust26, 'ORD-00000017', '2026-02-10', 450000, 'FULFILLED', 1),
-- 客户29的订单（李记电商 - 电商）
(2, @cust29, 'ORD-00000018', '2026-01-15', 300000, 'FULFILLED', 1),
(2, @cust29, 'ORD-00000019', '2026-02-01', 350000, 'FULFILLED', 1),
(2, @cust29, 'ORD-00000020', '2026-02-15', 280000, 'FULFILLED', 1);

-- 获取订单ID
SET @ord1 = (SELECT id FROM orders WHERE order_no='ORD-00000001');
SET @ord2 = (SELECT id FROM orders WHERE order_no='ORD-00000002');
SET @ord3 = (SELECT id FROM orders WHERE order_no='ORD-00000003');
SET @ord4 = (SELECT id FROM orders WHERE order_no='ORD-00000004');
SET @ord5 = (SELECT id FROM orders WHERE order_no='ORD-00000005');
SET @ord6 = (SELECT id FROM orders WHERE order_no='ORD-00000006');
SET @ord7 = (SELECT id FROM orders WHERE order_no='ORD-00000007');
SET @ord8 = (SELECT id FROM orders WHERE order_no='ORD-00000008');
SET @ord9 = (SELECT id FROM orders WHERE order_no='ORD-00000009');
SET @ord10 = (SELECT id FROM orders WHERE order_no='ORD-00000010');
SET @ord11 = (SELECT id FROM orders WHERE order_no='ORD-00000011');
SET @ord12 = (SELECT id FROM orders WHERE order_no='ORD-00000012');
SET @ord13 = (SELECT id FROM orders WHERE order_no='ORD-00000013');
SET @ord14 = (SELECT id FROM orders WHERE order_no='ORD-00000014');
SET @ord15 = (SELECT id FROM orders WHERE order_no='ORD-00000015');
SET @ord16 = (SELECT id FROM orders WHERE order_no='ORD-00000016');
SET @ord17 = (SELECT id FROM orders WHERE order_no='ORD-00000017');
SET @ord18 = (SELECT id FROM orders WHERE order_no='ORD-00000018');
SET @ord19 = (SELECT id FROM orders WHERE order_no='ORD-00000019');
SET @ord20 = (SELECT id FROM orders WHERE order_no='ORD-00000020');

-- 插入订单项数据
INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price, quantity, subtotal) VALUES
-- 订单1的订单项
(@ord1, @prod1, '千张（标准装）', 'QZ-STD-001', 850, 100, 85000),
-- 订单2的订单项
(@ord2, @prod2, '千张（精品装）', 'QZ-PRE-001', 1200, 100, 120000),
-- 订单3的订单项
(@ord3, @prod3, '豆腐皮（标准装）', 'DFP-STD-001', 700, 100, 70000),
-- 订单4的订单项
(@ord4, @prod4, '豆腐皮（精品装）', 'DFP-PRE-001', 1050, 100, 105000),
-- 订单5的订单项
(@ord5, @prod1, '千张（标准装）', 'QZ-STD-001', 850, 106, 90100),
-- 订单6的订单项
(@ord6, @prod2, '千张（精品装）', 'QZ-PRE-001', 1200, 125, 150000),
-- 订单7的订单项
(@ord7, @prod3, '豆腐皮（标准装）', 'DFP-STD-001', 700, 114, 79800),
-- 订单8的订单项
(@ord8, @prod1, '千张（标准装）', 'QZ-STD-001', 850, 112, 95200),
-- 订单9的订单项
(@ord9, @prod2, '千张（精品装）', 'QZ-PRE-001', 1200, 92, 110400),
-- 订单10的订单项
(@ord10, @prod3, '豆腐皮（标准装）', 'DFP-STD-001', 700, 107, 74900),
-- 订单11的订单项（商超）
(@ord11, @prod1, '千张（标准装）', 'QZ-STD-001', 850, 235, 199750),
-- 订单12的订单项（商超）
(@ord12, @prod2, '千张（精品装）', 'QZ-PRE-001', 1200, 208, 249600),
-- 订单13的订单项（商超）
(@ord13, @prod3, '豆腐皮（标准装）', 'DFP-STD-001', 700, 257, 179900),
-- 订单14的订单项（商超）
(@ord14, @prod4, '豆腐皮（精品装）', 'DFP-PRE-001', 1050, 210, 220500),
-- 订单15的订单项（批发商）
(@ord15, @prod1, '千张（标准装）', 'QZ-STD-001', 850, 588, 499800),
-- 订单16的订单项（批发商）
(@ord16, @prod2, '千张（精品装）', 'QZ-PRE-001', 1200, 500, 600000),
-- 订单17的订单项（批发商）
(@ord17, @prod5, '腐竹（标准装）', 'FZ-STD-001', 1500, 300, 450000),
-- 订单18的订单项（电商）
(@ord18, @prod1, '千张（标准装）', 'QZ-STD-001', 850, 353, 300050),
-- 订单19的订单项（电商）
(@ord19, @prod2, '千张（精品装）', 'QZ-PRE-001', 1200, 292, 350400),
-- 订单20的订单项（电商）
(@ord20, @prod3, '豆腐皮（标准装）', 'DFP-STD-001', 700, 400, 280000);

-- 插入发票数据
INSERT INTO ar_invoices (org_id, customer_id, order_id, invoice_no, amount, tax_amount, balance, due_date, status) VALUES
-- 订单1-20的发票
(2, @cust1, @ord1, 'INV-00000001', 85000, 11050, 85000, '2026-02-05', 'OPEN'),
(2, @cust1, @ord2, 'INV-00000002', 120000, 15600, 120000, '2026-02-14', 'OPEN'),
(2, @cust1, @ord3, 'INV-00000003', 70000, 9100, 70000, '2026-02-24', 'OPEN'),
(2, @cust1, @ord4, 'INV-00000004', 105000, 13650, 105000, '2026-03-07', 'OPEN'),
(2, @cust2, @ord5, 'INV-00000005', 90000, 11700, 90000, '2026-02-09', 'OPEN'),
(2, @cust2, @ord6, 'INV-00000006', 150000, 19500, 150000, '2026-02-19', 'OPEN'),
(2, @cust2, @ord7, 'INV-00000007', 80000, 10400, 80000, '2026-03-03', 'OPEN'),
(2, @cust3, @ord8, 'INV-00000008', 95000, 12350, 95000, '2026-02-11', 'OPEN'),
(2, @cust3, @ord9, 'INV-00000009', 110000, 14300, 110000, '2026-02-21', 'OPEN'),
(2, @cust3, @ord10, 'INV-00000010', 75000, 9750, 75000, '2026-03-10', 'OPEN'),
(2, @cust16, @ord11, 'INV-00000011', 200000, 26000, 200000, '2026-02-07', 'OPEN'),
(2, @cust16, @ord12, 'INV-00000012', 250000, 32500, 250000, '2026-02-17', 'OPEN'),
(2, @cust16, @ord13, 'INV-00000013', 180000, 23400, 180000, '2026-03-07', 'OPEN'),
(2, @cust16, @ord14, 'INV-00000014', 220000, 28600, 220000, '2026-03-17', 'OPEN'),
(2, @cust26, @ord15, 'INV-00000015', 500000, 65000, 500000, '2026-02-09', 'OPEN'),
(2, @cust26, @ord16, 'INV-00000016', 600000, 78000, 600000, '2026-02-24', 'OPEN'),
(2, @cust26, @ord17, 'INV-00000017', 450000, 58500, 450000, '2026-03-12', 'OPEN'),
(2, @cust29, @ord18, 'INV-00000018', 300000, 39000, 300000, '2026-02-14', 'OPEN'),
(2, @cust29, @ord19, 'INV-00000019', 350000, 45500, 350000, '2026-03-03', 'OPEN'),
(2, @cust29, @ord20, 'INV-00000020', 280000, 36400, 280000, '2026-03-17', 'OPEN');

-- 获取发票ID
SET @inv1 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000001');
SET @inv2 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000002');
SET @inv3 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000003');
SET @inv4 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000004');
SET @inv5 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000005');
SET @inv6 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000006');
SET @inv7 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000007');
SET @inv8 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000008');
SET @inv9 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000009');
SET @inv10 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000010');
SET @inv11 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000011');
SET @inv12 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000012');
SET @inv13 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000013');
SET @inv14 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000014');
SET @inv15 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000015');
SET @inv16 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000016');
SET @inv18 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000018');
SET @inv19 = (SELECT id FROM ar_invoices WHERE invoice_no='INV-00000019');

-- 插入回款数据
-- 60%按时回款（12笔）
INSERT INTO ar_payments (org_id, customer_id, payment_no, bank_ref, payment_date, amount, unapplied_amount, status, payment_method, created_by) VALUES
(2, @cust1, 'PAY-00000001', 'BANK-123456', '2026-01-25', 85000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust1, 'PAY-00000002', 'BANK-123457', '2026-02-05', 120000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust2, 'PAY-00000003', 'BANK-123458', '2026-02-01', 90000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust2, 'PAY-00000004', 'BANK-123459', '2026-02-12', 150000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust3, 'PAY-00000005', 'BANK-123460', '2026-02-05', 95000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust3, 'PAY-00000006', 'BANK-123461', '2026-02-15', 110000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust16, 'PAY-00000007', 'BANK-123462', '2026-01-30', 200000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust16, 'PAY-00000008', 'BANK-123463', '2026-02-10', 250000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust26, 'PAY-00000009', 'BANK-123464', '2026-02-01', 500000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust26, 'PAY-00000010', 'BANK-123465', '2026-02-18', 600000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust29, 'PAY-00000011', 'BANK-123466', '2026-02-08', 300000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust29, 'PAY-00000012', 'BANK-123467', '2026-02-25', 350000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
-- 20%逾期回款（4笔）
(2, @cust1, 'PAY-00000013', 'BANK-123468', '2026-03-15', 70000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust2, 'PAY-00000014', 'BANK-123469', '2026-03-25', 80000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust3, 'PAY-00000015', 'BANK-123470', '2026-04-05', 75000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust16, 'PAY-00000016', 'BANK-123471', '2026-04-10', 180000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
-- 10%部分核销（2笔合并回款）
(2, @cust1, 'PAY-00000017', 'BANK-123472', '2026-03-20', 105000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
(2, @cust16, 'PAY-00000018', 'BANK-123473', '2026-04-01', 220000, 0, 'APPLIED', 'BANK_TRANSFER', 1),
-- 10%待核销（2笔）
(2, @cust26, 'PAY-00000019', 'BANK-123474', '2026-03-05', 450000, 450000, 'UNAPPLIED', 'BANK_TRANSFER', 1),
(2, @cust29, 'PAY-00000020', 'BANK-123475', '2026-03-10', 280000, 280000, 'UNAPPLIED', 'BANK_TRANSFER', 1);

-- 获取回款ID
SET @pay1 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000001');
SET @pay2 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000002');
SET @pay3 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000003');
SET @pay4 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000004');
SET @pay5 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000005');
SET @pay6 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000006');
SET @pay7 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000007');
SET @pay8 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000008');
SET @pay9 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000009');
SET @pay10 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000010');
SET @pay11 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000011');
SET @pay12 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000012');
SET @pay13 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000013');
SET @pay14 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000014');
SET @pay15 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000015');
SET @pay16 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000016');
SET @pay17 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000017');
SET @pay18 = (SELECT id FROM ar_payments WHERE payment_no='PAY-00000018');

-- 插入核销数据
INSERT INTO ar_apply (org_id, payment_id, invoice_id, applied_amount, operator_id) VALUES
-- 按时回款的核销（12笔）
(2, @pay1, @inv1, 85000, 1),
(2, @pay2, @inv2, 120000, 1),
(2, @pay3, @inv5, 90000, 1),
(2, @pay4, @inv6, 150000, 1),
(2, @pay5, @inv8, 95000, 1),
(2, @pay6, @inv9, 110000, 1),
(2, @pay7, @inv11, 200000, 1),
(2, @pay8, @inv12, 250000, 1),
(2, @pay9, @inv15, 500000, 1),
(2, @pay10, @inv16, 600000, 1),
(2, @pay11, @inv18, 300000, 1),
(2, @pay12, @inv19, 350000, 1),
-- 逾期回款的核销（4笔）
(2, @pay13, @inv3, 70000, 1),
(2, @pay14, @inv7, 80000, 1),
(2, @pay15, @inv10, 75000, 1),
(2, @pay16, @inv13, 180000, 1),
-- 部分核销（合并回款）
(2, @pay17, @inv4, 105000, 1),
(2, @pay18, @inv14, 220000, 1);

-- 启用外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- 验证数据
SELECT '产品数据' as '表名', COUNT(*) as '记录数' FROM products
UNION ALL
SELECT '客户数据', COUNT(*) FROM customers
UNION ALL
SELECT '订单数据', COUNT(*) FROM orders
UNION ALL
SELECT '订单项数据', COUNT(*) FROM order_items
UNION ALL
SELECT '发票数据', COUNT(*) FROM ar_invoices
UNION ALL
SELECT '回款数据', COUNT(*) FROM ar_payments
UNION ALL
SELECT '核销数据', COUNT(*) FROM ar_apply;

-- 统计营业额
SELECT '总营业额（元）' as '指标', SUM(total_amount)/100 as '数值' FROM orders WHERE org_id=2
UNION ALL
SELECT '订单数', COUNT(*) FROM orders WHERE org_id=2;
