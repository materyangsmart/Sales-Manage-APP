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
exports.ApplyPaymentDto = exports.ApplyItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ApplyItemDto {
    invoiceId;
    appliedAmount;
}
exports.ApplyItemDto = ApplyItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '应收单ID', example: 789 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ApplyItemDto.prototype, "invoiceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '核销金额（单位：分，例如 565000 表示 5650.00 元）',
        example: 565000,
    }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ApplyItemDto.prototype, "appliedAmount", void 0);
class ApplyPaymentDto {
    orgId;
    paymentId;
    applies;
    operatorId;
    remark;
}
exports.ApplyPaymentDto = ApplyPaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '组织ID (2=SalesCo)', example: 2 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ApplyPaymentDto.prototype, "orgId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '收款单ID', example: 456 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ApplyPaymentDto.prototype, "paymentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '核销明细', type: [ApplyItemDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ApplyItemDto),
    __metadata("design:type", Array)
], ApplyPaymentDto.prototype, "applies", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '操作人ID', example: 888 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ApplyPaymentDto.prototype, "operatorId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '备注', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApplyPaymentDto.prototype, "remark", void 0);
//# sourceMappingURL=apply-payment.dto.js.map