#!/usr/bin/env python3
"""
生成6亿年营收的SQL种子数据脚本（修复版 v3）

修复内容（v3 - 完全对齐NestJS TypeORM Entity）：
1. customers表：只有name，没有customer_name；增加customer_code
2. orders表：没有batch_no和sales_rep_id；有order_no, created_by; total_amount是int（分）
3. order_items表：需要product_name和sku列；unit_price/subtotal是int（分）
4. production_plans表：对齐Entity（batch_no, product_name, planned_quantity, actual_quantity, 
   raw_material, raw_material_batch, production_date, expiry_date, quality_inspector, quality_result）
5. delivery_records表：对齐Entity（order_id, driver_id, driver_name, vehicle_no, 
   departure_time, arrival_time, temperature, status）
6. 不再CREATE TABLE（由NestJS synchronize创建），只做TRUNCATE + INSERT

业务目标：
- 年营收：600,000,000元（6亿）→ 60,000,000,000分
- 月均营收：50,000,000元（5000万）
- 客户分布：菜市场600家，商超60家，批发商24家（总计684家）
- 订单总量：约40,032单/年
- 时间范围：2025-01-01 至 2025-12-31
"""

import random
import datetime

random.seed(42)

START_DATE = datetime.date(2025, 1, 1)
END_DATE = datetime.date(2025, 12, 31)
ORG_ID = 1

CUSTOMER_CONFIG = {
    'WET_MARKET': {
        'count': 600,
        'orders_per_month': 4,
        'avg_order_amount_fen': 360000,  # 3600元 = 360000分
        'variance': 0.3
    },
    'SUPERMARKET': {
        'count': 60,
        'orders_per_month': 8,
        'avg_order_amount_fen': 2300000,  # 23000元 = 2300000分
        'variance': 0.25
    },
    'WHOLESALE_B': {
        'count': 24,
        'orders_per_month': 19,
        'avg_order_amount_fen': 6700000,  # 67000元 = 6700000分
        'variance': 0.2
    }
}

# 产品配置（单价用分）
PRODUCTS = [
    {'id': 1, 'name': '普通千张', 'sku': 'QZ-PT-001', 'unit_price_fen': 850},
    {'id': 2, 'name': '有机千张', 'sku': 'QZ-YJ-002', 'unit_price_fen': 1200},
    {'id': 3, 'name': '薄千张', 'sku': 'QZ-BQ-003', 'unit_price_fen': 950},
    {'id': 4, 'name': '厚千张', 'sku': 'QZ-HQ-004', 'unit_price_fen': 1100},
]

SALES_REPS = [
    {'id': 1, 'name': '张三'},
    {'id': 2, 'name': '李四'},
    {'id': 3, 'name': '王五'},
    {'id': 4, 'name': '赵六'},
    {'id': 5, 'name': '钱七'},
    {'id': 6, 'name': '孙八'},
]

DRIVERS = [
    {'id': 101, 'name': '司机刘一', 'vehicle': '沪A12345'},
    {'id': 102, 'name': '司机陈二', 'vehicle': '沪B67890'},
    {'id': 103, 'name': '司机周三', 'vehicle': '沪C11111'},
    {'id': 104, 'name': '司机吴四', 'vehicle': '沪D22222'},
    {'id': 105, 'name': '司机郑五', 'vehicle': '沪E33333'},
]

INSPECTORS = ['质检员-王刚', '质检员-李明', '质检员-张华', '质检员-赵强']
RAW_MATERIALS = ['东北非转基因大豆', '本地有机大豆', '进口优质大豆']

def generate_order_no(date, order_id):
    return f"ORD-{date.strftime('%Y%m%d')}-{order_id:06d}"

def generate_batch_no(date, sequence):
    return f"QZ{date.strftime('%Y%m%d')}{sequence:04d}"

def random_date_in_month(year, month):
    if month == 12:
        next_month = datetime.date(year + 1, 1, 1)
    else:
        next_month = datetime.date(year, month + 1, 1)
    days_in_month = (next_month - datetime.date(year, month, 1)).days
    random_day = random.randint(1, days_in_month)
    return datetime.date(year, month, random_day)

