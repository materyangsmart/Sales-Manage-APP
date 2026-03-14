import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../infra/redis.module';

// Entities
import { Organization } from './entities/organization.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from '../user/entities/user.entity';

// Services
import { RbacService } from './services/rbac.service';
import { DataScopeService } from './services/data-scope.service';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

// Controllers
import { RbacController } from './controllers/rbac.controller';

/**
 * RBAC 模块（全局模块）
 *
 * @Global() 确保 RbacService、DataScopeService 在整个应用中可直接注入，
 * 无需在每个模块中重复 imports: [RbacModule]
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    RedisModule, // 提供 CacheManager 和 RedisLockService
    TypeOrmModule.forFeature([
      Organization,
      Role,
      Permission,
      RolePermission,
      UserRole,
      User,
    ]),
  ],
  controllers: [RbacController],
  providers: [
    RbacService,
    DataScopeService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    RbacService,
    DataScopeService,
    JwtAuthGuard,
    PermissionsGuard,
    TypeOrmModule,
  ],
})
export class RbacModule {}
