# P22-P25 治理级架构数据库设计

## 设计原则

本文档定义了"人性防线"核心的数据库表结构，用于支撑以下功能：
- P22: 反舞弊与偏差预警系统
- P23: 去中心化的数字信用自动放行
- P24: 职能边界与开户自动化
- P25: 质量追溯与闭环反馈

所有表设计遵循以下原则：
1. **审计优先**：所有关键操作必须留痕
2. **算法驱动**：用数据和规则取代人为判断
3. **防篡改**：关键字段不可修改，只能追加
4. **可追溯**：所有异常必须能追溯到具体人、时间、批次

---

## 表结构定义

### 1. price_anomalies（价格洼地监控）

**用途**：记录所有低于片区均值3%以上的异常定价

```sql
CREATE TABLE price_anomalies (
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
  approved_at TIMESTAMP COMMENT '审批时间',
  status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING' COMMENT '审批状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_sales_rep_id (sales_rep_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格洼地监控表';
```

**关键字段说明**：
- `deviation_percent`：负数表示低于均值，例如-3.5表示低于均值3.5%
- `special_reason`：必填字段，业务员必须填写特价原因
- `status`：PENDING等待审批，APPROVED已批准，REJECTED已拒绝

---

### 2. settlement_audit（结算行为审计）

**用途**：记录所有核销操作，用于检测"疑似人为操控账期"行为

```sql
CREATE TABLE settlement_audit (
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
```

**关键字段说明**：
- `time_to_deadline`：距离提成统计截止时间的秒数，如果<7200（2小时）则标记为疑似
- `is_suspicious`：自动标记，如果某业务员的核销动作总是在截止前2小时完成
- `suspicious_reason`：自动生成的疑似原因，例如"连续3次在截止前2小时内核销"

---

### 3. customer_credit_scores（客户信用评分）

**用途**：动态计算每个客户的信用分，用于自动审批

```sql
CREATE TABLE customer_credit_scores (
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
  last_order_date DATE COMMENT '最后订单日期',
  auto_approve_enabled BOOLEAN DEFAULT FALSE COMMENT '是否启用自动审批',
  auto_approve_limit DECIMAL(10, 2) DEFAULT 0 COMMENT '自动审批额度上限',
  last_calculated_at TIMESTAMP COMMENT '最后计算时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_customer_id (customer_id),
  INDEX idx_credit_level (credit_level),
  INDEX idx_payment_rate (payment_rate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户信用评分表';
```

**信用评分算法**：
```
credit_score = 60 (基础分)
  + payment_rate * 0.3 (回款率权重30%)
  - overdue_count * 2 (每次逾期扣2分)
  - max_overdue_days * 0.1 (最大逾期天数权重)
  + min(total_orders / 100, 10) (订单数加分，最多10分)
```

**信用等级划分**：
- S级：credit_score >= 95，payment_rate >= 99%
- A级：credit_score >= 85，payment_rate >= 98%
- B级：credit_score >= 70，payment_rate >= 95%
- C级：credit_score >= 50，payment_rate >= 90%
- D级：credit_score < 50 或 payment_rate < 90%

**自动审批规则**：
- S级：自动审批额度 = 历史平均订单金额 × 1.5
- A级：自动审批额度 = 历史平均订单金额 × 1.15
- B级及以下：不启用自动审批

---

### 4. auto_approval_logs（自动审批日志）

**用途**：记录所有自动审批的决策过程

```sql
CREATE TABLE auto_approval_logs (
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
```

**决策逻辑**：
```
IF credit_level IN ('S', 'A') AND payment_rate >= 98% THEN
  IF order_amount <= auto_approve_limit THEN
    decision = 'APPROVED'
    decision_reason = '信用等级{credit_level}，回款率{payment_rate}%，订单金额{order_amount}在自动审批额度{auto_approve_limit}内'
  ELSE
    decision = 'MANUAL'
    decision_reason = '订单金额{order_amount}超过自动审批额度{auto_approve_limit}，需人工审批'
  END IF
ELSE
  decision = 'MANUAL'
  decision_reason = '信用等级{credit_level}或回款率{payment_rate}%不满足自动审批条件'
END IF
```

