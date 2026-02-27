import * as vscode from 'vscode';

/**
 * 虚拟文档内容提供者
 * 为 livecode: scheme 的 URI 提供文档内容，用于在观众端展示主播代码
 * 文档天然只读，观众无法编辑
 */
export class LiveCodeDocumentProvider implements vscode.TextDocumentContentProvider {

  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  /** 按 URI 存储各文件的内容 */
  private contents = new Map<string, string>();

  /**
   * 更新指定 URI 的文档内容，并通知 VSCode 刷新
   */
  updateContent(uri: vscode.Uri, content: string): void {
    this.contents.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) || '';
  }

  dispose(): void {
    this._onDidChange.dispose();
    this.contents.clear();
  }
}
