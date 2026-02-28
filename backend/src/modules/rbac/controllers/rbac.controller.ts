import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RbacService } from '../services/rbac.service';
import { DataScopeService } from '../services/data-scope.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions, CurrentUser } from '../decorators/require-permissions.decorator';
import type { JwtPayload } from '../decorators/require-permissions.decorator';

@ApiTags('RBAC - 权限管理')
@Controller('rbac')
export class RbacController {
  private readonly logger = new Logger(RbacController.name);

  constructor(
    private readonly rbacService: RbacService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  /**
   * 用户登录（签发 JWT Token）
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录，返回 JWT Token' })
  async login(@Body() body: { username: string; password: string }) {
    return this.rbacService.login(body.username, body.password);
  }

  /**
   * 获取当前用户信息（需要认证）
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户信息' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return {
      userId: user.userId,
      username: user.username,
      realName: user.realName,
      orgId: user.orgId,
      roles: user.roles,
      permissions: user.permissions,
      dataScope: user.dataScope,
    };
  }

  /**
   * 获取组织树（需要认证）
   * GET /api/internal/rbac/organizations
   */
  @Get('organizations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取完整组织架构树' })
  async getOrgTree() {
    return this.rbacService.getOrgTree();
  }

  /**
   * 获取所有角色列表（需要认证）
   * GET /api/internal/rbac/roles
   */
  @Get('roles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取所有角色列表' })
  async getRoles() {
    return this.rbacService.getAllRoles();
  }

  /**
   * 获取用户列表（含角色信息，管理员权限）
   * GET /api/internal/rbac/users?orgId=2&page=1&pageSize=50
   */
  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户列表（含角色信息）' })
  async getUsers(
    @Query('orgId') orgId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rbacService.getUserList({
      orgId: orgId ? parseInt(orgId) : undefined,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50,
    });
  }

  /**
   * 更新用户所属部门（管理员权限）
   * PATCH /api/internal/rbac/users/:id/org
   */
  @Patch('users/:id/org')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新用户所属部门' })
  async updateUserOrg(
    @Param('id', ParseIntPipe) userId: number,
    @Body() body: { orgId: number },
  ) {
    await this.rbacService.updateUserOrg(userId, body.orgId);
    return { success: true, message: '部门分配成功' };
  }

  /**
   * 移除用户角色（管理员权限）
   * PATCH /api/internal/rbac/users/:id/roles/remove
   */
  @Patch('users/:id/roles/remove')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '移除用户角色' })
  async removeUserRole(
    @Param('id', ParseIntPipe) userId: number,
    @Body() body: { roleId: number },
  ) {
    await this.rbacService.removeUserRole(userId, body.roleId);
    return { success: true, message: '角色移除成功' };
  }

  /**
   * 查看某用户的数据范围描述（管理员权限）
   */
  @Get('data-scope/:userId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查看指定用户的数据范围（管理员）' })
  async getUserDataScope(@Param('userId') userId: string) {
    const info = await this.rbacService.getUserPermissionInfo(parseInt(userId));
    const scopeDesc = await this.dataScopeService.describeScope({
      userId: info.user.id,
      username: info.user.username,
      realName: info.user.realName,
      orgId: info.user.orgId,
      roles: info.roles.map((r) => r.code),
      permissions: info.permissions,
      dataScope: info.dataScope,
    });
    return {
      user: {
        id: info.user.id,
        username: info.user.username,
        realName: info.user.realName,
        orgId: info.user.orgId,
      },
      roles: info.roles.map((r) => ({ code: r.code, name: r.name, dataScope: r.dataScope })),
      permissions: info.permissions,
      dataScope: info.dataScope,
      scopeDescription: scopeDesc,
      affectedOrgIds: info.orgIds,
    };
  }

  /**
   * 为用户分配角色（管理员权限）
   */
  @Post('assign-role')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '为用户分配角色（管理员）' })
  async assignRole(@Body() body: { userId: number; roleId: number; orgId?: number }) {
    await this.rbacService.assignRole(body.userId, body.roleId, body.orgId);
    return { success: true, message: '角色分配成功' };
  }
}
