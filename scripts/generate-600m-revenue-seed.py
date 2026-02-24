#!/usr/bin/env python3
"""
生成6亿年营收的SQL种子数据脚本

业务目标：
- 年营收：600,000,000元（6亿）
- 月均营收：50,000,000元（5000万）
- 客户分布：菜市场600家，商超60家，批发商24家（总计684家）
- 订单总量：约40,000单/年
- 时间范围：2025-01-01 至 2025-12-31

数据生成策略：
1. 客户（684家）：
   - 菜市场（WET_MARKET）：600家，小额高频
   - 商超（SUPERMARKET）：60家，中额中频
   - 批发商（WHOLESALE_B）：24家，大额低频

2. 订单分布：
   - 菜市场：平均每家每月5单，单价1500元
   - 商超：平均每家每月10单，单价8000元
   - 批发商：平均每家每月15单，单价25000元

3. 批次号生成规则：
   - 格式：QZ{YYYYMMDD}{序号4位}
   - 示例：QZ202501010001
"""

import random
import datetime
import hashlib

# 配置参数
START_DATE = datetime.date(2025, 1, 1)
END_DATE = datetime.date(2025, 12, 31)
ORG_ID = 1

# 客户配置
CUSTOMER_CONFIG = {
    'WET_MARKET': {
        'count': 600,
        'orders_per_month': 5,
        'avg_order_amount': 1500,
        'variance': 0.3  # 30%波动
    },
    'SUPERMARKET': {
        'count': 60,
        'orders_per_month': 10,
        'avg_order_amount': 8000,
        'variance': 0.25
    },
    'WHOLESALE_B': {
        'count': 24,
        'orders_per_month': 15,
        'avg_order_amount': 25000,
        'variance': 0.2
    }
}

# 产品配置（千张产品）
PRODUCTS = [
    {'id': 1, 'name': '普通千张', 'unit_price': 8.5, 'weight': 1},
    {'id': 2, 'name': '有机千张', 'unit_price': 12.0, 'weight': 1},
    {'id': 3, 'name': '薄千张', 'unit_price': 9.5, 'weight': 1},
    {'id': 4, 'name': '厚千张', 'unit_price': 11.0, 'weight': 1},
]

def generate_batch_no(date: datetime.date, sequence: int) -> str:
    """生成批次号：QZ{YYYYMMDD}{序号4位}"""
    return f"QZ{date.strftime('%Y%m%d')}{sequence:04d}"

def random_date_in_month(year: int, month: int) -> datetime.date:
    """在指定月份内生成随机日期"""
    if month == 12:
        next_month = datetime.date(year + 1, 1, 1)
    else:
        next_month = datetime.date(year, month + 1, 1)
    
    days_in_month = (next_month - datetime.date(year, month, 1)).days
    random_day = random.randint(1, days_in_month)
    return datetime.date(year, month, random_day)

def generate_order_amount(category: str) -> float:
    """根据客户类型生成订单金额"""
    config = CUSTOMER_CONFIG[category]
    base = config['avg_order_amount']
    variance = config['variance']
    
    # 使用正态分布生成金额
    amount = random.gauss(base, base * variance)
    return max(500, round(amount, 2))  # 最小500元

def generate_customers():
    """生成客户数据SQL"""
    sql_lines = []
    sql_lines.append("-- 插入客户数据（684家）")
    sql_lines.append("INSERT INTO customers (id, org_id, name, category, contact, phone, address, created_at, updated_at) VALUES")
    
    customer_id = 1
    values = []
    
    for category, config in CUSTOMER_CONFIG.items():
        for i in range(config['count']):
            if category == 'WET_MARKET':
                name = f"菜市场-{customer_id:04d}"
                contact = f"摊主{customer_id}"
            elif category == 'SUPERMARKET':
                name = f"商超-{customer_id:04d}"
                contact = f"采购经理{customer_id}"
            else:  # WHOLESALE_B
                name = f"批发商-{customer_id:04d}"
                contact = f"负责人{customer_id}"
            
            phone = f"138{random.randint(10000000, 99999999)}"
            address = f"地址{customer_id}"
            created_at = START_DATE.strftime('%Y-%m-%d %H:%M:%S')
            
            values.append(
                f"({customer_id}, {ORG_ID}, '{name}', '{category}', '{contact}', '{phone}', '{address}', '{created_at}', '{created_at}')"
            )
            customer_id += 1
    
    sql_lines.append(",\n".join(values) + ";")
    sql_lines.append("")
    
    return "\n".join(sql_lines), customer_id - 1

