import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityFeedback } from '../entities/quality-feedback.entity';
import { CreateFeedbackDto } from '../dto/feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(QualityFeedback)
    private readonly feedbackRepository: Repository<QualityFeedback>,
  ) {}

  /**
   * 提交质量评价
   */
  async create(dto: CreateFeedbackDto): Promise<QualityFeedback> {
    const feedback = this.feedbackRepository.create({
      orderId: dto.orderId,
      rating: dto.rating,
      comment: dto.comment || null,
      images: dto.images || [],
      customerName: dto.customerName || null,
      customerPhone: dto.customerPhone || null,
    } as Partial<QualityFeedback>);

    return this.feedbackRepository.save(feedback) as Promise<QualityFeedback>;
  }

  /**
   * 获取评价列表（按订单ID）
   */
  async findByOrderId(orderId: number): Promise<QualityFeedback[]> {
    return this.feedbackRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取所有评价（分页）
   */
  async findAll(params: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = params;
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.feedbackRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
