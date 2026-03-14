import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateARTables1704960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建 ar_invoices 表
    await queryRunner.createTable(
      new Table({
        name: 'ar_invoices',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'org_id',
            type: 'int',
            comment: '组织ID (2=SalesCo)',
          },
          {
            name: 'customer_id',
            type: 'bigint',
            comment: '客户ID',
          },
          {
            name: 'invoice_no',
            type: 'varchar',
            length: '50',
            isUnique: true,
            comment: '应收单号',
          },
          {
            name: 'order_id',
            type: 'bigint',
            isNullable: true,
            comment: '关联订单ID',
          },
          {
            name: 'amount',
            type: 'bigint',
            comment: '应收金额(分)',
          },
          {
            name: 'tax_amount',
            type: 'bigint',
            comment: '税额(分)',
          },
          {
            name: 'balance',
            type: 'bigint',
            comment: '余额(分)',
          },
          {
            name: 'due_date',
            type: 'date',
            comment: '到期日',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['OPEN', 'PARTIAL', 'CLOSED', 'WRITTEN_OFF'],
            default: "'OPEN'",
            comment: '状态',
          },
          {
            name: 'remark',
            type: 'text',
            isNullable: true,
            comment: '备注',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            comment: '创建时间',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            comment: '更新时间',
          },
          {
            name: 'version',
            type: 'int',
            default: 0,
            comment: '乐观锁版本号',
          },
        ],
      }),
      true,
    );

    // 创建索引
    await queryRunner.createIndex(
      'ar_invoices',
      new TableIndex({
        name: 'idx_ar_invoices_org_customer',
        columnNames: ['org_id', 'customer_id'],
      }),
    );

    await queryRunner.createIndex(
      'ar_invoices',
      new TableIndex({
        name: 'idx_ar_invoices_org_status',
        columnNames: ['org_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'ar_invoices',
      new TableIndex({
        name: 'idx_ar_invoices_org_due_date',
        columnNames: ['org_id', 'due_date'],
      }),
    );

    // 创建 ar_payments 表
    await queryRunner.createTable(
      new Table({
        name: 'ar_payments',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'org_id',
            type: 'int',
            comment: '组织ID (2=SalesCo)',
          },
          {
            name: 'customer_id',
            type: 'bigint',
            comment: '客户ID',
          },
          {
            name: 'payment_no',
            type: 'varchar',
            length: '50',
            isUnique: true,
            comment: '收款单号',
          },
          {
            name: 'bank_ref',
            type: 'varchar',
            length: '100',
            isUnique: true,
            comment: '银行流水号',
          },
          {
            name: 'amount',
            type: 'bigint',
            comment: '收款金额(分)',
          },
          {
            name: 'unapplied_amount',
            type: 'bigint',
            comment: '未核销金额(分)',
          },
          {
            name: 'payment_date',
            type: 'date',
            comment: '收款日期',
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '50',
            comment: '收款方式',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['UNAPPLIED', 'PARTIAL', 'APPLIED'],
            default: "'UNAPPLIED'",
            comment: '状态',
          },
          {
            name: 'receipt_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
            comment: '回单URL',
          },
          {
            name: 'remark',
            type: 'text',
            isNullable: true,
            comment: '备注',
          },
          {
            name: 'created_by',
            type: 'bigint',
            comment: '创建人ID',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            comment: '创建时间',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            comment: '更新时间',
          },
          {
            name: 'version',
            type: 'int',
            default: 0,
            comment: '乐观锁版本号',
          },
        ],
      }),
      true,
    );

    // 创建索引
    await queryRunner.createIndex(
      'ar_payments',
      new TableIndex({
        name: 'idx_ar_payments_org_customer',
        columnNames: ['org_id', 'customer_id'],
      }),
    );

    await queryRunner.createIndex(
      'ar_payments',
      new TableIndex({
        name: 'idx_ar_payments_org_date',
        columnNames: ['org_id', 'payment_date'],
      }),
    );

    // 创建 ar_apply 表
    await queryRunner.createTable(
      new Table({
        name: 'ar_apply',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'org_id',
            type: 'int',
            comment: '组织ID (2=SalesCo)',
          },
          {
            name: 'payment_id',
            type: 'bigint',
            comment: '收款单ID',
          },
          {
            name: 'invoice_id',
            type: 'bigint',
            comment: '应收单ID',
          },
          {
            name: 'applied_amount',
            type: 'bigint',
            comment: '核销金额(分)',
          },
          {
            name: 'operator_id',
            type: 'bigint',
            comment: '操作人ID',
          },
          {
            name: 'remark',
            type: 'text',
            isNullable: true,
            comment: '备注',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            comment: '创建时间',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            comment: '更新时间',
          },
          {
            name: 'version',
            type: 'int',
            default: 0,
            comment: '乐观锁版本号',
          },
        ],
      }),
      true,
    );

    // 创建索引和唯一约束
    await queryRunner.createIndex(
      'ar_apply',
      new TableIndex({
        name: 'idx_ar_apply_org_payment',
        columnNames: ['org_id', 'payment_id'],
      }),
    );

    await queryRunner.createIndex(
      'ar_apply',
      new TableIndex({
        name: 'idx_ar_apply_org_invoice',
        columnNames: ['org_id', 'invoice_id'],
      }),
    );

    await queryRunner.createIndex(
      'ar_apply',
      new TableIndex({
        name: 'idx_ar_apply_payment_invoice_unique',
        columnNames: ['payment_id', 'invoice_id'],
        isUnique: true,
      }),
    );

    // 创建 audit_logs 表
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_id',
            type: 'bigint',
            isNullable: true,
            comment: '操作用户ID',
          },
          {
            name: 'action',
            type: 'varchar',
            length: '50',
            comment: '操作类型',
          },
          {
            name: 'resource_type',
            type: 'varchar',
            length: '50',
            comment: '资源类型',
          },
          {
            name: 'resource_id',
            type: 'varchar',
            length: '100',
            comment: '资源ID',
          },
          {
            name: 'old_value',
            type: 'json',
            isNullable: true,
            comment: '旧值',
          },
          {
            name: 'new_value',
            type: 'json',
            isNullable: true,
            comment: '新值',
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'IP地址',
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
            comment: 'User Agent',
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment: '幂等键',
          },
          {
            name: 'response_data',
            type: 'json',
            isNullable: true,
            comment: '响应数据',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            comment: '创建时间',
          },
        ],
      }),
      true,
    );

    // 创建索引
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_logs_resource',
        columnNames: ['resource_type', 'resource_id'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_logs_user_time',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_logs_idempotency',
        columnNames: ['idempotency_key'],
        isUnique: true,
        where: 'idempotency_key IS NOT NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除表（按依赖关系倒序）
    await queryRunner.dropTable('audit_logs', true);
    await queryRunner.dropTable('ar_apply', true);
    await queryRunner.dropTable('ar_payments', true);
    await queryRunner.dropTable('ar_invoices', true);
  }
}
