"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARInvoice = void 0;
const typeorm_1 = require("typeorm");
let ARInvoice = class ARInvoice {
    id;
    orgId;
    customerId;
    invoiceNo;
    orderId;
    amount;
    taxAmount;
    balance;
    dueDate;
    status;
    remark;
    createdAt;
    updatedAt;
    version;
};
exports.ARInvoice = ARInvoice;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint' }),
    __metadata("design:type", Number)
], ARInvoice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'org_id', type: 'int', comment: '组织ID (2=SalesCo)' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], ARInvoice.prototype, "orgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'customer_id', type: 'bigint', comment: '客户ID' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], ARInvoice.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'invoice_no',
        type: 'varchar',
        length: 50,
        unique: true,
        comment: '应收单号',
    }),
    __metadata("design:type", String)
], ARInvoice.prototype, "invoiceNo", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'order_id',
        type: 'bigint',
        nullable: true,
        comment: '关联订单ID',
    }),
    __metadata("design:type", Object)
], ARInvoice.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'amount', type: 'bigint', comment: '应收金额(分)' }),
    __metadata("design:type", Number)
], ARInvoice.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tax_amount', type: 'bigint', comment: '税额(分)' }),
    __metadata("design:type", Number)
], ARInvoice.prototype, "taxAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'balance', type: 'bigint', comment: '余额(分)' }),
    __metadata("design:type", Number)
], ARInvoice.prototype, "balance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'due_date', type: 'date', comment: '到期日' }),
    __metadata("design:type", Date)
], ARInvoice.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'status',
        type: 'enum',
        enum: ['OPEN', 'PARTIAL', 'CLOSED', 'WRITTEN_OFF'],
        default: 'OPEN',
        comment: '状态: OPEN=未收款, PARTIAL=部分收款, CLOSED=已结清, WRITTEN_OFF=已核销',
    }),
    __metadata("design:type", String)
], ARInvoice.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'remark', type: 'text', nullable: true, comment: '备注' }),
    __metadata("design:type", Object)
], ARInvoice.prototype, "remark", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        comment: '创建时间',
    }),
    __metadata("design:type", Date)
], ARInvoice.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        type: 'timestamp',
        comment: '更新时间',
    }),
    __metadata("design:type", Date)
], ARInvoice.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)({
        name: 'version',
        type: 'int',
        default: 0,
        comment: '乐观锁版本号',
    }),
    __metadata("design:type", Number)
], ARInvoice.prototype, "version", void 0);
exports.ARInvoice = ARInvoice = __decorate([
    (0, typeorm_1.Entity)('ar_invoices'),
    (0, typeorm_1.Index)(['orgId', 'customerId']),
    (0, typeorm_1.Index)(['orgId', 'status']),
    (0, typeorm_1.Index)(['orgId', 'dueDate'])
], ARInvoice);
//# sourceMappingURL=ar-invoice.entity.js.map