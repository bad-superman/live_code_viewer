import * as vscode from 'vscode';
import { WebSocketClient } from '../network/websocket-client';
import { ReconnectManager } from '../network/reconnect-manager';

export interface ConnectionConfig {
  host: string;
  port: number;
  protocol?: 'ws' | 'wss';
}

export interface ConnectionStatus {
  isConnected: boolean;
  isConnecting: boolean;
  lastError?: string;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  latency?: number;
}

export class ConnectionManager {
  private client: WebSocketClient | null = null;
  private reconnectManager: ReconnectManager;
  private status: ConnectionStatus = {
    isConnected: false,
    isConnecting: false,
    connectionQuality: 'disconnected'
  };
  
  private statusListeners: ((status: ConnectionStatus) => void)[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.reconnectManager = new ReconnectManager({
      maxRetries: 5,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 30000
    });
  }

  /**
   * 连接到指定地址
   */
  async connect(config: ConnectionConfig): Promise<void> {
    if (this.status.isConnecting) {
      throw new Error('正在连接中，请稍后重试');
    }

    this.updateStatus({
      isConnected: false,
      isConnecting: true,
      connectionQuality: 'disconnected'
    });

    try {
      this.client = new WebSocketClient(config);
      
      // 设置事件监听
      this.client.on('connected', () => {
        this.updateStatus({
          isConnected: true,
          isConnecting: false,
          connectionQuality: 'excellent'
        });
        this.reconnectManager.reset();
      });

      this.client.on('disconnected', (error?: Error) => {
        this.updateStatus({
          isConnected: false,
          isConnecting: false,
          lastError: error?.message,
          connectionQuality: 'disconnected'
        });
        
        // 自动重连
        this.handleAutoReconnect(config);
      });

      this.client.on('error', (error: Error) => {
        this.updateStatus({
          isConnected: false,
          isConnecting: false,
          lastError: error.message,
          connectionQuality: 'disconnected'
        });
      });

      this.client.on('latency', (latency: number) => {
        let quality: ConnectionStatus['connectionQuality'] = 'excellent';
        if (latency > 100) quality = 'good';
        if (latency > 500) quality = 'poor';
        
        this.updateStatus({
          latency,
          connectionQuality: quality
        });
      });

      await this.client.connect();
    } catch (error) {
      this.updateStatus({
        isConnected: false,
        isConnecting: false,
        lastError: error instanceof Error ? error.message : '连接失败',
        connectionQuality: 'disconnected'
      });
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.reconnectManager.cancel();
    
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    this.updateStatus({
      isConnected: false,
      isConnecting: false,
      connectionQuality: 'disconnected'
    });
  }

  /**
   * 发送消息
   */
  send(message: any): void {
    if (!this.client || !this.status.isConnected) {
      throw new Error('未连接到服务器');
    }
    
    this.client.send(message);
  }

  /**
   * 注册消息监听器
   */
  onMessage(callback: (message: any) => void): void {
    if (this.client) {
      this.client.on('message', callback);
    }
  }

  /**
   * 注册状态监听器
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.push(callback);
  }

  /**
   * 获取当前状态
   */
  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  /**
   * 处理自动重连
   */
  private async handleAutoReconnect(config: ConnectionConfig): Promise<void> {
    try {
      await this.reconnectManager.attemptReconnect(async () => {
        await this.connect(config);
      });
    } catch (error) {
      // 重连失败，显示错误信息
      vscode.window.showErrorMessage(
        `Live Code: 自动重连失败 - ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 更新状态并通知监听器
   */
  private updateStatus(updates: Partial<ConnectionStatus>): void {
    this.status = { ...this.status, ...updates };
    
    // 通知所有状态监听器
    this.statusListeners.forEach(listener => {
      try {
        listener(this.status);
      } catch (error) {
        console.error('状态监听器执行错误:', error);
      }
    });
  }

  dispose(): void {
    this.disconnect();
    this.statusListeners = [];
  }
}