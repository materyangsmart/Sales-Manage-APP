-- P22-P25 治理级架构数据库迁移脚本
-- 创建日期: 2026-02-24
-- 用途: 创建"人性防线"核心的9张数据库表

-- ============================================================
-- 1. price_anomalies（价格洼地监控）
-- ============================================================
CREATE TABLE IF NOT EXISTS price_anomalies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL COMMENT '订单ID',
  customer_id INT NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(255) NOT NULL COMMENT '客户名称',
  product_id INT NOT NULL COMMENT '产品ID',
  product_name VARCHAR(255) NOT NULL COMMENT '产品名称',
  unit_price DECIMAL(10, 2) NOT NULL COMMENT '订单单价',
  region_avg_price DECIMAL(10, 2) NOT NULL COMMENT '片区平均单价',
  deviation_percent DECIMAL(5, 2) NOT NULL COMMENT '偏差百分比（负数表示低于均值）',
  sales_rep_id INT NOT NULL COMMENT '业务员ID',
  sales_rep_name VARCHAR(255) NOT NULL COMMENT '业务员姓名',
  special_reason TEXT COMMENT '特价原因（必填）',
  approved_by INT COMMENT '审批人ID',
  approved_at TIMESTAMP NULL COMMENT '审批时间',
  status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING' COMMENT '审批状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_sales_rep_id (sales_rep_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格洼地监控表';

-- ============================================================
-- 2. settlement_audit（结算行为审计）
-- ============================================================
CREATE TABLE IF NOT EXISTS settlement_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL COMMENT '收款ID',
  invoice_id INT NOT NULL COMMENT '发票ID',
  apply_amount DECIMAL(10, 2) NOT NULL COMMENT '核销金额',
  sales_rep_id INT NOT NULL COMMENT '业务员ID',
  sales_rep_name VARCHAR(255) NOT NULL COMMENT '业务员姓名',
  apply_time TIMESTAMP NOT NULL COMMENT '核销时间',
  commission_deadline TIMESTAMP NOT NULL COMMENT '提成统计截止时间',
  time_to_deadline INT NOT NULL COMMENT '距离截止时间的秒数',
  is_suspicious BOOLEAN DEFAULT FALSE COMMENT '是否疑似人为操控',
  suspicious_reason TEXT COMMENT '疑似原因',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_payment_id (payment_id),
  INDEX idx_sales_rep_id (sales_rep_id),
  INDEX idx_apply_time (apply_time),
  INDEX idx_is_suspicious (is_suspicious)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='结算行为审计表';

-- ============================================================
-- 3. customer_credit_scores（客户信用评分）
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_credit_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL UNIQUE COMMENT '客户ID',
  customer_name VARCHAR(255) NOT NULL COMMENT '客户名称',
  credit_score INT NOT NULL DEFAULT 60 COMMENT '信用评分（0-100）',
  credit_level ENUM('S', 'A', 'B', 'C', 'D') NOT NULL DEFAULT 'C' COMMENT '信用等级',
  total_orders INT NOT NULL DEFAULT 0 COMMENT '历史订单总数',
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 COMMENT '历史交易总额',
  paid_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 COMMENT '已回款总额',
  payment_rate DECIMAL(5, 2) NOT NULL DEFAULT 0 COMMENT '回款率（%）',
  overdue_count INT NOT NULL DEFAULT 0 COMMENT '逾期次数',
  max_overdue_days INT NOT NULL DEFAULT 0 COMMENT '最大逾期天数',
  last_order_date DATE NULL COMMENT '最后订单日期',
  auto_approve_enabled BOOLEAN DEFAULT FALSE COMMENT '是否启用自动审批',
  auto_approve_limit DECIMAL(10, 2) DEFAULT 0 COMMENT '自动审批额度上限',
  last_calculated_at TIMESTAMP NULL COMMENT '最后计算时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_customer_id (customer_id),
  INDEX idx_credit_level (credit_level),
  INDEX idx_payment_rate (payment_rate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户信用评分表';

-- ============================================================
-- 4. auto_approval_logs（自动审批日志）
-- ============================================================
CREATE TABLE IF NOT EXISTS auto_approval_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL COMMENT '订单ID',
  customer_id INT NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(255) NOT NULL COMMENT '客户名称',
  order_amount DECIMAL(10, 2) NOT NULL COMMENT '订单金额',
  credit_score INT NOT NULL COMMENT '当时的信用评分',
  credit_level VARCHAR(10) NOT NULL COMMENT '当时的信用等级',
  payment_rate DECIMAL(5, 2) NOT NULL COMMENT '当时的回款率',
  auto_approve_limit DECIMAL(10, 2) NOT NULL COMMENT '自动审批额度上限',
  decision ENUM('APPROVED', 'REJECTED', 'MANUAL') NOT NULL COMMENT '决策结果',
  decision_reason TEXT NOT NULL COMMENT '决策原因',
  processing_time_ms INT NOT NULL COMMENT '处理耗时（毫秒）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_order_id (order_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_decision (decision),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动审批日志表';

-- ============================================================
-- 5. role_permissions（角色权限映射）
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL COMMENT '角色名称',
  permission_key VARCHAR(100) NOT NULL COMMENT '权限键',
  permission_name VARCHAR(255) NOT NULL COMMENT '权限名称',
  permission_type ENUM('READ', 'WRITE', 'DELETE', 'APPROVE') NOT NULL COMMENT '权限类型',
  resource_type VARCHAR(50) NOT NULL COMMENT '资源类型（orders, invoices, payments等）',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_role_permission (role_name, permission_key),
  INDEX idx_role_name (role_name),
  INDEX idx_resource_type (resource_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限映射表';

-- 插入预定义角色权限
INSERT INTO role_permissions (role_name, permission_key, permission_name, permission_type, resource_type) VALUES
-- 财务专员：只能查看和核销，不能修改订单
('FINANCE', 'orders.read', '查看订单', 'READ', 'orders'),
('FINANCE', 'invoices.read', '查看发票', 'READ', 'invoices'),
('FINANCE', 'invoices.write', '创建发票', 'WRITE', 'invoices'),
('FINANCE', 'payments.read', '查看收款', 'READ', 'payments'),
('FINANCE', 'payments.write', '录入收款', 'WRITE', 'payments'),
('FINANCE', 'apply.write', '执行核销', 'WRITE', 'apply'),
-- 销售员：可以创建订单，但看不到收款账号
('SALES', 'orders.read', '查看订单', 'READ', 'orders'),
('SALES', 'orders.write', '创建订单', 'WRITE', 'orders'),
('SALES', 'customers.read', '查看客户', 'READ', 'customers'),
('SALES', 'commission.read', '查看提成', 'READ', 'commission'),
-- 营销总监：可以审批异常价格
('MARKETING_DIRECTOR', 'orders.read', '查看订单', 'READ', 'orders'),
('MARKETING_DIRECTOR', 'price_anomalies.approve', '审批异常价格', 'APPROVE', 'price_anomalies'),
('MARKETING_DIRECTOR', 'commission.read', '查看提成', 'READ', 'commission'),
-- 管理员：所有权限
('ADMIN', 'orders.read', '查看订单', 'READ', 'orders'),
('ADMIN', 'orders.write', '创建订单', 'WRITE', 'orders'),
('ADMIN', 'orders.delete', '删除订单', 'DELETE', 'orders'),
('ADMIN', 'orders.approve', '审批订单', 'APPROVE', 'orders'),
('ADMIN', 'invoices.read', '查看发票', 'READ', 'invoices'),
('ADMIN', 'invoices.write', '创建发票', 'WRITE', 'invoices'),
('ADMIN', 'payments.read', '查看收款', 'READ', 'payments'),
('ADMIN', 'payments.write', '录入收款', 'WRITE', 'payments'),
('ADMIN', 'apply.write', '执行核销', 'WRITE', 'apply'),
('ADMIN', 'customers.read', '查看客户', 'READ', 'customers'),
('ADMIN', 'customers.write', '创建客户', 'WRITE', 'customers'),
('ADMIN', 'commission.read', '查看提成', 'READ', 'commission'),
('ADMIN', 'price_anomalies.approve', '审批异常价格', 'APPROVE', 'price_anomalies'),
('ADMIN', 'ceo.radar', '查看CEO雷达', 'READ', 'ceo')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================================
-- 6. permission_change_logs（权限变更审计）
-- ============================================================
CREATE TABLE IF NOT EXISTS permission_change_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '用户ID',
  user_name VARCHAR(255) NOT NULL COMMENT '用户姓名',
  old_role VARCHAR(50) NULL COMMENT '旧角色',
  new_role VARCHAR(50) NOT NULL COMMENT '新角色',
  old_permissions TEXT NULL COMMENT '旧权限列表（JSON）',
  new_permissions TEXT NOT NULL COMMENT '新权限列表（JSON）',
  changed_by INT NOT NULL COMMENT '操作人ID',
  changed_by_name VARCHAR(255) NOT NULL COMMENT '操作人姓名',
  change_reason TEXT NULL COMMENT '变更原因',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (user_id),
  INDEX idx_changed_by (changed_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限变更审计表';

-- ============================================================
-- 7. batch_trace（生产批次追溯）
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_trace (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_no VARCHAR(50) NOT NULL UNIQUE COMMENT '批次号',
  production_date DATE NOT NULL COMMENT '生产日期',
  soybean_batch VARCHAR(50) NOT NULL COMMENT '黄豆批次号',
  soybean_supplier VARCHAR(255) NOT NULL COMMENT '黄豆供应商',
  soybean_weight DECIMAL(10, 2) NOT NULL COMMENT '黄豆投入量（kg）',
  water_quality_report VARCHAR(255) NULL COMMENT '水质检测报告编号',
  product_output DECIMAL(10, 2) NOT NULL COMMENT '成品产出量（kg）',
  yield_rate DECIMAL(5, 2) NOT NULL COMMENT '得率（%）',
  workshop_temp DECIMAL(5, 2) NULL COMMENT '车间温度（℃）',
  sterilization_params VARCHAR(255) NULL COMMENT '灭菌参数',
  inspector_id INT NOT NULL COMMENT '质检员ID',
  inspector_name VARCHAR(255) NOT NULL COMMENT '质检员姓名',
  quality_status ENUM('PASS', 'FAIL') NOT NULL DEFAULT 'PASS' COMMENT '质检状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_batch_no (batch_no),
  INDEX idx_production_date (production_date),
  INDEX idx_quality_status (quality_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='生产批次追溯表';

-- ============================================================
-- 8. quality_complaints（质量投诉）
-- ============================================================
CREATE TABLE IF NOT EXISTS quality_complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL COMMENT '订单ID',
  batch_no VARCHAR(50) NULL COMMENT '批次号',
  customer_name VARCHAR(255) NOT NULL COMMENT '投诉人姓名',
  customer_phone VARCHAR(20) NULL COMMENT '投诉人电话',
  complaint_type ENUM('QUALITY', 'SERVICE', 'DELIVERY', 'OTHER') NOT NULL COMMENT '投诉类型',
  complaint_content TEXT NOT NULL COMMENT '投诉内容',
  complaint_images TEXT NULL COMMENT '投诉图片（JSON数组）',
  driver_id INT NULL COMMENT '配送司机ID',
  driver_name VARCHAR(255) NULL COMMENT '配送司机姓名',
  sales_rep_id INT NULL COMMENT '业务员ID',
  sales_rep_name VARCHAR(255) NULL COMMENT '业务员姓名',
  status ENUM('PENDING', 'PROCESSING', 'RESOLVED', 'CLOSED') DEFAULT 'PENDING' COMMENT '处理状态',
  assigned_to INT NULL COMMENT '分配给（处理人ID）',
  assigned_to_name VARCHAR(255) NULL COMMENT '处理人姓名',
  resolution TEXT NULL COMMENT '处理结果',
  resolved_at TIMESTAMP NULL COMMENT '处理完成时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_batch_no (batch_no),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量投诉表';

-- ============================================================
-- 9. commission_rules_v2（透明提成规则）
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_rules_v2 (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL COMMENT '规则名称',
  rule_type ENUM('SALES_AMOUNT', 'PAYMENT_RATE', 'BAD_DEBT_DEDUCTION') NOT NULL COMMENT '规则类型',
  rule_formula TEXT NOT NULL COMMENT '计算公式（可执行的表达式）',
  rule_params JSON NULL COMMENT '规则参数（JSON对象）',
  effective_from DATE NOT NULL COMMENT '生效日期',
  effective_to DATE NULL COMMENT '失效日期',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_by INT NOT NULL COMMENT '创建人ID',
  created_by_name VARCHAR(255) NOT NULL COMMENT '创建人姓名',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_rule_type (rule_type),
  INDEX idx_effective_from (effective_from),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='透明提成规则表';

-- 插入示例提成规则
INSERT INTO commission_rules_v2 (rule_name, rule_type, rule_formula, rule_params, effective_from, created_by, created_by_name) VALUES
('基础提成', 'SALES_AMOUNT', 'paid_amount * rate', '{"rate": 0.05}', '2026-01-01', 1, 'CEO'),
('回款率加成', 'PAYMENT_RATE', 'IF(payment_rate >= 0.98, base_commission * 1.1, base_commission)', '{}', '2026-01-01', 1, 'CEO'),
('坏账扣除', 'BAD_DEBT_DEDUCTION', 'bad_debt_amount * penalty_rate', '{"penalty_rate": 0.5}', '2026-01-01', 1, 'CEO')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================================
-- 完成提示
-- ============================================================
SELECT 'P22-P25 治理级架构数据库迁移完成！' AS message;
SELECT '已创建9张核心表：price_anomalies, settlement_audit, customer_credit_scores, auto_approval_logs, role_permissions, permission_change_logs, batch_trace, quality_complaints, commission_rules_v2' AS tables_created;
