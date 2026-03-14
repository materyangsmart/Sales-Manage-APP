import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 确保加载.env文件
// 使用 process.cwd() 而非 __dirname 以确保在编译后也能正确找到 .env 文件
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('[ENV] Warning: .env file not found or failed to load');
  console.warn('[ENV] Path:', envPath);
  console.warn('[ENV] Error:', result.error.message);
} else {
  console.log('[ENV] Successfully loaded .env file from:', envPath);
}

async function bootstrap() {
  // 打印数据库连接信息（用于排障，不打印密码）
  console.log('[DB] Connection Info:');
  console.log('  - Host:', process.env.DB_HOST || 'NOT SET');
  console.log('  - Port:', process.env.DB_PORT || 'NOT SET');
  console.log('  - Database:', process.env.DB_DATABASE || 'NOT SET');
  console.log('  - Username:', process.env.DB_USERNAME || 'NOT SET');
  console.log('  - Password:', process.env.DB_PASSWORD ? '***CONFIGURED***' : 'NOT SET');
  
  // 验证必需的环境变量
  const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    console.error('[ENV] ERROR: Missing required environment variables:', missingEnvVars.join(', '));
    console.error('[ENV] Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

    // Mock User Middleware for Development (在开发环境中模拟用户认证)
  app.use((req, res, next) => {
    // 为所有请求设置mock user
    req.user = {
      id: 1,
      username: 'dev-user',
      roles: ['ADMIN', 'OPERATOR', 'AUDITOR'], // 包含所有角色
    };
    next();
  });

  // 启用全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 配置Swagger
  const config = new DocumentBuilder()
    .setTitle('千张销售管理API')
    .setDescription('千张销售管理系统后端API文档')
    .setVersion('1.0')
    .addTag('AR', '应收账款管理')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `Swagger docs available at: http://localhost:${process.env.PORT ?? 3000}/api-docs`,
  );
}
bootstrap();
