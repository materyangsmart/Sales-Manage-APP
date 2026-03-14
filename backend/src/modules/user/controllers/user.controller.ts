import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dto/user.dto';

@Controller('api/internal/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取员工列表
   * GET /api/internal/users?orgId=2&page=1&pageSize=100
   */
  @Get()
  async findAll(
    @Query('orgId') orgId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.userService.findAll({
      orgId: orgId ? parseInt(orgId) : undefined,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  /**
   * 获取职位模板列表
   * GET /api/internal/users/job-positions
   */
  @Get('job-positions')
  getJobPositions() {
    return this.userService.getJobPositions();
  }

  /**
   * 创建员工（含RBAC自动赋权）
   * POST /api/internal/users
   * Body: { orgId, username, realName, phone?, jobPosition }
   */
  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  /**
   * 删除员工
   * DELETE /api/internal/users/:id
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.userService.remove(id);
    return { success: true };
  }
}
