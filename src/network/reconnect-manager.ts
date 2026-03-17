export interface ReconnectStrategy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export class ReconnectManager {
  private attempts: number = 0;
  private currentDelay: number;
  private isReconnecting: boolean = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private cancelled: boolean = false;

  constructor(private strategy: ReconnectStrategy) {
    this.currentDelay = strategy.initialDelay;
  }

  /**
   * 尝试重连
   */
  async attemptReconnect(connectFn: () => Promise<void>): Promise<void> {
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;
    this.cancelled = false;

    while (this.attempts < this.strategy.maxRetries && !this.cancelled) {
      try {
        console.log(`Live Code: 尝试重连 (${this.attempts + 1}/${this.strategy.maxRetries})`);
        
        await connectFn();
        
        // 连接成功
        this.reset();
        console.log('Live Code: 重连成功');
        return;
        
      } catch (error) {
        this.attempts++;
        
        if (this.attempts >= this.strategy.maxRetries) {
          // 达到最大重试次数
          console.log('Live Code: 重连失败，已达到最大重试次数');
          this.reset();
          throw new Error(`重连失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }

        // 检查是否被取消
        if (this.cancelled) {
          this.reset();
          return;
        }

        // 计算下一次重连延迟
        this.currentDelay = Math.min(
          this.currentDelay * this.strategy.backoffMultiplier,
          this.strategy.maxDelay
        );

        console.log(`Live Code: 重连失败，${this.currentDelay}ms 后重试`);
        
        // 等待延迟，但可被取消
        try {
          await new Promise<void>((resolve, reject) => {
            this.timeoutId = setTimeout(resolve, this.currentDelay);
            
            // 如果被取消，立即拒绝promise
            if (this.cancelled) {
              clearTimeout(this.timeoutId);
              this.timeoutId = null;
              reject(new Error('Cancelled'));
            }
          });
        } catch (e) {
          // 如果等待被取消，退出重连
          this.reset();
          return;
        }
        
        this.timeoutId = null;
      }
    }

    this.isReconnecting = false;
  }

  /**
   * 取消重连
   */
  cancel(): void {
    this.cancelled = true;
    this.isReconnecting = false;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * 重置重连状态
   */
  reset(): void {
    this.isReconnecting = false;
    this.cancelled = false;
    this.attempts = 0;
    this.currentDelay = this.strategy.initialDelay;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * 获取重连状态
   */
  getStatus(): {
    isReconnecting: boolean;
    attempts: number;
    currentDelay: number;
    maxRetries: number;
  } {
    return {
      isReconnecting: this.isReconnecting,
      attempts: this.attempts,
      currentDelay: this.currentDelay,
      maxRetries: this.strategy.maxRetries
    };
  }
}