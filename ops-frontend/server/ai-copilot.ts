/**
 * RC4 Epic 3: AI Copilot 智能中台助手
 * 
 * 核心能力：
 * 1. NL2SQL：自然语言转 SQL 查库
 * 2. AI 总结：将查询结果用 AI 生成业务洞察报表
 * 3. CEO 智能决策助手：在 BI 大屏提供问答交互
 */

import { invokeLLM } from './_core/llm';

// ============================================================
// 数据库 Schema 描述（供 AI 理解表结构）
// ============================================================

const DB_SCHEMA_DESCRIPTION = `
你是一个千张（豆制品）销售企业的数据分析助手。以下是数据库中的核心表结构：

1. orders（订单表，由后端管理）：
   - id, order_no, customer_id, customer_name, status (PENDING/APPROVED/PRODUCTION/SHIPPED/COMPLETED/REJECTED)
   - total_amount, discount_rate, final_amount, payment_method, delivery_type
   - sales_rep_id, sales_rep_name, region, created_at, updated_at

2. customers（客户表，由后端管理）：
   - id, name, contact_name, contact_phone, region, category (WET_MARKET/WHOLESALE_B/SUPERMARKET/ECOMMERCE)
   - credit_level, total_orders, total_amount

3. customer_credit_scores（客户信用评分表）：
   - customer_id, customer_name, credit_score, credit_level (S/A/B/C/D)
   - total_orders, total_amount, paid_amount, payment_rate, overdue_count

4. inventory（库存表）：
   - product_id, product_name, sku, total_stock, reserved_stock, available_stock
   - low_stock_threshold, warehouse_code

5. product_catalog（商品目录表）：
   - id, name, category (THIN/MEDIUM/THICK), specification, unit_price, unit

6. batch_trace（溯源追踪表）：
   - batch_no, production_date, soybean_supplier, soybean_weight, product_output, yield_rate, quality_status

7. billing_statements（月结对账单）：
   - customer_id, customer_name, period, total_amount, paid_amount, outstanding_amount, status

8. leads（意向线索表）：
   - company_name, contact_name, contact_phone, business_type, source, status, created_at

注意：
- 所有金额字段使用 DECIMAL 类型
- 日期字段使用 TIMESTAMP 或 DATE 类型
- 只生成 SELECT 查询，不允许 INSERT/UPDATE/DELETE
- 使用 MySQL 语法
`;

// ============================================================
// NL2SQL：自然语言转 SQL
// ============================================================

export interface NL2SQLResult {
  success: boolean;
  question: string;
  sql: string;
  queryResult: any[];
  aiSummary: string;
  executionTimeMs: number;
  error?: string;
}

export async function nl2sql(question: string): Promise<NL2SQLResult> {
  const startTime = Date.now();
  console.log(`[AI Copilot] NL2SQL request: "${question}"`);

  try {
    // Step 1: 使用 LLM 将自然语言转换为 SQL
    const sqlResponse = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `${DB_SCHEMA_DESCRIPTION}

请将用户的自然语言问题转换为 MySQL SELECT 查询语句。

规则：
1. 只返回一条 SQL 语句，不要包含任何解释
2. 只使用 SELECT 查询，禁止 INSERT/UPDATE/DELETE
3. 限制返回行数不超过 100 行（加 LIMIT 100）
4. 如果涉及时间范围但用户没有指定，默认查询最近 3 个月
5. 对于"上个月"，使用 DATE_SUB(CURDATE(), INTERVAL 1 MONTH) 到 CURDATE()
6. 对于"华东区"，使用 region LIKE '%华东%' 或 region IN ('上海','江苏','浙江','安徽','福建','江西','山东')
7. 返回的 SQL 必须是可以直接执行的，不要有占位符

只返回 SQL 语句本身，不要有 \`\`\` 标记或其他文字。`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
    });

    let generatedSQL = sqlResponse.choices[0]?.message?.content || '';
    // 清理 SQL（去除 markdown 代码块标记）
    generatedSQL = String(generatedSQL).replace(/```sql\n?/gi, '').replace(/```\n?/g, '').trim();
    
    // 安全检查：确保只有 SELECT 语句
    const upperSQL = generatedSQL.toUpperCase().trim();
    if (!upperSQL.startsWith('SELECT') && !upperSQL.startsWith('WITH')) {
      return {
        success: false,
        question,
        sql: generatedSQL,
        queryResult: [],
        aiSummary: '',
        executionTimeMs: Date.now() - startTime,
        error: '安全拦截：AI 生成了非 SELECT 语句',
      };
    }

    console.log(`[AI Copilot] Generated SQL: ${generatedSQL}`);

    // Step 2: 执行 SQL 查询
    const mysql2 = await import('mysql2/promise');
    const conn = await mysql2.createConnection(process.env.DATABASE_URL!);
    
    let queryResult: any[] = [];
    try {
      const [rows] = await conn.query(generatedSQL) as any;
      queryResult = Array.isArray(rows) ? rows : [];
      console.log(`[AI Copilot] Query returned ${queryResult.length} rows`);
    } catch (sqlError: any) {
      console.error(`[AI Copilot] SQL execution error: ${sqlError.message}`);
      // 如果 SQL 执行失败，尝试使用本地表查询
      await conn.end();
      return {
        success: false,
        question,
        sql: generatedSQL,
        queryResult: [],
        aiSummary: '',
        executionTimeMs: Date.now() - startTime,
        error: `SQL 执行失败：${sqlError.message}。可能是因为该表由后端管理，本地数据库中不存在。`,
      };
    } finally {
      await conn.end();
    }

    // Step 3: 使用 AI 总结查询结果
    const summaryResponse = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `你是一个千张销售企业的高级数据分析师。请根据用户的问题和数据库查询结果，生成一份简洁的业务洞察报告。

要求：
1. 用中文回答
2. 先给出核心结论（1-2 句话）
3. 然后列出关键数据点（用数字说话）
4. 最后给出 1-2 条可执行的建议
5. 如果数据为空，说明可能的原因
6. 格式使用 Markdown，包含适当的标题和列表`,
        },
        {
          role: 'user',
          content: `用户问题：${question}\n\nSQL 查询：${generatedSQL}\n\n查询结果（JSON）：${JSON.stringify(queryResult.slice(0, 50))}${queryResult.length > 50 ? `\n\n（共 ${queryResult.length} 条，仅展示前 50 条）` : ''}`,
        },
      ],
    });

    const aiSummary = String(summaryResponse.choices[0]?.message?.content || '暂无分析结果');

    const executionTimeMs = Date.now() - startTime;
    console.log(`[AI Copilot] NL2SQL completed in ${executionTimeMs}ms`);

    return {
      success: true,
      question,
      sql: generatedSQL,
      queryResult: queryResult.slice(0, 100),
      aiSummary,
      executionTimeMs,
    };
  } catch (error: any) {
    console.error(`[AI Copilot] Error: ${error.message}`);
    return {
      success: false,
      question,
      sql: '',
      queryResult: [],
      aiSummary: '',
      executionTimeMs: Date.now() - startTime,
      error: error.message,
    };
  }
}
