#!/usr/bin/env python3
"""
生成6亿年营收的SQL种子数据脚本（修复版 v2）

修复内容：
1. customers表同时填充 name 和 customer_name 字段（满足非空约束）
2. orders表增加 order_no 字段
3. 自动创建 production_plans 等支撑表
4. 调整订单数量至约 39,996 笔
5. 确保月均营收约 5000万

业务目标：
- 年营收：600,000,000元（6亿）
- 月均营收：50,000,000元（5000万）
- 客户分布：菜市场600家，商超60家，批发商24家（总计684家）
- 订单总量：约39,996单/年（精确控制）
- 时间范围：2025-01-01 至 2025-12-31
"""

import random
import datetime

# 固定随机种子，确保可复现
random.seed(42)

# 配置参数
START_DATE = datetime.date(2025, 1, 1)
END_DATE = datetime.date(2025, 12, 31)
ORG_ID = 1

# 客户配置 - 调整订单频率和金额使总量约39996、年营收约6亿
# 菜市场600家 * 4单/月 * 12月 = 28800, 均价3500 → 1.008亿
# 商超60家 * 8单/月 * 12月 = 5760, 均价22000 → 1.267亿
# 批发商24家 * 19单/月 * 12月 = 5472, 均价65000 → 3.557亿
# 总计订单 = 40032, 年营收 ≈ 5.83亿 + 波动 ≈ 6亿
CUSTOMER_CONFIG = {
    'WET_MARKET': {
        'count': 600,
        'orders_per_month': 4,
        'avg_order_amount': 3600,
        'variance': 0.3
    },
    'SUPERMARKET': {
        'count': 60,
        'orders_per_month': 8,
        'avg_order_amount': 23000,
        'variance': 0.25
    },
    'WHOLESALE_B': {
        'count': 24,
        'orders_per_month': 19,
        'avg_order_amount': 67000,
        'variance': 0.2
    }
}

# 产品配置（千张产品）
PRODUCTS = [
    {'id': 1, 'name': '普通千张', 'unit_price': 8.5},
    {'id': 2, 'name': '有机千张', 'unit_price': 12.0},
    {'id': 3, 'name': '薄千张', 'unit_price': 9.5},
    {'id': 4, 'name': '厚千张', 'unit_price': 11.0},
]

# 销售员配置
SALES_REPS = [
    {'id': 1, 'name': '张三'},
    {'id': 2, 'name': '李四'},
    {'id': 3, 'name': '王五'},
    {'id': 4, 'name': '赵六'},
    {'id': 5, 'name': '钱七'},
    {'id': 6, 'name': '孙八'},
]

def generate_batch_no(date, sequence):
    return f"QZ{date.strftime('%Y%m%d')}{sequence:04d}"

def generate_order_no(date, order_id):
    return f"ORD-{date.strftime('%Y%m%d')}-{order_id:06d}"

def random_date_in_month(year, month):
    if month == 12:
        next_month = datetime.date(year + 1, 1, 1)
    else:
        next_month = datetime.date(year, month + 1, 1)
    days_in_month = (next_month - datetime.date(year, month, 1)).days
    random_day = random.randint(1, days_in_month)
    return datetime.date(year, month, random_day)

def generate_order_amount(category):
    config = CUSTOMER_CONFIG[category]
    base = config['avg_order_amount']
    variance = config['variance']
    amount = random.gauss(base, base * variance)
    return max(500, round(amount, 2))


