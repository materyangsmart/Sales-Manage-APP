import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCustomerCategory1738000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'customers',
      new TableColumn({
        name: 'category',
        type: 'enum',
        enum: ['WET_MARKET', 'WHOLESALE_B', 'SUPERMARKET', 'ECOMMERCE'],
        default: "'WET_MARKET'",
        comment: '客户类型：WET_MARKET=地推型（菜市场）, WHOLESALE_B=批发商, SUPERMARKET=商超, ECOMMERCE=电商',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('customers', 'category');
  }
}
