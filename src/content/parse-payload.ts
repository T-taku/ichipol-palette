import { extractLabeledRecord, findCourseRows } from './extract-dom';
import { JSON_FIELD_KEYS } from './selectors';
import type { CourseRecord } from '../shared/types';

function canonKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

function walkJson(value: unknown, out: CourseRecord[], depth: number): void {
  if (depth > 8 || out.length >= 500 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, out, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;

  const record: CourseRecord = {};
  let recognized = 0;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const mapped = JSON_FIELD_KEYS[canonKey(key)];
    if (!mapped) {
      walkJson(child, out, depth + 1);
      continue;
    }
    if (mapped === 'commonFlag') {
      if (child === true || child === 1 || child === '1' || child === 'true') record.commonFlag = true;
      recognized += 1;
      continue;
    }
    if (typeof child === 'string' || typeof child === 'number') {
      const text = String(child).trim();
      if (text) {
        record[mapped] = text.slice(0, 200);
        recognized += 1;
      }
    }
  }
  if (recognized >= 2 && (record.name || record.code)) out.push(record);
}

function htmlChunks(text: string): string[] {
  if (/partial-response|<update\b/i.test(text)) {
    const chunks: string[] = [];
    const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
    let match: RegExpExecArray | null;
    while ((match = cdata.exec(text))) chunks.push(match[1]);
    if (chunks.length > 0) return chunks;
  }
  if (/<table|<tr|授業科目|開講学科|科目区分/i.test(text)) return [text];
  return [];
}

export function extractRecordsFromPayload(text: string): CourseRecord[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const records: CourseRecord[] = [];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      walkJson(JSON.parse(trimmed) as unknown, records, 0);
    } catch {
      // 画面の応答は JSON とは限らない。
    }
  }
  for (const html of htmlChunks(trimmed)) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const row of findCourseRows(doc)) records.push(row.record);
    const labeled = extractLabeledRecord(doc);
    if (labeled) records.push(labeled);
  }
  return records.slice(0, 500);
}
