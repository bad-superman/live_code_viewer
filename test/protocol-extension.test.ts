import {
  MessageType,
  TerminalInputMessage,
  TerminalInputAckMessage,
  TerminalInputStatusMessage,
  LiveMessage
} from '../src/protocol';

describe('Protocol Extension Tests', () => {
  test('should have new message types defined', () => {
    expect(MessageType.TerminalInput).toBe('terminalInput');
    expect(MessageType.TerminalInputAck).toBe('terminalInputAck');
    expect(MessageType.TerminalInputStatus).toBe('terminalInputStatus');
  });

  test('TerminalInputMessage should have correct structure', () => {
    const message: TerminalInputMessage = {
      type: MessageType.TerminalInput,
      terminalId: 1,
      input: 'ls -la',
      timestamp: Date.now(),
      userId: 'user123',
      sessionId: 'session456'
    };

    expect(message.type).toBe('terminalInput');
    expect(message.terminalId).toBe(1);
    expect(message.input).toBe('ls -la');
    expect(typeof message.timestamp).toBe('number');
    expect(message.userId).toBe('user123');
    expect(message.sessionId).toBe('session456');
  });

  test('TerminalInputAckMessage should have correct structure', () => {
    const message: TerminalInputAckMessage = {
      type: MessageType.TerminalInputAck,
      terminalId: 1,
      inputId: 'input-123',
      status: 'accepted',
      timestamp: Date.now()
    };

    expect(message.type).toBe('terminalInputAck');
    expect(message.terminalId).toBe(1);
    expect(message.inputId).toBe('input-123');
    expect(message.status).toBe('accepted');
    expect(typeof message.timestamp).toBe('number');
  });

  test('TerminalInputStatusMessage should have correct structure', () => {
    const message: TerminalInputStatusMessage = {
      type: MessageType.TerminalInputStatus,
      terminalId: 1,
      currentInput: 'git status',
      inputUserId: 'user123',
      status: 'typing',
      timestamp: Date.now()
    };

    expect(message.type).toBe('terminalInputStatus');
    expect(message.terminalId).toBe(1);
    expect(message.currentInput).toBe('git status');
    expect(message.inputUserId).toBe('user123');
    expect(message.status).toBe('typing');
    expect(typeof message.timestamp).toBe('number');
  });

  test('new message types should be part of LiveMessage union', () => {
    // This test verifies that TypeScript accepts the new message types
    // as part of the LiveMessage union type
    const messages: LiveMessage[] = [
      {
        type: MessageType.TerminalInput,
        terminalId: 1,
        input: 'test',
        timestamp: Date.now()
      } as TerminalInputMessage,
      {
        type: MessageType.TerminalInputAck,
        terminalId: 1,
        inputId: 'test',
        status: 'accepted',
        timestamp: Date.now()
      } as TerminalInputAckMessage,
      {
        type: MessageType.TerminalInputStatus,
        terminalId: 1,
        status: 'idle',
        timestamp: Date.now()
      } as TerminalInputStatusMessage
    ];

    expect(messages).toHaveLength(3);
    expect(messages[0].type).toBe('terminalInput');
    expect(messages[1].type).toBe('terminalInputAck');
    expect(messages[2].type).toBe('terminalInputStatus');
  });
});