-- 完整的提成规则表创建和数据种子脚本
-- 问题：数据库中不存在sales_commission_rules表
-- 解决：先创建表，然后插入所有规则数据

-- Step 1: 创建sales_commission_rules表
CREATE TABLE IF NOT EXISTS `sales_commission_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version` VARCHAR(20) NOT NULL COMMENT '规则版本，如2025-V1, 2026-V1',
  `category` ENUM('WET_MARKET', 'WHOLESALE_B', 'SUPERMARKET', 'ECOMMERCE', 'DEFAULT') NOT NULL DEFAULT 'DEFAULT' COMMENT '客户类型',
  `effectiveFrom` TIMESTAMP NOT NULL COMMENT '生效日期',
  `ruleJson` TEXT NOT NULL COMMENT '规则JSON配置',
  `createdBy` INT DEFAULT NULL COMMENT '创建人ID',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_version_category` (`version`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='销售提成规则表';

-- 验证表创建成功
SHOW CREATE TABLE sales_commission_rules\G

-- Step 2: 清空旧数据（如果有）
TRUNCATE TABLE sales_commission_rules;

-- Step 3: 插入2025-V1规则（所有客户类型）
INSERT INTO sales_commission_rules (version, category, ruleJson, effectiveFrom, createdBy, createdAt, updatedAt)
VALUES
-- 2025-V1 - 菜市场类
('2025-V1', 'WET_MARKET', 
 '{"baseRate": 0.02, "collectionWeight": 0.30, "paymentDueDays": 30, "newCustomerBonus": 10000}',
 '2025-01-01 00:00:00', 1, NOW(), NOW()),

-- 2025-V1 - 批发商类
('2025-V1', 'WHOLESALE_B',
 '{"baseRate": 0.025, "collectionWeight": 0.35, "paymentDueDays": 45, "newCustomerBonus": 12000}',
 '2025-01-01 00:00:00', 1, NOW(), NOW()),

-- 2025-V1 - 商超类
('2025-V1', 'SUPERMARKET',
 '{"baseRate": 0.03, "marginWeight": 0.60, "paymentDueDays": 60, "newCustomerBonus": 15000}',
 '2025-01-01 00:00:00', 1, NOW(), NOW()),

-- 2025-V1 - 电商类
('2025-V1', 'ECOMMERCE',
 '{"baseRate": 0.025, "collectionWeight": 0.40, "paymentDueDays": 15, "newCustomerBonus": 20000}',
 '2025-01-01 00:00:00', 1, NOW(), NOW()),

-- 2025-V1 - 默认类型
('2025-V1', 'DEFAULT',
 '{"baseRate": 0.02, "collectionWeight": 0.30, "paymentDueDays": 30, "newCustomerBonus": 10000}',
 '2025-01-01 00:00:00', 1, NOW(), NOW());


-- Step 4: 插入2026-V1规则（所有客户类型）
INSERT INTO sales_commission_rules (version, category, ruleJson, effectiveFrom, createdBy, createdAt, updatedAt)
VALUES
-- 2026-V1 - 菜市场类
('2026-V1', 'WET_MARKET',
 '{"baseRate": 0.02, "collectionWeight": 0.30, "paymentDueDays": 30, "newCustomerBonus": 10000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW()),

-- 2026-V1 - 批发商类
('2026-V1', 'WHOLESALE_B',
 '{"baseRate": 0.025, "collectionWeight": 0.35, "paymentDueDays": 45, "newCustomerBonus": 12000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW()),

-- 2026-V1 - 商超类
('2026-V1', 'SUPERMARKET',
 '{"baseRate": 0.03, "marginWeight": 0.60, "paymentDueDays": 60, "newCustomerBonus": 15000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW()),

-- 2026-V1 - 电商类
('2026-V1', 'ECOMMERCE',
 '{"baseRate": 0.025, "collectionWeight": 0.40, "paymentDueDays": 15, "newCustomerBonus": 20000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW()),

-- 2026-V1 - 默认类型
('2026-V1', 'DEFAULT',
 '{"baseRate": 0.02, "collectionWeight": 0.30, "paymentDueDays": 30, "newCustomerBonus": 10000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW());


-- Step 5: 插入2026-V2规则（所有客户类型，提成率更高）
INSERT INTO sales_commission_rules (version, category, ruleJson, effectiveFrom, createdBy, createdAt, updatedAt)
VALUES
-- 2026-V2 - 菜市场类（提高基础利率）
('2026-V2', 'WET_MARKET',
 '{"baseRate": 0.025, "collectionWeight": 0.30, "paymentDueDays": 30, "newCustomerBonus": 12000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW()),

-- 2026-V2 - 批发商类
('2026-V2', 'WHOLESALE_B',
 '{"baseRate": 0.03, "collectionWeight": 0.35, "paymentDueDays": 45, "newCustomerBonus": 15000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW()),

-- 2026-V2 - 商超类
('2026-V2', 'SUPERMARKET',
 '{"baseRate": 0.035, "marginWeight": 0.60, "paymentDueDays": 60, "newCustomerBonus": 18000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW()),

-- 2026-V2 - 电商类
('2026-V2', 'ECOMMERCE',
 '{"baseRate": 0.03, "collectionWeight": 0.40, "paymentDueDays": 15, "newCustomerBonus": 25000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW()),

-- 2026-V2 - 默认类型
('2026-V2', 'DEFAULT',
 '{"baseRate": 0.025, "collectionWeight": 0.30, "paymentDueDays": 30, "newCustomerBonus": 12000}',
 '2026-01-01 00:00:00', 1, NOW(), NOW());

-- Step 6: 验证插入结果
SELECT version, category, JSON_EXTRACT(ruleJson, '$.baseRate') as baseRate 
FROM sales_commission_rules 
ORDER BY version, category;

-- Step 7: 统计
SELECT version, COUNT(*) as rule_count 
FROM sales_commission_rules 
GROUP BY version;

-- 期望输出：
-- +----------+------------+
-- | version  | rule_count |
-- +----------+------------+
-- | 2025-V1  |          5 |
-- | 2026-V1  |          5 |
-- | 2026-V2  |          5 |
-- +----------+------------+
