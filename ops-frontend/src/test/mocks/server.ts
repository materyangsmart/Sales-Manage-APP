import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// 创建MSW server
export const server = setupServer(...handlers);

// 在所有测试前启动server
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// 每个测试后重置handlers
afterEach(() => server.resetHandlers());

// 所有测试后关闭server
afterAll(() => server.close());
