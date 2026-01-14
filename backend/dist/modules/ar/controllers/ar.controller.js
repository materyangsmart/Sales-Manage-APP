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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ar_service_1 = require("../services/ar.service");
const create_payment_dto_1 = require("../dto/create-payment.dto");
const apply_payment_dto_1 = require("../dto/apply-payment.dto");
const get_summary_dto_1 = require("../dto/get-summary.dto");
const list_payments_dto_1 = require("../dto/list-payments.dto");
const idempotency_decorator_1 = require("../../../common/decorators/idempotency.decorator");
const idempotency_interceptor_1 = require("../../../common/interceptors/idempotency.interceptor");
let ARController = class ARController {
    arService;
    constructor(arService) {
        this.arService = arService;
    }
    async createPayment(dto, req) {
        return this.arService.createPayment(dto, req.ip, req.headers['user-agent']);
    }
    async applyPayment(dto, req) {
        return this.arService.applyPayment(dto, req.ip, req.headers['user-agent']);
    }
    async listPayments(dto) {
        return this.arService.listPayments(dto);
    }
    async getSummary(dto) {
        return this.arService.getSummary(dto);
    }
};
exports.ARController = ARController;
__decorate([
    (0, common_1.Post)('payments'),
    (0, idempotency_decorator_1.Idempotent)(),
    (0, swagger_1.ApiOperation)({ summary: '创建收款单' }),
    (0, swagger_1.ApiHeader)({
        name: 'Idempotency-Key',
        description: '幂等性键（UUID格式，24小时内重复请求返回缓存响应）',
        required: true,
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: '收款单创建成功',
        schema: {
            example: {
                id: 1,
                paymentNo: 'PAY1704960000000ABC1',
                amount: 1130000,
                unappliedAmount: 1130000,
                status: 'UNAPPLIED',
                createdAt: '2024-01-11T06:00:00.000Z',
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '缺少幂等键或参数错误' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: '银行流水号已存在' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_payment_dto_1.CreatePaymentDto, Object]),
    __metadata("design:returntype", Promise)
], ARController.prototype, "createPayment", null);
__decorate([
    (0, common_1.Post)('apply'),
    (0, idempotency_decorator_1.Idempotent)(),
    (0, swagger_1.ApiOperation)({ summary: '核销收款' }),
    (0, swagger_1.ApiHeader)({
        name: 'Idempotency-Key',
        description: '幂等性键（UUID格式，24小时内重复请求返回缓存响应）',
        required: true,
        example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '核销成功',
        schema: {
            example: {
                paymentNo: 'PAY1704960000000ABC1',
                totalApplied: 565000,
                unappliedAmount: 565000,
                paymentStatus: 'PARTIAL',
                appliedInvoices: [
                    {
                        invoiceNo: 'INV202401001',
                        appliedAmount: 565000,
                        beforeBalance: 1130000,
                        afterBalance: 565000,
                        status: 'PARTIAL',
                    },
                ],
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '缺少幂等键、参数错误或余额不足' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '收款单或应收单不存在' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: '重复核销或并发冲突' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [apply_payment_dto_1.ApplyPaymentDto, Object]),
    __metadata("design:returntype", Promise)
], ARController.prototype, "applyPayment", null);
__decorate([
    (0, common_1.Get)('payments'),
    (0, swagger_1.ApiOperation)({ summary: '查询收款单列表' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '返回收款单列表',
        schema: {
            example: {
                items: [
                    {
                        id: 1,
                        paymentNo: 'PAY1704960000000ABC1',
                        orgId: 2,
                        customerId: 123,
                        amount: 1130000,
                        unappliedAmount: 565000,
                        status: 'PARTIAL',
                        paymentDate: '2024-01-11',
                        paymentMethod: 'BANK_TRANSFER',
                        bankRef: '20240111123456',
                        createdAt: '2024-01-11T10:30:00Z',
                    },
                ],
                total: 50,
                page: 1,
                pageSize: 20,
                totalPages: 3,
            },
        },
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_payments_dto_1.ListPaymentsDto]),
    __metadata("design:returntype", Promise)
], ARController.prototype, "listPayments", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, swagger_1.ApiOperation)({ summary: '获取AR汇总信息（账龄聚合、近到期）' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'AR汇总信息',
        schema: {
            example: {
                totalBalance: 2300000,
                overdueBalance: 800000,
                aging: {
                    current: 1500000,
                    days0to30: 500000,
                    days31to60: 200000,
                    days61to90: 100000,
                    days90plus: 0,
                },
                upcomingDue: {
                    amount: 300000,
                    count: 3,
                },
            },
        },
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_summary_dto_1.GetSummaryDto]),
    __metadata("design:returntype", Promise)
], ARController.prototype, "getSummary", null);
exports.ARController = ARController = __decorate([
    (0, swagger_1.ApiTags)('AR (应收账款)'),
    (0, common_1.Controller)('ar'),
    (0, common_1.UseInterceptors)(idempotency_interceptor_1.IdempotencyInterceptor),
    __metadata("design:paramtypes", [ar_service_1.ARService])
], ARController);
//# sourceMappingURL=ar.controller.js.map