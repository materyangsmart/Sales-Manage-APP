import { IsString, IsInt, IsEnum, IsOptional } from 'class-validator';
import { JobPosition } from '../entities/user.entity';

export class CreateUserDto {
  @IsInt()
  orgId: number;

  @IsString()
  username: string;

  @IsString()
  realName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(JobPosition)
  jobPosition: JobPosition;
}