def generate_order_amount_fen(category):
    config = CUSTOMER_CONFIG[category]
    base = config['avg_order_amount_fen']
    variance = config['variance']
    amount = random.gauss(base, base * variance)
    return max(50000, int(round(amount)))  # 最低500元=50000分


def main():
    print("开始生成6亿营收种子数据SQL（v3 - 对齐NestJS Entity）...")
    
    output = []
    output.append("-- ============================================")
    output.append("-- 6亿年营收种子数据SQL脚本（v3 - 对齐NestJS Entity）")
    output.append(f"-- 生成时间：{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output.append("-- 注意：表由NestJS TypeORM synchronize创建，此脚本只做数据填充")
    output.append("-- ============================================")
    output.append("")
    
    # ========== 清理旧数据 ==========
    output.append("-- 清理旧数据（保留表结构）")
    output.append("SET FOREIGN_KEY_CHECKS = 0;")
    output.append("DELETE FROM order_items;")
    output.append("DELETE FROM orders;")
    output.append("DELETE FROM customers;")
    output.append("DELETE FROM production_plans;")
    output.append("DELETE FROM delivery_records;")
    output.append("SET FOREIGN_KEY_CHECKS = 1;")
    output.append("")
    
    # ========== 生成客户数据 ==========
    # NestJS customers表结构: id, org_id, name, customer_code, category, contact, phone, address, remark, created_at, updated_at
    print("生成客户数据...")
    customer_values = []
    customer_id = 1
    customer_map = {}
    
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
            
            customer_code = f"C{customer_id:06d}"
            phone = f"138{random.randint(10000000, 99999999)}"
            address = f"地址{customer_id}"
            created_at = START_DATE.strftime('%Y-%m-%d %H:%M:%S')
            
            customer_values.append(
                f"({customer_id}, {ORG_ID}, '{name}', '{customer_code}', '{category}', '{contact}', '{phone}', '{address}', '{created_at}', '{created_at}')"
            )
            customer_map[customer_id] = (name, category)
            customer_id += 1
    
    total_customers = customer_id - 1
    
    output.append(f"-- 插入客户数据（{total_customers}家）")
    batch_size = 500
    for i in range(0, len(customer_values), batch_size):
        batch = customer_values[i:i+batch_size]
        output.append("INSERT INTO customers (id, org_id, name, customer_code, category, contact, phone, address, created_at, updated_at) VALUES")
        output.append(",\n".join(batch) + ";")
        output.append("")
    
    # ========== 生成订单和订单项数据 ==========
    # NestJS orders表: id, org_id, order_no, customer_id, total_amount(int/分), status, order_date, 
    #   delivery_address, delivery_date, remark, created_by(int), reviewed_by, reviewed_at, 
    #   review_comment, fulfilled_by, fulfilled_at, created_at, updated_at
    # NestJS order_items表: id, order_id, product_id, product_name, sku, unit_price(int/分), 
    #   quantity, subtotal(int/分), remark, created_at, updated_at
    print("生成订单和订单项数据...")
    order_values = []
    item_values = []
    production_plan_values = []
    delivery_record_values = []
    batch_sequence = {}
    
    order_id = 1
    item_id = 1
    pp_id = 1
    dr_id = 1
    total_revenue_fen = 0
    monthly_revenue = {}
    
    # 用于production_plans去重
    used_batch_nos = set()
    
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
                    
                    target_amount_fen = generate_order_amount_fen(category)
                    
                    num_products = random.randint(1, 3)
                    selected_products = random.sample(PRODUCTS, num_products)
                    
                    total_amount_fen = 0
                    order_items = []
                    
                    for product in selected_products:
                        quantity = int(target_amount_fen / (len(selected_products) * product['unit_price_fen']))
                        quantity = max(10, quantity)
                        subtotal_fen = quantity * product['unit_price_fen']
                        total_amount_fen += subtotal_fen
                        
                        order_items.append({
                            'product_id': product['id'],
                            'product_name': product['name'],
                            'sku': product['sku'],
                            'quantity': quantity,
                            'unit_price_fen': product['unit_price_fen'],
                            'subtotal_fen': subtotal_fen
                        })
                    
                    total_revenue_fen += total_amount_fen
                    
                    month_key = f"2025-{month:02d}"
                    monthly_revenue[month_key] = monthly_revenue.get(month_key, 0) + total_amount_fen
                    
                    r = random.random()
                    if r < 0.80:
                        status = 'FULFILLED'
                    elif r < 0.95:
                        status = 'APPROVED'
                    else:
                        status = 'PENDING_REVIEW'
                    
                    created_at = f"{order_date_str} {random.randint(8, 17):02d}:{random.randint(0, 59):02d}:00"
                    
                    # orders INSERT: id, org_id, order_no, customer_id, total_amount, status, order_date, created_by, created_at, updated_at
                    order_values.append(
                        f"({order_id}, {ORG_ID}, '{order_no}', {customer_id}, {total_amount_fen}, '{status}', '{order_date_str}', {sales_rep['id']}, '{created_at}', '{created_at}')"
                    )
                    
                    # order_items INSERT: id, order_id, product_id, product_name, sku, unit_price, quantity, subtotal, created_at, updated_at
                    for item in order_items:
                        pname = item['product_name'].replace("'", "\\'")
                        item_values.append(
                            f"({item_id}, {order_id}, {item['product_id']}, '{pname}', '{item['sku']}', {item['unit_price_fen']}, {item['quantity']}, {item['subtotal_fen']}, '{created_at}', '{created_at}')"
                        )
                        item_id += 1
                    
                    # 为FULFILLED订单生成production_plan和delivery_record
                    if status == 'FULFILLED' and batch_no not in used_batch_nos:
                        used_batch_nos.add(batch_no)
                        product = selected_products[0]
                        planned_qty = random.randint(500, 2000)
                        # 95%正常，5%偏差>2%
                        if random.random() < 0.05:
                            deviation = random.uniform(0.03, 0.10)
                            actual_qty = int(planned_qty * (1 - deviation))
                        else:
                            deviation = random.uniform(-0.02, 0.02)
                            actual_qty = int(planned_qty * (1 + deviation))
                        
                        raw_mat = random.choice(RAW_MATERIALS)
                        raw_batch = f"DL{order_date.strftime('%Y%m%d')}{random.randint(1,99):02d}"
                        expiry = order_date + datetime.timedelta(days=random.randint(30, 90))
                        inspector = random.choice(INSPECTORS)
                        qr = 'PASS' if random.random() < 0.95 else 'FAIL'
                        
                        production_plan_values.append(
                            f"({pp_id}, '{batch_no}', '{product['name']}', {planned_qty}, {actual_qty}, '{raw_mat}', '{raw_batch}', '{order_date_str}', '{expiry.strftime('%Y-%m-%d')}', '{inspector}', '{qr}', '{created_at}', '{created_at}')"
                        )
                        pp_id += 1
                        
                        # delivery_record
                        driver = random.choice(DRIVERS)
                        dep_hour = random.randint(4, 8)
                        dep_time = f"{order_date_str} {dep_hour:02d}:{random.randint(0,59):02d}:00"
                        arr_time = f"{order_date_str} {dep_hour + random.randint(1,4):02d}:{random.randint(0,59):02d}:00"
                        temp = round(random.uniform(2.0, 8.0), 1)
                        
                        delivery_record_values.append(
                            f"({dr_id}, {order_id}, {driver['id']}, '{driver['name']}', '{driver['vehicle']}', '{dep_time}', '{arr_time}', {temp}, 'DELIVERED', '{created_at}', '{created_at}')"
                        )
                        dr_id += 1
                    
                    order_id += 1
            
            customer_id += 1
    
    total_orders = order_id - 1
    total_items = item_id - 1
    total_pp = pp_id - 1
    total_dr = dr_id - 1
    
    # 分批INSERT订单
    output.append(f"-- 插入订单数据（{total_orders}笔）")
    for i in range(0, len(order_values), 1000):
        batch = order_values[i:i+1000]
        output.append("INSERT INTO orders (id, org_id, order_no, customer_id, total_amount, status, order_date, created_by, created_at, updated_at) VALUES")
        output.append(",\n".join(batch) + ";")
        output.append("")
    
    # 分批INSERT订单项
    output.append(f"-- 插入订单项数据（{total_items}条）")
    for i in range(0, len(item_values), 2000):
        batch = item_values[i:i+2000]
        output.append("INSERT INTO order_items (id, order_id, product_id, product_name, sku, unit_price, quantity, subtotal, created_at, updated_at) VALUES")
        output.append(",\n".join(batch) + ";")
        output.append("")
    
    # 分批INSERT production_plans
    output.append(f"-- 插入生产计划数据（{total_pp}条）")
    for i in range(0, len(production_plan_values), 1000):
        batch = production_plan_values[i:i+1000]
        output.append("INSERT INTO production_plans (id, batch_no, product_name, planned_quantity, actual_quantity, raw_material, raw_material_batch, production_date, expiry_date, quality_inspector, quality_result, created_at, updated_at) VALUES")
        output.append(",\n".join(batch) + ";")
        output.append("")
    
    # 分批INSERT delivery_records
    output.append(f"-- 插入配送记录数据（{total_dr}条）")
    for i in range(0, len(delivery_record_values), 1000):
        batch = delivery_record_values[i:i+1000]
        output.append("INSERT INTO delivery_records (id, order_id, driver_id, driver_name, vehicle_no, departure_time, arrival_time, temperature, status, created_at, updated_at) VALUES")
        output.append(",\n".join(batch) + ";")
        output.append("")
    
    # ========== 统计验证查询 ==========
    output.append("-- 验证查询")
    output.append("SELECT '客户总数' AS metric, COUNT(*) AS value FROM customers;")
    output.append("SELECT '订单总数' AS metric, COUNT(*) AS value FROM orders;")
    output.append("SELECT '年营收总额(分)' AS metric, SUM(total_amount) AS value FROM orders;")
    output.append("SELECT '年营收总额(元)' AS metric, FORMAT(SUM(total_amount)/100, 2) AS value FROM orders;")
    output.append("SELECT '生产计划数' AS metric, COUNT(*) AS value FROM production_plans;")
    output.append("SELECT '配送记录数' AS metric, COUNT(*) AS value FROM delivery_records;")
    output.append("SELECT '得率异动(偏差>2%)' AS metric, COUNT(*) AS value FROM production_plans WHERE ABS(actual_quantity - planned_quantity) / planned_quantity > 0.02;")
    
    # 写入文件
    output_file = '/home/ubuntu/ops-frontend/scripts/seed-600m-revenue.sql'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(output))
    
    total_revenue_yuan = total_revenue_fen / 100
    print(f"\n{'='*60}")
    print(f"SQL文件生成完成：{output_file}")
    print(f"{'='*60}")
    print(f"统计信息：")
    print(f"   客户总数：{total_customers}")
    print(f"   订单总数：{total_orders}")
    print(f"   订单项总数：{total_items}")
    print(f"   生产计划数：{total_pp}")
    print(f"   配送记录数：{total_dr}")
    print(f"   年营收总额：¥{total_revenue_yuan:,.2f}")
    print(f"   月均营收：¥{total_revenue_yuan/12:,.2f}")
    print(f"\n月度营收分布：")
    for month_key in sorted(monthly_revenue.keys()):
        print(f"   {month_key}: ¥{monthly_revenue[month_key]/100:,.2f}")
    print(f"\n导入命令：")
    print(f"   mysql -u root -p qianzhang_sales < {output_file}")

if __name__ == '__main__':
    main()