def main():
    print("开始生成6亿营收种子数据SQL（修复版 v2）...")
    
    output = []
    output.append("-- ============================================")
    output.append("-- 6亿年营收种子数据SQL脚本（修复版 v2）")
    output.append(f"-- 生成时间：{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output.append("-- 修复：customer_name字段、order_no字段、production_plans表")
    output.append("-- ============================================")
    output.append("")
    
    # ========== 创建支撑表（如果不存在） ==========
    output.append("-- 创建支撑表（如果不存在）")
    output.append("""
CREATE TABLE IF NOT EXISTS production_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL DEFAULT 1,
  plan_no VARCHAR(50) NOT NULL,
  plan_date DATE NOT NULL,
  batch_no VARCHAR(50) NOT NULL,
  product_id INT NOT NULL,
  planned_quantity INT NOT NULL DEFAULT 0,
  actual_quantity INT DEFAULT 0,
  status ENUM('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNED',
  workshop VARCHAR(100) DEFAULT NULL,
  soybean_batch VARCHAR(100) DEFAULT NULL,
  water_quality VARCHAR(100) DEFAULT NULL,
  workshop_temp DECIMAL(5,2) DEFAULT NULL,
  sterilization_params VARCHAR(200) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_batch_no (batch_no),
  INDEX idx_plan_date (plan_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

    output.append("""
CREATE TABLE IF NOT EXISTS delivery_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL DEFAULT 1,
  order_id INT NOT NULL,
  batch_no VARCHAR(50) NOT NULL,
  driver_id INT DEFAULT NULL,
  driver_name VARCHAR(100) DEFAULT NULL,
  driver_phone VARCHAR(20) DEFAULT NULL,
  picking_time DATETIME DEFAULT NULL,
  shipping_time DATETIME DEFAULT NULL,
  delivery_time DATETIME DEFAULT NULL,
  status ENUM('PICKING','SHIPPING','DELIVERED') NOT NULL DEFAULT 'PICKING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

    output.append("""
CREATE TABLE IF NOT EXISTS credit_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  score INT NOT NULL DEFAULT 600,
  grade ENUM('S','A','B','C','D') NOT NULL DEFAULT 'B',
  auto_approve_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
  overdue_count INT NOT NULL DEFAULT 0,
  total_orders INT NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  last_calculated_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

    output.append("""
CREATE TABLE IF NOT EXISTS commission_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL DEFAULT 1,
  version VARCHAR(20) NOT NULL,
  category ENUM('WET_MARKET','WHOLESALE_B','SUPERMARKET','ECOMMERCE','DEFAULT') NOT NULL DEFAULT 'DEFAULT',
  rule_json JSON NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_version (version),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

    # ========== 清理旧数据 ==========
    output.append("-- 清理旧数据")
    output.append("SET FOREIGN_KEY_CHECKS = 0;")
    output.append("TRUNCATE TABLE order_items;")
    output.append("TRUNCATE TABLE orders;")
    output.append("TRUNCATE TABLE customers;")
    output.append("DELETE FROM production_plans;")
    output.append("DELETE FROM delivery_records;")
    output.append("DELETE FROM credit_scores;")
    output.append("DELETE FROM commission_rules;")
    output.append("SET FOREIGN_KEY_CHECKS = 1;")
    output.append("")
    
    # ========== 生成客户数据 ==========
    print("生成客户数据...")
    customer_values = []
    customer_id = 1
    customer_map = {}  # id -> (name, category)
    
    for category, config in CUSTOMER_CONFIG.items():
        for i in range(config['count']):
            if category == 'WET_MARKET':
                name = f"菜市场-{customer_id:04d}"
                contact = f"摊主{customer_id}"
            elif category == 'SUPERMARKET':
                name = f"商超-{customer_id:04d}"
                contact = f"采购经理{customer_id}"
            else:
                name = f"批发商-{customer_id:04d}"
                contact = f"负责人{customer_id}"
            
            phone = f"138{random.randint(10000000, 99999999)}"
            address = f"地址{customer_id}"
            created_at = START_DATE.strftime('%Y-%m-%d %H:%M:%S')
            
            # 同时填充 name 和 customer_name 字段
            customer_values.append(
                f"({customer_id}, {ORG_ID}, '{name}', '{name}', '{category}', '{contact}', '{phone}', '{address}', '{created_at}', '{created_at}')"
            )
            customer_map[customer_id] = (name, category)
            customer_id += 1
    
    total_customers = customer_id - 1
    
    # 分批INSERT（每500条一批，避免SQL过长）
    output.append(f"-- 插入客户数据（{total_customers}家）")
    batch_size = 500
    for i in range(0, len(customer_values), batch_size):
        batch = customer_values[i:i+batch_size]
        output.append("INSERT INTO customers (id, org_id, name, customer_name, category, contact, phone, address, created_at, updated_at) VALUES")
        output.append(",\n".join(batch) + ";")
        output.append("")
    
    # ========== 生成订单和订单项数据 ==========
    print("生成订单和订单项数据...")
    order_values = []
    item_values = []
    batch_sequence = {}
    
    order_id = 1
    item_id = 1
    total_revenue = 0
    monthly_revenue = {}
    
    customer_id = 1
    for category, config in CUSTOMER_CONFIG.items():
        for _ in range(config['count']):
            sales_rep = random.choice(SALES_REPS)
            
            for month in range(1, 13):
                orders_in_month = config['orders_per_month']
                
                for _ in range(orders_in_month):
                    order_date = random_date_in_month(2025, month)
                    order_date_str = order_date.strftime('%Y-%m-%d')
                    
                    if order_date_str not in batch_sequence:
                        batch_sequence[order_date_str] = 1
                    else:
                        batch_sequence[order_date_str] += 1
                    
                    batch_no = generate_batch_no(order_date, batch_sequence[order_date_str])
                    order_no = generate_order_no(order_date, order_id)
                    
                    target_amount = generate_order_amount(category)
                    
                    num_products = random.randint(1, 3)
                    selected_products = random.sample(PRODUCTS, num_products)
                    
                    total_amount = 0
                    order_items = []
                    
                    for product in selected_products:
                        quantity = int(target_amount / (len(selected_products) * product['unit_price']))
                        quantity = max(10, quantity)
                        subtotal = round(quantity * product['unit_price'], 2)
                        total_amount += subtotal
                        
                        order_items.append({
                            'product_id': product['id'],
                            'quantity': quantity,
                            'unit_price': product['unit_price'],
                            'subtotal': subtotal
                        })
                    
                    total_amount = round(total_amount, 2)
                    total_revenue += total_amount
                    
                    month_key = f"2025-{month:02d}"
                    monthly_revenue[month_key] = monthly_revenue.get(month_key, 0) + total_amount
                    
                    # 80%已履行，15%已审核，5%待审核
                    r = random.random()
                    if r < 0.80:
                        status = 'FULFILLED'
                    elif r < 0.95:
                        status = 'APPROVED'
                    else:
                        status = 'PENDING_REVIEW'
                    
                    created_at = f"{order_date_str} {random.randint(8, 17):02d}:{random.randint(0, 59):02d}:00"
                    
                    order_values.append(
                        f"({order_id}, {ORG_ID}, {customer_id}, '{order_no}', '{order_date_str}', '{status}', {total_amount}, '{batch_no}', {sales_rep['id']}, '{created_at}', '{created_at}')"
                    )
                    
                    for item in order_items:
                        item_values.append(
                            f"({item_id}, {order_id}, {item['product_id']}, {item['quantity']}, {item['unit_price']}, {item['subtotal']}, '{created_at}', '{created_at}')"
                        )
                        item_id += 1
                    
                    order_id += 1
            
            customer_id += 1
    
    total_orders = order_id - 1
    total_items = item_id - 1
    
    # 分批INSERT订单（每1000条一批）
    output.append(f"-- 插入订单数据（{total_orders}笔）")
    for i in range(0, len(order_values), 1000):
        batch = order_values[i:i+1000]
        output.append("INSERT INTO orders (id, org_id, customer_id, order_no, order_date, status, total_amount, batch_no, sales_rep_id, created_at, updated_at) VALUES")
        output.append(",\n".join(batch) + ";")
        output.append("")
    
    # 分批INSERT订单项（每2000条一批）
    output.append(f"-- 插入订单项数据（{total_items}条）")
    for i in range(0, len(item_values), 2000):
        batch = item_values[i:i+2000]
        output.append("INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, subtotal, created_at, updated_at) VALUES")
        output.append(",\n".join(batch) + ";")
        output.append("")
    
    # ========== 生成提成规则 ==========
    output.append("-- 插入提成规则")
    output.append("""INSERT INTO commission_rules (org_id, version, category, rule_json, effective_from, is_active) VALUES
(1, '2025-V1', 'DEFAULT', '{"baseRate": "0.02", "newCustomerBonus": "500", "overdueDeduction": "0.005", "tiers": [{"min": 0, "max": 500000, "rate": "0.02"}, {"min": 500000, "max": 1000000, "rate": "0.025"}, {"min": 1000000, "max": null, "rate": "0.03"}]}', '2025-01-01', 1),
(1, '2025-V1', 'WET_MARKET', '{"baseRate": "0.02", "newCustomerBonus": "300", "overdueDeduction": "0.005", "tiers": [{"min": 0, "max": 300000, "rate": "0.02"}, {"min": 300000, "max": null, "rate": "0.025"}]}', '2025-01-01', 1),
(1, '2025-V1', 'SUPERMARKET', '{"baseRate": "0.015", "newCustomerBonus": "800", "overdueDeduction": "0.003", "tiers": [{"min": 0, "max": 1000000, "rate": "0.015"}, {"min": 1000000, "max": null, "rate": "0.02"}]}', '2025-01-01', 1),
(1, '2025-V1', 'WHOLESALE_B', '{"baseRate": "0.01", "newCustomerBonus": "1000", "overdueDeduction": "0.002", "tiers": [{"min": 0, "max": 2000000, "rate": "0.01"}, {"min": 2000000, "max": null, "rate": "0.015"}]}', '2025-01-01', 1);
""")
    
    # ========== 生成信用评分 ==========
    print("生成信用评分数据...")
    credit_values = []
    customer_id = 1
    for category, config in CUSTOMER_CONFIG.items():
        for _ in range(config['count']):
            # 根据客户类型分配信用等级
            r = random.random()
            if category == 'WHOLESALE_B':
                if r < 0.5: grade, score = 'S', random.randint(850, 950)
                elif r < 0.85: grade, score = 'A', random.randint(750, 849)
                else: grade, score = 'B', random.randint(650, 749)
            elif category == 'SUPERMARKET':
                if r < 0.3: grade, score = 'S', random.randint(850, 950)
                elif r < 0.7: grade, score = 'A', random.randint(750, 849)
                elif r < 0.9: grade, score = 'B', random.randint(650, 749)
                else: grade, score = 'C', random.randint(500, 649)
            else:  # WET_MARKET
                if r < 0.1: grade, score = 'S', random.randint(850, 950)
                elif r < 0.4: grade, score = 'A', random.randint(750, 849)
                elif r < 0.7: grade, score = 'B', random.randint(650, 749)
                elif r < 0.9: grade, score = 'C', random.randint(500, 649)
                else: grade, score = 'D', random.randint(300, 499)
            
            limits = {'S': 100000, 'A': 50000, 'B': 20000, 'C': 5000, 'D': 0}
            overdue = random.randint(0, 3) if grade in ('C', 'D') else 0
            total_orders_c = config['orders_per_month'] * 12
            total_amount_c = config['avg_order_amount'] * total_orders_c
            
            credit_values.append(
                f"({customer_id}, {score}, '{grade}', {limits[grade]}, {overdue}, {total_orders_c}, {total_amount_c}, NOW())"
            )
            customer_id += 1
    
    output.append("-- 插入信用评分数据")
    for i in range(0, len(credit_values), 500):
        batch = credit_values[i:i+500]
        output.append("INSERT INTO credit_scores (customer_id, score, grade, auto_approve_limit, overdue_count, total_orders, total_amount, last_calculated_at) VALUES")
        output.append(",\n".join(batch) + ";")
        output.append("")
    
    # ========== 性能索引 ==========
    output.append("-- 性能索引（如果不存在）")
    output.append("""
CREATE INDEX IF NOT EXISTS idx_orders_org_status ON orders(org_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders(customer_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_batch_no ON orders(batch_no);
CREATE INDEX IF NOT EXISTS idx_orders_sales_rep ON orders(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_orders_date_amount ON orders(order_date, total_amount);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_customers_org_category ON customers(org_id, category);
""")
    
    # ========== 统计验证查询 ==========
    output.append("-- 验证查询")
    output.append("SELECT '客户总数' AS metric, COUNT(*) AS value FROM customers;")
    output.append("SELECT '订单总数' AS metric, COUNT(*) AS value FROM orders;")
    output.append("SELECT '年营收总额' AS metric, FORMAT(SUM(total_amount), 2) AS value FROM orders;")
    output.append("SELECT '月均营收' AS metric, FORMAT(AVG(monthly_total), 2) AS value FROM (SELECT DATE_FORMAT(order_date, '%Y-%m') AS month, SUM(total_amount) AS monthly_total FROM orders GROUP BY month) AS t;")
    output.append("SELECT '信用评分总数' AS metric, COUNT(*) AS value FROM credit_scores;")
    
    # 写入文件
    output_file = '/home/ubuntu/ops-frontend/scripts/seed-600m-revenue.sql'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(output))
    
    print(f"\n{'='*60}")
    print(f"SQL文件生成完成：{output_file}")
    print(f"{'='*60}")
    print(f"统计信息：")
    print(f"   客户总数：{total_customers}")
    print(f"   订单总数：{total_orders}")
    print(f"   订单项总数：{total_items}")
    print(f"   年营收总额：¥{total_revenue:,.2f}")
    print(f"   月均营收：¥{total_revenue/12:,.2f}")
    print(f"\n月度营收分布：")
    for month_key in sorted(monthly_revenue.keys()):
        print(f"   {month_key}: ¥{monthly_revenue[month_key]:,.2f}")
    print(f"\n导入命令：")
    print(f"   mysql -u root -p qianzhang_sales < {output_file}")

if __name__ == '__main__':
    main()
