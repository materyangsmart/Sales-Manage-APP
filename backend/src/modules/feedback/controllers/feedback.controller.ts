import { Controller, Get, Post, Body, Query, ParseIntPipe } from '@nestjs/common';
import { FeedbackService } from '../services/feedback.service';
import { CreateFeedbackDto } from '../dto/feedback.dto';

@Controller('api/internal/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * 提交质量评价
   * POST /api/internal/feedback
   */
  @Post()
  async create(@Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(dto);
  }

  /**
   * 获取评价列表
   * GET /api/internal/feedback?orderId=123
   * GET /api/internal/feedback?page=1&pageSize=20
   */
  @Get()
  async findAll(
    @Query('orderId') orderId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (orderId) {
      return this.feedbackService.findByOrderId(parseInt(orderId));
    }
    return this.feedbackService.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }
}