def generate_orders_and_items(total_customers: int):
    """生成订单和订单项数据SQL"""
    sql_orders = []
    sql_items = []
    
    sql_orders.append("-- 插入订单数据")
    sql_orders.append("INSERT INTO orders (id, org_id, customer_id, order_date, status, total_amount, batch_no, created_at, updated_at) VALUES")
    
    sql_items.append("-- 插入订单项数据")
    sql_items.append("INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, subtotal, created_at, updated_at) VALUES")
    
    order_id = 1
    item_id = 1
    order_values = []
    item_values = []
    batch_sequence = {}  # 每天的批次序号
    
    # 按客户类型生成订单
    customer_id = 1
    for category, config in CUSTOMER_CONFIG.items():
        for _ in range(config['count']):
            # 为每个客户在12个月内生成订单
            for month in range(1, 13):
                orders_in_month = config['orders_per_month']
                
                for _ in range(orders_in_month):
                    order_date = random_date_in_month(2025, month)
                    order_date_str = order_date.strftime('%Y-%m-%d')
                    
                    # 生成批次号
                    if order_date_str not in batch_sequence:
                        batch_sequence[order_date_str] = 1
                    else:
                        batch_sequence[order_date_str] += 1
                    
                    batch_no = generate_batch_no(order_date, batch_sequence[order_date_str])
                    
                    # 生成订单金额
                    target_amount = generate_order_amount(category)
                    
                    # 随机选择1-3种产品
                    num_products = random.randint(1, 3)
                    selected_products = random.sample(PRODUCTS, num_products)
                    
                    # 计算每个产品的数量，使总金额接近目标金额
                    total_amount = 0
                    order_items = []
                    
                    for product in selected_products:
                        # 根据产品价格和目标金额计算数量
                        quantity = int(target_amount / (len(selected_products) * product['unit_price']))
                        quantity = max(10, quantity)  # 最少10件
                        
                        subtotal = round(quantity * product['unit_price'], 2)
                        total_amount += subtotal
                        
                        order_items.append({
                            'product_id': product['id'],
                            'quantity': quantity,
                            'unit_price': product['unit_price'],
                            'subtotal': subtotal
                        })
                    
                    total_amount = round(total_amount, 2)
                    
                    # 订单状态：80%已履行，20%待履行
                    status = 'FULFILLED' if random.random() < 0.8 else 'APPROVED'
                    
                    created_at = f"{order_date_str} {random.randint(8, 17):02d}:{random.randint(0, 59):02d}:00"
                    
                    # 插入订单
                    order_values.append(
                        f"({order_id}, {ORG_ID}, {customer_id}, '{order_date_str}', '{status}', {total_amount}, '{batch_no}', '{created_at}', '{created_at}')"
                    )
                    
                    # 插入订单项
                    for item in order_items:
                        item_values.append(
                            f"({item_id}, {order_id}, {item['product_id']}, {item['quantity']}, {item['unit_price']}, {item['subtotal']}, '{created_at}', '{created_at}')"
                        )
                        item_id += 1
                    
                    order_id += 1
            
            customer_id += 1
    
    sql_orders.append(",\n".join(order_values) + ";")
    sql_orders.append("")
    
    sql_items.append(",\n".join(item_values) + ";")
    sql_items.append("")
    
    return "\n".join(sql_orders), "\n".join(sql_items), order_id - 1

def main():
    """主函数：生成完整的SQL文件"""
    print("开始生成6亿营收种子数据SQL...")
    
    # 生成SQL文件头部
    output = []
    output.append("-- ============================================")
    output.append("-- 6亿年营收种子数据SQL脚本")
    output.append("-- 生成时间：" + datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    output.append("-- ============================================")
    output.append("")
    output.append("-- 清理旧数据")
    output.append("SET FOREIGN_KEY_CHECKS = 0;")
    output.append("TRUNCATE TABLE order_items;")
    output.append("TRUNCATE TABLE orders;")
    output.append("TRUNCATE TABLE customers;")
    output.append("SET FOREIGN_KEY_CHECKS = 1;")
    output.append("")
    
    # 生成客户数据
    print("生成客户数据...")
    customers_sql, total_customers = generate_customers()
    output.append(customers_sql)
    
    # 生成订单和订单项数据
    print("生成订单和订单项数据...")
    orders_sql, items_sql, total_orders = generate_orders_and_items(total_customers)
    output.append(orders_sql)
    output.append(items_sql)
    
    # 写入文件
    output_file = '/home/ubuntu/ops-frontend/scripts/seed-600m-revenue.sql'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(output))
    
    print(f"\n✅ SQL文件生成完成：{output_file}")
    print(f"📊 统计信息：")
    print(f"   - 客户总数：{total_customers}")
    print(f"   - 订单总数：{total_orders}")
    print(f"   - 预计年营收：约6亿元")
    print(f"\n💡 导入命令：")
    print(f"   mysql -u root -p qianzhang_sales < {output_file}")

if __name__ == '__main__':
    main()
