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
exports.AuditLog = void 0;
const typeorm_1 = require("typeorm");
let AuditLog = class AuditLog {
    id;
    userId;
    action;
    resourceType;
    resourceId;
    oldValue;
    newValue;
    ipAddress;
    userAgent;
    idempotencyKey;
    responseData;
    createdAt;
};
exports.AuditLog = AuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint' }),
    __metadata("design:type", Number)
], AuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'user_id',
        type: 'bigint',
        nullable: true,
        comment: '操作用户ID',
    }),
    __metadata("design:type", Object)
], AuditLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'action', type: 'varchar', length: 50, comment: '操作类型' }),
    __metadata("design:type", String)
], AuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'resource_type',
        type: 'varchar',
        length: 50,
        comment: '资源类型',
    }),
    __metadata("design:type", String)
], AuditLog.prototype, "resourceType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'resource_id',
        type: 'varchar',
        length: 100,
        comment: '资源ID',
    }),
    __metadata("design:type", String)
], AuditLog.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'old_value', type: 'json', nullable: true, comment: '旧值' }),
    __metadata("design:type", Object)
], AuditLog.prototype, "oldValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'new_value', type: 'json', nullable: true, comment: '新值' }),
    __metadata("design:type", Object)
], AuditLog.prototype, "newValue", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ip_address',
        type: 'varchar',
        length: 50,
        nullable: true,
        comment: 'IP地址',
    }),
    __metadata("design:type", Object)
], AuditLog.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'user_agent',
        type: 'text',
        nullable: true,
        comment: 'User Agent',
    }),
    __metadata("design:type", Object)
], AuditLog.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'idempotency_key',
        type: 'varchar',
        length: 100,
        nullable: true,
        comment: '幂等键',
    }),
    __metadata("design:type", Object)
], AuditLog.prototype, "idempotencyKey", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'response_data',
        type: 'json',
        nullable: true,
        comment: '响应数据(用于幂等返回)',
    }),
    __metadata("design:type", Object)
], AuditLog.prototype, "responseData", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        comment: '创建时间',
    }),
    __metadata("design:type", Date)
], AuditLog.prototype, "createdAt", void 0);
exports.AuditLog = AuditLog = __decorate([
    (0, typeorm_1.Entity)('audit_logs'),
    (0, typeorm_1.Index)(['resourceType', 'resourceId']),
    (0, typeorm_1.Index)(['userId', 'createdAt']),
    (0, typeorm_1.Index)(['idempotencyKey'], {
        unique: true,
        where: 'idempotency_key IS NOT NULL',
    })
], AuditLog);
//# sourceMappingURL=audit-log.entity.js.map