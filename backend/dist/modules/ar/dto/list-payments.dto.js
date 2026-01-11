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
exports.ListPaymentsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ListPaymentsDto {
    orgId;
    status;
    customerId;
    dateFrom;
    dateTo;
    method;
    page = 1;
    pageSize = 20;
}
exports.ListPaymentsDto = ListPaymentsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '组织ID',
        example: 2,
        required: true,
    }),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], ListPaymentsDto.prototype, "orgId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '收款状态',
        enum: ['UNAPPLIED', 'PARTIAL', 'CLOSED'],
        required: false,
        example: 'UNAPPLIED',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['UNAPPLIED', 'PARTIAL', 'CLOSED']),
    __metadata("design:type", String)
], ListPaymentsDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '客户ID',
        required: false,
        example: 123,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], ListPaymentsDto.prototype, "customerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '开始日期（ISO8601格式，UTC时区）',
        required: false,
        example: '2024-01-01',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ListPaymentsDto.prototype, "dateFrom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '结束日期（ISO8601格式，UTC时区）',
        required: false,
        example: '2024-01-31',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ListPaymentsDto.prototype, "dateTo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '支付方式',
        enum: ['BANK_TRANSFER', 'CHECK', 'CASH', 'OTHER'],
        required: false,
        example: 'BANK_TRANSFER',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['BANK_TRANSFER', 'CHECK', 'CASH', 'OTHER']),
    __metadata("design:type", String)
], ListPaymentsDto.prototype, "method", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '页码（从1开始）',
        required: false,
        example: 1,
        default: 1,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], ListPaymentsDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '每页数量',
        required: false,
        example: 20,
        default: 20,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], ListPaymentsDto.prototype, "pageSize", void 0);
//# sourceMappingURL=list-payments.dto.js.map