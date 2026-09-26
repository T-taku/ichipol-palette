import { describe, expect, it } from 'vitest';
import { extensionContextAlive, isContextInvalidated } from '../src/shared/storage';

describe('拡張コンテキスト', () => {
  it('読み直しで無効になったエラーだけを拾う', () => {
    expect(isContextInvalidated(new Error('Extension context invalidated.'))).toBe(true);
    expect(isContextInvalidated(new Error('The message port closed before a response was received.'))).toBe(false);
  });

  it('chrome が無い実行ではコンテキストを生きているとみなさない', () => {
    expect(extensionContextAlive()).toBe(false);
  });
});
