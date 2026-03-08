/**
 * 编辑操作定义模块
 * 定义协作编辑中的基本操作类型和数据格式
 */

export interface EditOperation {
  id: string;
  type: 'insert' | 'delete' | 'replace' | 'selection';
  position: number;
  content?: string;
  length?: number;
  timestamp: number;
  author: string;
  version: number;
}

export interface SelectionOperation {
  id: string;
  type: 'selection';
  start: number;
  end: number;
  timestamp: number;
  author: string;
}

export interface OperationBatch {
  operations: EditOperation[];
  version: number;
  timestamp: number;
  author: string;
}

export class EditOperationFactory {
  static createInsert(
    position: number,
    content: string,
    author: string,
    version: number
  ): EditOperation {
    return {
      id: this.generateId(),
      type: 'insert',
      position,
      content,
      timestamp: Date.now(),
      author,
      version
    };
  }

  static createDelete(
    position: number,
    length: number,
    author: string,
    version: number
  ): EditOperation {
    return {
      id: this.generateId(),
      type: 'delete',
      position,
      length,
      timestamp: Date.now(),
      author,
      version
    };
  }

  static createReplace(
    position: number,
    length: number,
    content: string,
    author: string,
    version: number
  ): EditOperation {
    return {
      id: this.generateId(),
      type: 'replace',
      position,
      length,
      content,
      timestamp: Date.now(),
      author,
      version
    };
  }

  static createSelection(
    start: number,
    end: number,
    author: string
  ): SelectionOperation {
    return {
      id: this.generateId(),
      type: 'selection',
      start,
      end,
      timestamp: Date.now(),
      author
    };
  }

  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 操作转换器 - 实现 Operational Transformation 算法
 */
export class OperationTransformer {
  /**
   * 转换操作，确保并发操作的最终一致性
   */
  static transform(
    operation: EditOperation,
    concurrentOperation: EditOperation
  ): EditOperation {
    if (operation.type === 'selection') {
      return operation;
    }

    // 如果两个操作位置不重叠，直接返回原操作
    if (this.isNonOverlapping(operation, concurrentOperation)) {
      return operation;
    }

    // 处理重叠操作
    return this.handleOverlappingOperations(operation, concurrentOperation);
  }

  private static isNonOverlapping(
    op1: EditOperation,
    op2: EditOperation
  ): boolean {
    const op1End = op1.position + (op1.length || 0);
    const op2End = op2.position + (op2.length || 0);

    return op1End <= op2.position || op2End <= op1.position;
  }

  private static handleOverlappingOperations(
    operation: EditOperation,
    concurrentOperation: EditOperation
  ): EditOperation {
    // 简化版本：基于时间戳决定优先级
    // 在实际应用中应该使用更复杂的 OT 算法
    if (operation.timestamp <= concurrentOperation.timestamp) {
      return operation;
    }

    // 调整操作位置以考虑并发操作的影响
    return this.adjustOperationPosition(operation, concurrentOperation);
  }

  private static adjustOperationPosition(
    operation: EditOperation,
    concurrentOperation: EditOperation
  ): EditOperation {
    let adjustedPosition = operation.position;

    if (concurrentOperation.type === 'insert') {
      // 如果并发操作是插入，且插入位置在当前操作之前
      if (concurrentOperation.position <= operation.position) {
        adjustedPosition += (concurrentOperation.content?.length || 0);
      }
    } else if (concurrentOperation.type === 'delete') {
      // 如果并发操作是删除
      const deleteEnd = concurrentOperation.position + (concurrentOperation.length || 0);
      
      if (concurrentOperation.position < operation.position) {
        if (deleteEnd <= operation.position) {
          // 删除操作完全在当前操作之前
          adjustedPosition -= (concurrentOperation.length || 0);
        } else if (deleteEnd > operation.position) {
          // 删除操作部分重叠或完全覆盖当前操作
          adjustedPosition = concurrentOperation.position;
        }
      }
    }

    return {
      ...operation,
      position: adjustedPosition
    };
  }
}

/**
 * 操作版本管理器
 */
export class OperationVersionManager {
  private currentVersion = 0;
  private appliedOperations: Map<number, EditOperation[]> = new Map();

  getNextVersion(): number {
    return ++this.currentVersion;
  }

  getCurrentVersion(): number {
    return this.currentVersion;
  }

  addOperation(operation: EditOperation): void {
    const versionOperations = this.appliedOperations.get(operation.version) || [];
    versionOperations.push(operation);
    this.appliedOperations.set(operation.version, versionOperations);
  }

  getOperationsByVersion(version: number): EditOperation[] {
    return this.appliedOperations.get(version) || [];
  }

  getAllOperations(): EditOperation[] {
    const allOperations: EditOperation[] = [];
    for (const operations of this.appliedOperations.values()) {
      allOperations.push(...operations);
    }
    return allOperations.sort((a, b) => a.timestamp - b.timestamp);
  }

  clear(): void {
    this.appliedOperations.clear();
    this.currentVersion = 0;
  }
}