---

### 5. role_permissions（角色权限映射）

**用途**：定义每个角色的权限边界，用于自动权限分配

```sql
CREATE TABLE role_permissions (
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
```

**预定义角色权限**：
```sql
-- 财务专员：只能查看和核销，不能修改订单
INSERT INTO role_permissions (role_name, permission_key, permission_name, permission_type, resource_type) VALUES
('FINANCE', 'orders.read', '查看订单', 'READ', 'orders'),
('FINANCE', 'invoices.read', '查看发票', 'READ', 'invoices'),
('FINANCE', 'invoices.write', '创建发票', 'WRITE', 'invoices'),
('FINANCE', 'payments.read', '查看收款', 'READ', 'payments'),
('FINANCE', 'payments.write', '录入收款', 'WRITE', 'payments'),
('FINANCE', 'apply.write', '执行核销', 'WRITE', 'apply');

-- 销售员：可以创建订单，但看不到收款账号
INSERT INTO role_permissions (role_name, permission_key, permission_name, permission_type, resource_type) VALUES
('SALES', 'orders.read', '查看订单', 'READ', 'orders'),
('SALES', 'orders.write', '创建订单', 'WRITE', 'orders'),
('SALES', 'customers.read', '查看客户', 'READ', 'customers'),
('SALES', 'commission.read', '查看提成', 'READ', 'commission');

-- 营销总监：可以审批异常价格
INSERT INTO role_permissions (role_name, permission_key, permission_name, permission_type, resource_type) VALUES
('MARKETING_DIRECTOR', 'orders.read', '查看订单', 'READ', 'orders'),
('MARKETING_DIRECTOR', 'price_anomalies.approve', '审批异常价格', 'APPROVE', 'price_anomalies'),
('MARKETING_DIRECTOR', 'commission.read', '查看提成', 'READ', 'commission');
```

---

### 6. permission_change_logs（权限变更审计）

**用途**：记录所有权限变更操作，防止权限滥用

```sql
CREATE TABLE permission_change_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '用户ID',
  user_name VARCHAR(255) NOT NULL COMMENT '用户姓名',
  old_role VARCHAR(50) COMMENT '旧角色',
  new_role VARCHAR(50) NOT NULL COMMENT '新角色',
  old_permissions TEXT COMMENT '旧权限列表（JSON）',
  new_permissions TEXT NOT NULL COMMENT '新权限列表（JSON）',
  changed_by INT NOT NULL COMMENT '操作人ID',
  changed_by_name VARCHAR(255) NOT NULL COMMENT '操作人姓名',
  change_reason TEXT COMMENT '变更原因',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (user_id),
  INDEX idx_changed_by (changed_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限变更审计表';
```

---

### 7. batch_trace（生产批次追溯）

**用途**：记录每个生产批次的完整信息，用于质量追溯

```sql
CREATE TABLE batch_trace (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_no VARCHAR(50) NOT NULL UNIQUE COMMENT '批次号',
  production_date DATE NOT NULL COMMENT '生产日期',
  soybean_batch VARCHAR(50) NOT NULL COMMENT '黄豆批次号',
  soybean_supplier VARCHAR(255) NOT NULL COMMENT '黄豆供应商',
  soybean_weight DECIMAL(10, 2) NOT NULL COMMENT '黄豆投入量（kg）',
  water_quality_report VARCHAR(255) COMMENT '水质检测报告编号',
  product_output DECIMAL(10, 2) NOT NULL COMMENT '成品产出量（kg）',
  yield_rate DECIMAL(5, 2) NOT NULL COMMENT '得率（%）',
  workshop_temp DECIMAL(5, 2) COMMENT '车间温度（℃）',
  sterilization_params VARCHAR(255) COMMENT '灭菌参数',
  inspector_id INT NOT NULL COMMENT '质检员ID',
  inspector_name VARCHAR(255) NOT NULL COMMENT '质检员姓名',
  quality_status ENUM('PASS', 'FAIL') NOT NULL DEFAULT 'PASS' COMMENT '质检状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_batch_no (batch_no),
  INDEX idx_production_date (production_date),
  INDEX idx_quality_status (quality_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='生产批次追溯表';
```

