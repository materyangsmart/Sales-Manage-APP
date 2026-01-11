"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgIsolationGuard = void 0;
exports.assertSameOrg = assertSameOrg;
const common_1 = require("@nestjs/common");
let OrgIsolationGuard = class OrgIsolationGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const userOrgId = request.user?.orgId || request.headers['x-org-id'];
        const requestOrgId = request.body?.orgId || request.query?.orgId;
        if (!userOrgId) {
            throw new common_1.ForbiddenException('未找到用户组织信息');
        }
        if (!requestOrgId) {
            throw new common_1.ForbiddenException('请求中未包含组织ID');
        }
        if (parseInt(userOrgId) !== parseInt(requestOrgId)) {
            throw new common_1.ForbiddenException('禁止跨组织操作');
        }
        return true;
    }
};
exports.OrgIsolationGuard = OrgIsolationGuard;
exports.OrgIsolationGuard = OrgIsolationGuard = __decorate([
    (0, common_1.Injectable)()
], OrgIsolationGuard);
function assertSameOrg(entity, expectedOrgId) {
    if (!entity) {
        throw new common_1.ForbiddenException('实体不存在');
    }
    if (entity.orgId !== expectedOrgId) {
        throw new common_1.ForbiddenException(`组织ID不匹配：期望 ${expectedOrgId}，实际 ${entity.orgId}`);
    }
}
//# sourceMappingURL=org-isolation.guard.js.map