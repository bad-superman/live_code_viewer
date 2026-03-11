import * as vscode from 'vscode';
import { EventEmitter } from 'events';

export type RoomType = 'public' | 'private' | 'invite-only';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  password?: string;
  host: string;
  participants: Participant[];
  createdAt: Date;
  isActive: boolean;
}

export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'viewer';
  joinedAt: Date;
  lastActivity: Date;
}

export interface RoomManagerEvents {
  roomCreated: (room: Room) => void;
  roomUpdated: (room: Room) => void;
  roomDeleted: (roomId: string) => void;
  participantJoined: (roomId: string, participant: Participant) => void;
  participantLeft: (roomId: string, participantId: string) => void;
}

export class RoomManager extends EventEmitter {
  private rooms: Map<string, Room> = new Map();
  private currentRoomId: string | null = null;

  constructor(private context: vscode.ExtensionContext) {
    super();
    this.loadRoomsFromStorage();
  }

  /**
   * 创建新房间
   */
  createRoom(options: {
    name: string;
    type: RoomType;
    password?: string;
  }): Room {
    const room: Room = {
      id: this.generateRoomId(),
      name: options.name,
      type: options.type,
      password: options.password,
      host: this.getCurrentUser(),
      participants: [],
      createdAt: new Date(),
      isActive: true
    };

    this.rooms.set(room.id, room);
    this.saveRoomsToStorage();
    
    this.emit('roomCreated', room);
    
    return room;
  }

  /**
   * 获取所有房间
   */
  getAllRooms(): Room[] {
    const activeRooms = Array.from(this.rooms.values())
      .filter(room => room.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // 调试日志：检查房间状态
    console.log('RoomManager: 获取房间列表', {
      totalRooms: this.rooms.size,
      activeRooms: activeRooms.length,
      rooms: activeRooms.map(room => ({
        id: room.id,
        name: room.name,
        participants: room.participants.length,
        participantIds: room.participants.map(p => p.id)
      }))
    });
    
    return activeRooms;
  }

  /**
   * 根据ID获取房间
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * 获取当前活跃房间
   */
  getCurrentRoom(): Room | undefined {
    return this.currentRoomId ? this.rooms.get(this.currentRoomId) : undefined;
  }

  /**
   * 设置当前房间
   */
  setCurrentRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`房间不存在: ${roomId}`);
    }
    
    if (!room.isActive) {
      throw new Error(`房间已关闭: ${roomId}`);
    }
    
    this.currentRoomId = roomId;
    
    // 保存当前房间到存储
    this.context.globalState.update('currentRoomId', roomId);
  }

  /**
   * 关闭房间
   */
  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.isActive = false;
      
      if (this.currentRoomId === roomId) {
        this.currentRoomId = null;
        this.context.globalState.update('currentRoomId', null);
      }
      
      this.saveRoomsToStorage();
      this.emit('roomUpdated', room);
    }
  }

  /**
   * 删除房间
   */
  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.rooms.delete(roomId);
      
      if (this.currentRoomId === roomId) {
        this.currentRoomId = null;
        this.context.globalState.update('currentRoomId', null);
      }
      
      this.saveRoomsToStorage();
      this.emit('roomDeleted', roomId);
    }
  }

  /**
   * 添加参与者
   */
  addParticipant(roomId: string, participant: Omit<Participant, 'joinedAt' | 'lastActivity'>): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`房间不存在: ${roomId}`);
    }

    const now = new Date();
    const newParticipant: Participant = {
      ...participant,
      joinedAt: now,
      lastActivity: now
    };

    // 检查是否已经存在
    const existingIndex = room.participants.findIndex(p => p.id === participant.id);
    if (existingIndex >= 0) {
      room.participants[existingIndex] = newParticipant;
    } else {
      room.participants.push(newParticipant);
    }

    this.saveRoomsToStorage();
    this.emit('participantJoined', roomId, newParticipant);
    this.emit('roomUpdated', room);
  }

  /**
   * 移除参与者
   */
  removeParticipant(roomId: string, participantId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const participantIndex = room.participants.findIndex(p => p.id === participantId);
    if (participantIndex >= 0) {
      room.participants.splice(participantIndex, 1);
      
      this.saveRoomsToStorage();
      this.emit('participantLeft', roomId, participantId);
      this.emit('roomUpdated', room);
    }
  }

  /**
   * 更新参与者活动时间
   */
  updateParticipantActivity(roomId: string, participantId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const participant = room.participants.find(p => p.id === participantId);
    if (participant) {
      participant.lastActivity = new Date();
      this.saveRoomsToStorage();
    }
  }

  /**
   * 验证房间权限
   */
  validateRoomAccess(roomId: string, password?: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || !room.isActive) {
      return false;
    }

    switch (room.type) {
      case 'public':
        return true;
      
      case 'private':
        return room.password === password;
      
      case 'invite-only':
        // 邀请制房间需要额外的验证逻辑
        // 这里暂时返回 true，后续可以扩展邀请验证
        return true;
      
      default:
        return false;
    }
  }

  /**
   * 生成唯一的房间ID
   */
  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取当前用户标识
   */
  private getCurrentUser(): string {
    // 使用机器名和用户名组合作为用户标识
    const machineName = require('os').hostname();
    const userName = require('os').userInfo().username;
    return `${userName}@${machineName}`;
  }

  /**
   * 从存储加载房间数据
   */
  private loadRoomsFromStorage(): void {
    try {
      const storedRooms = this.context.globalState.get<Room[]>('rooms', []);
      const currentRoomId = this.context.globalState.get<string | null>('currentRoomId', null);
      
      storedRooms.forEach(room => {
        // 恢复日期对象
        room.createdAt = new Date(room.createdAt);
        room.participants.forEach(participant => {
          participant.joinedAt = new Date(participant.joinedAt);
          participant.lastActivity = new Date(participant.lastActivity);
        });
        
        this.rooms.set(room.id, room);
      });
      
      this.currentRoomId = currentRoomId;
    } catch (error) {
      console.error('加载房间数据失败:', error);
    }
  }

  /**
   * 保存房间数据到存储
   */
  private saveRoomsToStorage(): void {
    try {
      const roomsToSave = Array.from(this.rooms.values());
      this.context.globalState.update('rooms', roomsToSave);
    } catch (error) {
      console.error('保存房间数据失败:', error);
    }
  }

  // 事件类型定义
  on<K extends keyof RoomManagerEvents>(
    event: K, 
    listener: RoomManagerEvents[K]
  ): this {
    return super.on(event, listener);
  }

  emit<K extends keyof RoomManagerEvents>(
    event: K, 
    ...args: Parameters<RoomManagerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  dispose(): void {
    this.removeAllListeners();
  }
}