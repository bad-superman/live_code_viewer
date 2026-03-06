import { PermissionManager, Permission, User } from '../src/core/permission-manager';

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;
  let hostUser: User;
  let viewerUser: User;
  let adminUser: User;

  beforeEach(() => {
    permissionManager = new PermissionManager();
    
    hostUser = {
      id: 'host-123',
      name: 'Host User',
      role: 'host'
    };

    viewerUser = {
      id: 'viewer-456',
      name: 'Viewer User', 
      role: 'viewer'
    };

    adminUser = {
      id: 'admin-789',
      name: 'Admin User',
      role: 'admin'
    };
  });

  test('should initialize with default policies', () => {
    const policies = permissionManager.getAllPolicies();
    
    expect(policies.size).toBe(3);
    expect(policies.get('public')).toBeDefined();
    expect(policies.get('private')).toBeDefined();
    expect(policies.get('invite-only')).toBeDefined();
  });

  test('host should have all permissions', () => {
    const room = {
      id: 'room-1',
      name: 'Test Room',
      type: 'public' as const,
      host: 'host-123',
      participants: [],
      createdAt: new Date(),
      isActive: true
    };

    expect(permissionManager.hasPermission(room, hostUser, Permission.VIEW)).toBe(true);
    expect(permissionManager.hasPermission(room, hostUser, Permission.EDIT)).toBe(true);
    expect(permissionManager.hasPermission(room, hostUser, Permission.MANAGE)).toBe(true);
  });

  test('public room should grant view permission to all', () => {
    const room = {
      id: 'room-1',
      name: 'Public Room',
      type: 'public' as const,
      host: 'host-123',
      participants: [],
      createdAt: new Date(),
      isActive: true
    };

    expect(permissionManager.hasPermission(room, viewerUser, Permission.VIEW)).toBe(true);
    expect(permissionManager.hasPermission(room, viewerUser, Permission.EDIT)).toBe(false);
    expect(permissionManager.hasPermission(room, viewerUser, Permission.MANAGE)).toBe(false);
  });

  test('private room access should require password', () => {
    const room = {
      id: 'room-1',
      name: 'Private Room',
      type: 'private' as const,
      password: 'secret123',
      host: 'host-123',
      participants: [],
      createdAt: new Date(),
      isActive: true
    };

    // 正确密码
    expect(permissionManager.validateRoomAccess(room, viewerUser, 'secret123')).toBe(true);
    
    // 错误密码
    expect(permissionManager.validateRoomAccess(room, viewerUser, 'wrongpassword')).toBe(false);
    
    // 无密码
    expect(permissionManager.validateRoomAccess(room, viewerUser)).toBe(false);
  });

  test('invite-only room should check participant list', () => {
    const room = {
      id: 'room-1',
      name: 'Invite Room',
      type: 'invite-only' as const,
      host: 'host-123',
      participants: [
        {
          id: 'viewer-456',
          name: 'Viewer User',
          role: 'viewer' as const,
          joinedAt: new Date(),
          lastActivity: new Date()
        }
      ],
      createdAt: new Date(),
      isActive: true
    };

    // 在参与者列表中
    expect(permissionManager.validateRoomAccess(room, viewerUser)).toBe(true);
    
    // 不在参与者列表中
    const anotherUser = { ...viewerUser, id: 'another-user' };
    expect(permissionManager.validateRoomAccess(room, anotherUser)).toBe(false);
  });

  test('should set and get custom permissions', () => {
    const room = {
      id: 'room-1',
      name: 'Test Room',
      type: 'public' as const,
      host: 'host-123',
      participants: [],
      createdAt: new Date(),
      isActive: true
    };

    // 设置自定义权限
    permissionManager.setCustomPermission('public', viewerUser.id, [Permission.EDIT]);
    
    expect(permissionManager.hasPermission(room, viewerUser, Permission.VIEW)).toBe(true);
    expect(permissionManager.hasPermission(room, viewerUser, Permission.EDIT)).toBe(true);
    expect(permissionManager.hasPermission(room, viewerUser, Permission.MANAGE)).toBe(false);

    // 获取用户权限
    const permissions = permissionManager.getUserPermissions(room, viewerUser);
    expect(permissions).toContain(Permission.VIEW);
    expect(permissions).toContain(Permission.EDIT);
    expect(permissions).not.toContain(Permission.MANAGE);
  });

  test('should remove custom permissions', () => {
    const room = {
      id: 'room-1',
      name: 'Test Room',
      type: 'public' as const,
      host: 'host-123',
      participants: [],
      createdAt: new Date(),
      isActive: true
    };

    // 设置然后移除自定义权限
    permissionManager.setCustomPermission('public', viewerUser.id, [Permission.EDIT]);
    expect(permissionManager.hasPermission(room, viewerUser, Permission.EDIT)).toBe(true);
    
    permissionManager.removeCustomPermission('public', viewerUser.id);
    expect(permissionManager.hasPermission(room, viewerUser, Permission.EDIT)).toBe(false);
  });

  test('should update policy', () => {
    const originalPolicy = permissionManager.getPolicy('public');
    expect(originalPolicy?.defaultPermissions).toEqual([Permission.VIEW]);

    // 更新策略
    permissionManager.updatePolicy('public', {
      defaultPermissions: [Permission.VIEW, Permission.EDIT]
    });

    const updatedPolicy = permissionManager.getPolicy('public');
    expect(updatedPolicy?.defaultPermissions).toEqual([Permission.VIEW, Permission.EDIT]);
  });

  test('should check action permissions', () => {
    const room = {
      id: 'room-1',
      name: 'Public Room',
      type: 'public' as const,
      host: 'host-123',
      participants: [],
      createdAt: new Date(),
      isActive: true
    };

    expect(permissionManager.canPerformAction(room, viewerUser, Permission.VIEW)).toBe(true);
    expect(permissionManager.canPerformAction(room, viewerUser, Permission.EDIT)).toBe(false);
    expect(permissionManager.canPerformAction(room, viewerUser, Permission.MANAGE)).toBe(false);
  });

  test('should handle non-existent room type', () => {
    const room = {
      id: 'room-1',
      name: 'Unknown Room',
      type: 'unknown' as any, // 故意使用未知类型
      host: 'host-123',
      participants: [],
      createdAt: new Date(),
      isActive: true
    };

    expect(permissionManager.hasPermission(room, viewerUser, Permission.VIEW)).toBe(false);
    expect(permissionManager.validateRoomAccess(room, viewerUser)).toBe(false);
  });
});