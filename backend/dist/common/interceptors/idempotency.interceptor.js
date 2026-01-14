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
exports.IdempotencyInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_1 = require("../../modules/ar/entities/audit-log.entity");
const idempotency_decorator_1 = require("../decorators/idempotency.decorator");
let IdempotencyInterceptor = class IdempotencyInterceptor {
    reflector;
    auditLogRepository;
    constructor(reflector, auditLogRepository) {
        this.reflector = reflector;
        this.auditLogRepository = auditLogRepository;
    }
    async intercept(context, next) {
        const isIdempotent = this.reflector.get(idempotency_decorator_1.IDEMPOTENCY_KEY, context.getHandler());
        if (!isIdempotent) {
            return next.handle();
        }
        const request = context.switchToHttp().getRequest();
        const idempotencyKey = request.headers['idempotency-key'];
        if (!idempotencyKey) {
            throw new common_1.BadRequestException('Missing Idempotency-Key header');
        }
        const existingLog = await this.auditLogRepository.findOne({
            where: { idempotencyKey },
        });
        if (existingLog && existingLog.responseData) {
            return (0, rxjs_1.of)(existingLog.responseData);
        }
        return next.handle().pipe((0, operators_1.tap)(async (response) => {
            await this.auditLogRepository.save({
                userId: request.user?.id || null,
                action: request.method,
                resourceType: request.url.split('/')[2] || 'unknown',
                resourceId: response.id || response.paymentNo || 'unknown',
                newValue: request.body,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
                idempotencyKey,
                responseData: response,
            });
        }));
    }
};
exports.IdempotencyInterceptor = IdempotencyInterceptor;
exports.IdempotencyInterceptor = IdempotencyInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [core_1.Reflector,
        typeorm_2.Repository])
], IdempotencyInterceptor);
//# sourceMappingURL=idempotency.interceptor.js.map