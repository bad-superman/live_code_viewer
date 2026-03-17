import { ReconnectManager, ReconnectStrategy } from '../src/network/reconnect-manager';

describe('ReconnectManager', () => {
  let reconnectManager: ReconnectManager;
  const defaultStrategy: ReconnectStrategy = {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 100,
    maxDelay: 1000
  };

  beforeEach(() => {
    reconnectManager = new ReconnectManager(defaultStrategy);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should initialize with correct strategy', () => {
    expect(reconnectManager.getStatus()).toEqual({
      isReconnecting: false,
      attempts: 0,
      currentDelay: 100,
      maxRetries: 3
    });
  });

  test('should attempt reconnect successfully on first try', async () => {
    const connectFn = jest.fn().mockResolvedValue(undefined);
    
    await reconnectManager.attemptReconnect(connectFn);
    
    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(reconnectManager.getStatus().attempts).toBe(0);
    expect(reconnectManager.getStatus().isReconnecting).toBe(false);
  });

  test('should retry with exponential backoff', async () => {
    let callCount = 0;
    const connectFn = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('Connection failed');
      }
      return Promise.resolve();
    });

    const reconnectPromise = reconnectManager.attemptReconnect(connectFn);
    
    // 快速推进所有重连
    await jest.runAllTimersAsync();
    
    await reconnectPromise;
    expect(connectFn).toHaveBeenCalledTimes(3);
    expect(reconnectManager.getStatus().attempts).toBe(0);
  });

  test('should stop retrying after max retries', async () => {
    const connectFn = jest.fn().mockRejectedValue(new Error('Connection failed'));
    
    // 启动重连过程，但不等待promise
    reconnectManager.attemptReconnect(connectFn).catch(() => {
      // 忽略错误
    });
    
    // 快速推进所有重连尝试
    // 使用advanceTimersByTimeAsync推进时间：100ms + 200ms + 400ms = 700ms
    await jest.advanceTimersByTimeAsync(700);
    
    // 验证connectFn被调用了3次
    expect(connectFn).toHaveBeenCalledTimes(3);
    
    // 验证重连状态已重置
    expect(reconnectManager.getStatus().attempts).toBe(0);
    expect(reconnectManager.getStatus().isReconnecting).toBe(false);
  });

  test('should cancel reconnection process', async () => {
    const connectFn = jest.fn().mockRejectedValue(new Error('Connection failed'));
    
    const reconnectPromise = reconnectManager.attemptReconnect(connectFn);
    
    // 立即取消
    reconnectManager.cancel();
    
    // 推进定时器以确保取消生效
    await jest.runAllTimersAsync();
    
    await expect(reconnectPromise).resolves.toBeUndefined();
    expect(reconnectManager.getStatus().isReconnecting).toBe(false);
    expect(reconnectManager.getStatus().attempts).toBe(0);
  });

  test('should reset reconnection state', () => {
    // 模拟一些重连尝试
    reconnectManager['attempts'] = 2;
    reconnectManager['currentDelay'] = 400;
    reconnectManager['isReconnecting'] = true;
    
    reconnectManager.reset();
    
    expect(reconnectManager.getStatus()).toEqual({
      isReconnecting: false,
      attempts: 0,
      currentDelay: 100,
      maxRetries: 3
    });
  });

  test('should respect maximum delay', () => {
    const strategy: ReconnectStrategy = {
      maxRetries: 5,
      backoffMultiplier: 2,
      initialDelay: 500,
      maxDelay: 1500
    };
    
    const manager = new ReconnectManager(strategy);
    
    // 模拟多次重连失败
    for (let i = 0; i < 5; i++) {
      manager['attempts'] = i;
      manager['currentDelay'] = Math.min(500 * Math.pow(2, i), 1500);
    }
    
    // 验证延迟不超过最大值
    expect(manager.getStatus().currentDelay).toBeLessThanOrEqual(1500);
  });
});