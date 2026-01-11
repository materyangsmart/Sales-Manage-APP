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
exports.ARApply = void 0;
const typeorm_1 = require("typeorm");
let ARApply = class ARApply {
    id;
    orgId;
    paymentId;
    invoiceId;
    appliedAmount;
    operatorId;
    remark;
    createdAt;
    updatedAt;
    version;
};
exports.ARApply = ARApply;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint' }),
    __metadata("design:type", Number)
], ARApply.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'org_id', type: 'int', comment: '组织ID (2=SalesCo)' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], ARApply.prototype, "orgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'payment_id', type: 'bigint', comment: '收款单ID' }),
    __metadata("design:type", Number)
], ARApply.prototype, "paymentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_id', type: 'bigint', comment: '应收单ID' }),
    __metadata("design:type", Number)
], ARApply.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'applied_amount', type: 'bigint', comment: '核销金额(分)' }),
    __metadata("design:type", Number)
], ARApply.prototype, "appliedAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'operator_id', type: 'bigint', comment: '操作人ID' }),
    __metadata("design:type", Number)
], ARApply.prototype, "operatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'remark', type: 'text', nullable: true, comment: '备注' }),
    __metadata("design:type", Object)
], ARApply.prototype, "remark", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        comment: '创建时间',
    }),
    __metadata("design:type", Date)
], ARApply.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        type: 'timestamp',
        comment: '更新时间',
    }),
    __metadata("design:type", Date)
], ARApply.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)({
        name: 'version',
        type: 'int',
        default: 0,
        comment: '乐观锁版本号',
    }),
    __metadata("design:type", Number)
], ARApply.prototype, "version", void 0);
exports.ARApply = ARApply = __decorate([
    (0, typeorm_1.Entity)('ar_apply'),
    (0, typeorm_1.Index)(['orgId', 'paymentId']),
    (0, typeorm_1.Index)(['orgId', 'invoiceId']),
    (0, typeorm_1.Index)(['paymentId', 'invoiceId'], { unique: true })
], ARApply);
//# sourceMappingURL=ar-apply.entity.js.map