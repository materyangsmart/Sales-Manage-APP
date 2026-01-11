import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class OrgIsolationGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
export declare function assertSameOrg(entity: {
    orgId: number;
} | null | undefined, expectedOrgId: number): void;
