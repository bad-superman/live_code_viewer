// Mock implementation of vscode module for testing

// EventEmitter mock
class EventEmitter<T> {
  private listeners: ((data: T) => void)[] = [];
  
  event(callback: (data: T) => void): { dispose: () => void } {
    this.listeners.push(callback);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(callback);
        if (index > -1) this.listeners.splice(index, 1);
      }
    };
  }
  
  fire(data: T): void {
    this.listeners.forEach(listener => listener(data));
  }
  
  dispose(): void {
    this.listeners = [];
  }
}

// Disposable interface
interface Disposable {
  dispose(): void;
}

// Position mock
class Position {
  constructor(public line: number, public character: number) {}
}

// Range mock  
class Range {
  constructor(public start: Position, public end: Position) {}
}

// Terminal mock
class Terminal {
  constructor(public name: string) {}
  
  sendText(text: string): void {
    console.log(`[MockTerminal] sendText: ${text}`);
  }
}

// Pseudoterminal interface mock
interface Pseudoterminal {
  onDidWrite: { event(callback: (data: string) => void): Disposable };
  onDidClose: { event(callback: (code: number | void) => void): Disposable };
  open(): void;
  close(): void;
  handleInput(data: string): void;
}

// StatusBarItem mock
class StatusBarItem {
  text: string = '';
  tooltip: string = '';
  
  show(): void {}
  hide(): void {}
  dispose(): void {}
}

// StatusBarAlignment enum
enum StatusBarAlignment {
  Left = 1,
  Right = 2
}

// TextEditor mock
class TextEditor {
  document = {
    fileName: 'test.ts',
    getText(): string { return 'test content'; }
  };
  selection = {
    start: new Position(0, 0),
    end: new Position(0, 0)
  };
}

// Uri mock
class Uri {
  static file(path: string): Uri {
    return new Uri();
  }
}

// Main vscode mock object
const vscode = {
  Disposable: class implements Disposable {
    dispose(): void {}
  },
  
  EventEmitter,
  Position,
  Range,
  Terminal,
  Pseudoterminal: class implements Pseudoterminal {
    onDidWrite = { event: () => ({ dispose: () => {} }) };
    onDidClose = { event: () => ({ dispose: () => {} }) };
    open(): void {}
    close(): void {}
    handleInput(data: string): void {
      console.log(`[MockPseudoterminal] handleInput: ${data}`);
    }
  },
  
  StatusBarAlignment,
  StatusBarItem,
  TextEditor,
  Uri,
  
  window: {
    createStatusBarItem(alignment: StatusBarAlignment, priority?: number): StatusBarItem {
      return new StatusBarItem();
    },
    createTerminal(nameOrOptions: string | { name: string }): Terminal {
      const name = typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions.name;
      return new Terminal(name);
    },
    createTextEditorDecorationType(options: any): any {
      return { dispose: () => {} };
    },
    createTreeView(id: string, options: any): any {
      return { dispose: () => {} };
    },
    createWebviewPanel(viewType: string, title: string, showOptions: any, options?: any): any {
      return { webview: { html: '' }, dispose: () => {} };
    },
    showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> {
      console.log(`[MockVSCode] showInformationMessage: ${message}`);
      return Promise.resolve(undefined);
    },
    showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
      console.log(`[MockVSCode] showErrorMessage: ${message}`);
      return Promise.resolve(undefined);
    },
    showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
      console.log(`[MockVSCode] showWarningMessage: ${message}`);
      return Promise.resolve(undefined);
    },
    showInputBox(options?: any): Thenable<string | undefined> {
      return Promise.resolve(undefined);
    },
    showQuickPick(items: any[], options?: any): Thenable<any> {
      return Promise.resolve(undefined);
    },
    showTextDocument(document: any, options?: any): Thenable<any> {
      return Promise.resolve(undefined);
    },
    activeTextEditor: new TextEditor(),
    visibleTextEditors: [new TextEditor()],
    terminals: [],
    onDidChangeActiveTextEditor: new EventEmitter<TextEditor>(),
    onDidChangeTextEditorSelection: new EventEmitter<{ textEditor: TextEditor }>(),
    onDidChangeVisibleTextEditors: new EventEmitter<TextEditor[]>(),
    onDidOpenTerminal: new EventEmitter<any>(),
    onDidCloseTerminal: new EventEmitter<any>(),
    onDidStartTerminalShellExecution: new EventEmitter<any>(),
    onDidEndTerminalShellExecution: new EventEmitter<any>()
  },
  
  workspace: {
    onDidChangeTextDocument: new EventEmitter<any>(),
    onDidSaveTextDocument: new EventEmitter<any>()
  },
  
  // Additional commonly used APIs
  commands: {
    registerCommand(command: string, callback: (...args: any[]) => any): Disposable {
      return new vscode.Disposable();
    }
  }
};

export = vscode;