---

### 8. quality_complaints（质量投诉）

**用途**：记录终端客户的质量投诉，直达CEO看板

```sql
CREATE TABLE quality_complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL COMMENT '订单ID',
  batch_no VARCHAR(50) COMMENT '批次号',
  customer_name VARCHAR(255) NOT NULL COMMENT '投诉人姓名',
  customer_phone VARCHAR(20) COMMENT '投诉人电话',
  complaint_type ENUM('QUALITY', 'SERVICE', 'DELIVERY', 'OTHER') NOT NULL COMMENT '投诉类型',
  complaint_content TEXT NOT NULL COMMENT '投诉内容',
  complaint_images TEXT COMMENT '投诉图片（JSON数组）',
  driver_id INT COMMENT '配送司机ID',
  driver_name VARCHAR(255) COMMENT '配送司机姓名',
  sales_rep_id INT COMMENT '业务员ID',
  sales_rep_name VARCHAR(255) COMMENT '业务员姓名',
  status ENUM('PENDING', 'PROCESSING', 'RESOLVED', 'CLOSED') DEFAULT 'PENDING' COMMENT '处理状态',
  assigned_to INT COMMENT '分配给（处理人ID）',
  assigned_to_name VARCHAR(255) COMMENT '处理人姓名',
  resolution TEXT COMMENT '处理结果',
  resolved_at TIMESTAMP COMMENT '处理完成时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_batch_no (batch_no),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量投诉表';
```

**关键特性**：
- 投诉不经过销售和片区，直接进入CEO看板
- 自动关联生产批次号和配送司机ID
- 支持上传投诉图片（存储为JSON数组）

---

### 9. commission_rules_v2（透明提成规则）

**用途**：白纸黑字的提成计算规则，杜绝主观评价

```sql
CREATE TABLE commission_rules_v2 (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL COMMENT '规则名称',
  rule_type ENUM('SALES_AMOUNT', 'PAYMENT_RATE', 'BAD_DEBT_DEDUCTION') NOT NULL COMMENT '规则类型',
  rule_formula TEXT NOT NULL COMMENT '计算公式（可执行的表达式）',
  rule_params JSON COMMENT '规则参数（JSON对象）',
  effective_from DATE NOT NULL COMMENT '生效日期',
  effective_to DATE COMMENT '失效日期',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_by INT NOT NULL COMMENT '创建人ID',
  created_by_name VARCHAR(255) NOT NULL COMMENT '创建人姓名',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_rule_type (rule_type),
  INDEX idx_effective_from (effective_from),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='透明提成规则表';
```

**示例规则**：
```sql
INSERT INTO commission_rules_v2 (rule_name, rule_type, rule_formula, rule_params, effective_from, created_by, created_by_name) VALUES
('基础提成', 'SALES_AMOUNT', 'paid_amount * rate', '{"rate": 0.05}', '2026-01-01', 1, 'CEO'),
('回款率加成', 'PAYMENT_RATE', 'IF(payment_rate >= 0.98, base_commission * 1.1, base_commission)', '{}', '2026-01-01', 1, 'CEO'),
('坏账扣除', 'BAD_DEBT_DEDUCTION', 'bad_debt_amount * penalty_rate', '{"penalty_rate": 0.5}', '2026-01-01', 1, 'CEO');
```

---

## 索引策略

所有表遵循以下索引原则：
1. **主键索引**：所有表使用自增INT作为主键
2. **业务唯一索引**：如batch_no、customer_id等
3. **查询索引**：根据WHERE条件创建索引（如status、created_at）
4. **关联索引**：外键字段创建索引（如order_id、customer_id）

---

## 数据保留策略

- **审计表**（audit_logs、settlement_audit、permission_change_logs）：永久保留
- **业务表**（price_anomalies、quality_complaints）：保留3年
- **日志表**（auto_approval_logs）：保留1年，超过1年归档到冷存储

---

## 下一步

1. 生成SQL迁移脚本
2. 在ops-frontend的本地数据库中执行迁移
3. 实现backend API的真实业务逻辑
4. 开发前端UI并集成真实API
5. 在6亿规模数据下进行压力测试
