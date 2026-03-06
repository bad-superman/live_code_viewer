import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ConnectionConfig } from '../core/connection-manager';

export interface WebSocketClientEvents {
  connected: () => void;
  disconnected: (error?: Error) => void;
  message: (data: any) => void;
  error: (error: Error) => void;
  latency: (latency: number) => void;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;

  constructor(private config: ConnectionConfig) {
    super();
  }

  /**
   * 连接到 WebSocket 服务器
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.config.protocol || 'ws'}://${this.config.host}:${this.config.port}`;
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          this.isConnected = true;
          this.startPing();
          this.emit('connected');
          resolve();
        });

        this.ws.on('close', (code: number, reason: string) => {
          this.isConnected = false;
          this.stopPing();
          
          const error = code !== 1000 
            ? new Error(`连接关闭: ${reason || '未知原因'}`)
            : undefined;
          
          this.emit('disconnected', error);
        });

        this.ws.on('error', (error: Error) => {
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          try {
            const message = data.toString();
            const parsedData = JSON.parse(message);
            
            // 处理 ping 响应
            if (parsedData.type === 'pong') {
              const latency = Date.now() - this.lastPingTime;
              this.emit('latency', latency);
              return;
            }
            
            this.emit('message', parsedData);
          } catch (error) {
            console.error('解析消息失败:', error);
          }
        });

      } catch (error) {
        reject(new Error(`创建 WebSocket 连接失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopPing();
    
    if (this.ws) {
      this.ws.close(1000, '正常关闭');
      this.ws = null;
    }
    
    this.isConnected = false;
  }

  /**
   * 发送消息
   */
  send(data: any): void {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket 未连接');
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
    } catch (error) {
      throw new Error(`发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * 开始发送 ping 包
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.lastPingTime = Date.now();
        this.send({ type: 'ping', timestamp: this.lastPingTime });
      }
    }, 30000); // 每30秒发送一次 ping
  }

  /**
   * 停止发送 ping 包
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // 事件类型定义
  on<K extends keyof WebSocketClientEvents>(
    event: K, 
    listener: WebSocketClientEvents[K]
  ): this {
    return super.on(event, listener);
  }

  emit<K extends keyof WebSocketClientEvents>(
    event: K, 
    ...args: Parameters<WebSocketClientEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}