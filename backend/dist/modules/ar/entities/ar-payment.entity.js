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
exports.ARPayment = void 0;
const typeorm_1 = require("typeorm");
let ARPayment = class ARPayment {
    id;
    orgId;
    customerId;
    paymentNo;
    bankRef;
    amount;
    unappliedAmount;
    paymentDate;
    paymentMethod;
    status;
    receiptUrl;
    remark;
    createdBy;
    createdAt;
    updatedAt;
    version;
};
exports.ARPayment = ARPayment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint' }),
    __metadata("design:type", Number)
], ARPayment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'org_id', type: 'int', comment: '组织ID (2=SalesCo)' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], ARPayment.prototype, "orgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'customer_id', type: 'bigint', comment: '客户ID' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], ARPayment.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'payment_no',
        type: 'varchar',
        length: 50,
        unique: true,
        comment: '收款单号',
    }),
    __metadata("design:type", String)
], ARPayment.prototype, "paymentNo", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'bank_ref',
        type: 'varchar',
        length: 100,
        unique: true,
        comment: '银行流水号',
    }),
    __metadata("design:type", String)
], ARPayment.prototype, "bankRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'amount', type: 'bigint', comment: '收款金额(分)' }),
    __metadata("design:type", Number)
], ARPayment.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'unapplied_amount',
        type: 'bigint',
        comment: '未核销金额(分)',
    }),
    __metadata("design:type", Number)
], ARPayment.prototype, "unappliedAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'payment_date', type: 'date', comment: '收款日期' }),
    __metadata("design:type", Date)
], ARPayment.prototype, "paymentDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'payment_method',
        type: 'varchar',
        length: 50,
        comment: '收款方式',
    }),
    __metadata("design:type", String)
], ARPayment.prototype, "paymentMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'status',
        type: 'enum',
        enum: ['UNAPPLIED', 'PARTIAL', 'APPLIED'],
        default: 'UNAPPLIED',
        comment: '状态: UNAPPLIED=未核销, PARTIAL=部分核销, APPLIED=已核销',
    }),
    __metadata("design:type", String)
], ARPayment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'receipt_url',
        type: 'varchar',
        length: 500,
        nullable: true,
        comment: '回单URL',
    }),
    __metadata("design:type", Object)
], ARPayment.prototype, "receiptUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'remark', type: 'text', nullable: true, comment: '备注' }),
    __metadata("design:type", Object)
], ARPayment.prototype, "remark", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'bigint', comment: '创建人ID' }),
    __metadata("design:type", Number)
], ARPayment.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        comment: '创建时间',
    }),
    __metadata("design:type", Date)
], ARPayment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        type: 'timestamp',
        comment: '更新时间',
    }),
    __metadata("design:type", Date)
], ARPayment.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)({
        name: 'version',
        type: 'int',
        default: 0,
        comment: '乐观锁版本号',
    }),
    __metadata("design:type", Number)
], ARPayment.prototype, "version", void 0);
exports.ARPayment = ARPayment = __decorate([
    (0, typeorm_1.Entity)('ar_payments'),
    (0, typeorm_1.Index)(['orgId', 'customerId']),
    (0, typeorm_1.Index)(['orgId', 'paymentDate']),
    (0, typeorm_1.Index)(['bankRef'], { unique: true })
], ARPayment);
//# sourceMappingURL=ar-payment.entity.js.map