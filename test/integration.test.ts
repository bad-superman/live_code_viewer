import { RoomManager } from '../src/core/room-manager';
import { PermissionManager, Permission } from '../src/core/permission-manager';

// Mock vscode extension context
const mockExtensionContext = {
  globalState: {
    get: jest.fn(),
    update: jest.fn()
  }
} as any;

describe('Integration Tests', () => {
  let roomManager: RoomManager;
  let permissionManager: PermissionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExtensionContext.globalState.get.mockReturnValue([]);
    mockExtensionContext.globalState.get.mockReturnValueOnce([]);
    mockExtensionContext.globalState.get.mockReturnValueOnce(null);
    
    roomManager = new RoomManager(mockExtensionContext);
    permissionManager = new PermissionManager();
  });

  test('should integrate room and permission management', () => {
    // 创建不同权限的房间
    const publicRoom = roomManager.createRoom({
      name: '公共编程房间',
      type: 'public'
    });

    const privateRoom = roomManager.createRoom({
      name: '私有项目房间',
      type: 'private',
      password: 'team123'
    });

    const inviteRoom = roomManager.createRoom({
      name: '团队协作房间',
      type: 'invite-only'
    });

    // 添加参与者到邀请制房间
    roomManager.addParticipant(inviteRoom.id, {
      id: 'team-member-1',
      name: '团队成员A',
      role: 'viewer'
    });

    // 定义测试用户
    const hostUser = { id: publicRoom.host, name: '房间创建者', role: 'host' as const };
    const publicUser = { id: 'public-user', name: '公共用户', role: 'viewer' as const };
    const teamUser = { id: 'team-member-1', name: '团队成员A', role: 'viewer' as const };
    const outsiderUser = { id: 'outsider', name: '外部用户', role: 'viewer' as const };

    // 测试公共房间权限
    expect(permissionManager.validateRoomAccess(publicRoom, publicUser)).toBe(true);
    expect(permissionManager.hasPermission(publicRoom, publicUser, Permission.VIEW)).toBe(true);
    expect(permissionManager.hasPermission(publicRoom, publicUser, Permission.EDIT)).toBe(false);

    // 测试私有房间权限
    expect(permissionManager.validateRoomAccess(privateRoom, publicUser, 'team123')).toBe(true);
    expect(permissionManager.validateRoomAccess(privateRoom, publicUser, 'wrongpass')).toBe(false);

    // 测试邀请制房间权限
    expect(permissionManager.validateRoomAccess(inviteRoom, teamUser)).toBe(true);
    expect(permissionManager.validateRoomAccess(inviteRoom, outsiderUser)).toBe(false);

    // 测试房间创建者权限
    expect(permissionManager.hasPermission(publicRoom, hostUser, Permission.VIEW)).toBe(true);
    expect(permissionManager.hasPermission(publicRoom, hostUser, Permission.EDIT)).toBe(true);
    expect(permissionManager.hasPermission(publicRoom, hostUser, Permission.MANAGE)).toBe(true);

    // 测试自定义权限
    permissionManager.setCustomPermission('public', publicUser.id, [Permission.EDIT]);
    expect(permissionManager.hasPermission(publicRoom, publicUser, Permission.EDIT)).toBe(true);

    // 验证房间列表
    const allRooms = roomManager.getAllRooms();
    expect(allRooms).toHaveLength(3);
    
    // 检查包含所有房间名称，不关心顺序
    const roomNames = allRooms.map(room => room.name);
    expect(roomNames).toContain('团队协作房间');
    expect(roomNames).toContain('私有项目房间');
    expect(roomNames).toContain('公共编程房间');
  });

  test('should handle complex permission scenarios', () => {
    // 创建复杂权限场景的房间
    const complexRoom = roomManager.createRoom({
      name: '复杂权限房间',
      type: 'private',
      password: 'complex123'
    });

    // 添加多个参与者
    roomManager.addParticipant(complexRoom.id, {
      id: 'editor-1',
      name: '编辑用户',
      role: 'viewer'
    });

    roomManager.addParticipant(complexRoom.id, {
      id: 'viewer-1', 
      name: '查看用户',
      role: 'viewer'
    });

    // 设置自定义权限
    permissionManager.setCustomPermission('private', 'editor-1', [Permission.VIEW, Permission.EDIT]);
    permissionManager.setCustomPermission('private', 'viewer-1', [Permission.VIEW]);

    const editorUser = { id: 'editor-1', name: '编辑用户', role: 'viewer' as const };
    const viewerUser = { id: 'viewer-1', name: '查看用户', role: 'viewer' as const };

    // 验证权限
    expect(permissionManager.getUserPermissions(complexRoom, editorUser))
      .toEqual([Permission.VIEW, Permission.EDIT]);
    
    expect(permissionManager.getUserPermissions(complexRoom, viewerUser))
      .toEqual([Permission.VIEW]);

    // 验证操作权限
    expect(permissionManager.canPerformAction(complexRoom, editorUser, Permission.EDIT)).toBe(true);
    expect(permissionManager.canPerformAction(complexRoom, viewerUser, Permission.EDIT)).toBe(false);

    // 移除自定义权限
    permissionManager.removeCustomPermission('private', 'editor-1');
    expect(permissionManager.hasPermission(complexRoom, editorUser, Permission.EDIT)).toBe(false);
  });

  test('should handle room lifecycle with permissions', () => {
    const room = roomManager.createRoom({
      name: '生命周期测试房间',
      type: 'public'
    });

    const testUser = { id: 'test-user', name: '测试用户', role: 'viewer' as const };

    // 初始状态验证
    expect(permissionManager.validateRoomAccess(room, testUser)).toBe(true);
    expect(roomManager.getRoom(room.id)?.isActive).toBe(true);

    // 关闭房间
    roomManager.closeRoom(room.id);
    
    // 关闭后权限验证 - 关闭的房间应该无法访问
    const closedRoom = roomManager.getRoom(room.id);
    expect(closedRoom?.isActive).toBe(false);
    expect(roomManager.validateRoomAccess(closedRoom!.id)).toBe(false);

    // 删除房间
    roomManager.deleteRoom(room.id);
    expect(roomManager.getRoom(room.id)).toBeUndefined();
  });

  test('should maintain data consistency between managers', () => {
    // 创建多个房间
    const rooms = [
      roomManager.createRoom({ name: '房间A', type: 'public' }),
      roomManager.createRoom({ name: '房间B', type: 'private', password: 'passB' }),
      roomManager.createRoom({ name: '房间C', type: 'invite-only' })
    ];

    // 为每个房间添加参与者
    rooms.forEach((room, index) => {
      roomManager.addParticipant(room.id, {
        id: `user-${index}`,
        name: `用户${index}`,
        role: 'viewer'
      });
    });

    // 验证数据一致性
    const allRooms = roomManager.getAllRooms();
    expect(allRooms).toHaveLength(3);

    allRooms.forEach(room => {
      expect(room.participants).toHaveLength(1);
      
      // 权限验证应该与房间类型一致
      const testUser = { id: 'test-user', name: '测试用户', role: 'viewer' as const };
      
      switch (room.type) {
        case 'public':
          expect(permissionManager.validateRoomAccess(room, testUser)).toBe(true);
          break;
        case 'private':
          expect(permissionManager.validateRoomAccess(room, testUser, 'passB')).toBe(true);
          break;
        case 'invite-only':
          expect(permissionManager.validateRoomAccess(room, testUser)).toBe(false);
          break;
      }
    });

    // 验证存储调用
    expect(mockExtensionContext.globalState.update).toHaveBeenCalledWith('rooms', expect.any(Array));
  });
});