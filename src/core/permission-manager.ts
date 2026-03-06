import { Room, RoomType } from './room-manager';

export enum Permission {
  VIEW = 'view',
  EDIT = 'edit',
  MANAGE = 'manage'
}

export interface PermissionPolicy {
  roomType: RoomType;
  defaultPermissions: Permission[];
  customPermissions?: Map<string, Permission[]>;
}

export interface User {
  id: string;
  name: string;
  role: 'host' | 'viewer' | 'admin';
}

export class PermissionManager {
  private policies: Map<RoomType, PermissionPolicy> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * 初始化默认权限策略
   */
  private initializeDefaultPolicies(): void {
    // 公开房间策略
    this.policies.set('public', {
      roomType: 'public',
      defaultPermissions: [Permission.VIEW]
    });

    // 私有房间策略
    this.policies.set('private', {
      roomType: 'private',
      defaultPermissions: [Permission.VIEW]
    });

    // 邀请制房间策略
    this.policies.set('invite-only', {
      roomType: 'invite-only',
      defaultPermissions: [Permission.VIEW]
    });
  }

  /**
   * 验证用户权限
   */
  hasPermission(room: Room, user: User, permission: Permission): boolean {
    // 房间创建者拥有所有权限
    if (user.id === room.host) {
      return true;
    }

    const policy = this.policies.get(room.type);
    if (!policy) {
      return false;
    }

    // 检查默认权限
    if (policy.defaultPermissions.includes(permission)) {
      return true;
    }

    // 检查自定义权限
    if (policy.customPermissions && policy.customPermissions.has(user.id)) {
      const userPermissions = policy.customPermissions.get(user.id)!;
      return userPermissions.includes(permission);
    }

    return false;
  }

  /**
   * 获取用户在房间中的权限
   */
  getUserPermissions(room: Room, user: User): Permission[] {
    const permissions: Permission[] = [];
    
    // 房间创建者拥有所有权限
    if (user.id === room.host) {
      return Object.values(Permission);
    }

    const policy = this.policies.get(room.type);
    if (!policy) {
      return permissions;
    }

    // 添加默认权限
    permissions.push(...policy.defaultPermissions);

    // 添加自定义权限
    if (policy.customPermissions && policy.customPermissions.has(user.id)) {
      const userPermissions = policy.customPermissions.get(user.id)!;
      userPermissions.forEach(permission => {
        if (!permissions.includes(permission)) {
          permissions.push(permission);
        }
      });
    }

    return permissions;
  }

  /**
   * 设置自定义权限
   */
  setCustomPermission(roomType: RoomType, userId: string, permissions: Permission[]): void {
    const policy = this.policies.get(roomType);
    if (!policy) {
      throw new Error(`未找到房间类型策略: ${roomType}`);
    }

    if (!policy.customPermissions) {
      policy.customPermissions = new Map();
    }

    policy.customPermissions.set(userId, permissions);
  }

  /**
   * 移除自定义权限
   */
  removeCustomPermission(roomType: RoomType, userId: string): void {
    const policy = this.policies.get(roomType);
    if (!policy || !policy.customPermissions) {
      return;
    }

    policy.customPermissions.delete(userId);
  }

  /**
   * 获取房间类型策略
   */
  getPolicy(roomType: RoomType): PermissionPolicy | undefined {
    return this.policies.get(roomType);
  }

  /**
   * 更新房间类型策略
   */
  updatePolicy(roomType: RoomType, policy: Partial<PermissionPolicy>): void {
    const existingPolicy = this.policies.get(roomType);
    if (!existingPolicy) {
      throw new Error(`未找到房间类型策略: ${roomType}`);
    }

    this.policies.set(roomType, {
      ...existingPolicy,
      ...policy
    });
  }

  /**
   * 验证房间访问权限
   */
  validateRoomAccess(room: Room, user: User, password?: string): boolean {
    // 房间创建者总是可以访问
    if (user.id === room.host) {
      return true;
    }

    switch (room.type) {
      case 'public':
        return true;
      
      case 'private':
        return room.password === password;
      
      case 'invite-only':
        // 检查用户是否在参与者列表中
        return room.participants.some(p => p.id === user.id);
      
      default:
        return false;
    }
  }

  /**
   * 检查用户是否可以执行操作
   */
  canPerformAction(room: Room, user: User, action: Permission): boolean {
    return this.hasPermission(room, user, action);
  }

  /**
   * 获取所有权限策略
   */
  getAllPolicies(): Map<RoomType, PermissionPolicy> {
    return new Map(this.policies);
  }
}