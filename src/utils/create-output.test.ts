import { describe, it, expect } from 'vitest';
import { createOutput } from './create-output.js';

describe('createOutput', () => {
  it('should return a valid MCP tool response with string content', () => {
    const result = createOutput('test string');

    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: '"test string"',
    });
  });

  it('should serialize objects to JSON', () => {
    const obj = { foo: 'bar', num: 42 };
    const result = createOutput(obj);

    expect(result.content[0].text).toBe(JSON.stringify(obj));
    expect(JSON.parse(result.content[0].text)).toEqual(obj);
  });

  it('should serialize arrays to JSON', () => {
    const arr = [1, 2, 3, { nested: true }];
    const result = createOutput(arr);

    expect(result.content[0].text).toBe(JSON.stringify(arr));
    expect(JSON.parse(result.content[0].text)).toEqual(arr);
  });

  it('should handle null values', () => {
    const result = createOutput(null);
    expect(result.content[0].text).toBe('null');
  });

  it('should handle numbers', () => {
    const result = createOutput(12345);
    expect(result.content[0].text).toBe('12345');
  });

  it('should handle boolean values', () => {
    expect(createOutput(true).content[0].text).toBe('true');
    expect(createOutput(false).content[0].text).toBe('false');
  });

  it('should handle complex nested structures', () => {
    const complex = {
      deployment: {
        dseq: 12345,
        owner: 'akash1abc...',
        groups: [{ name: 'web', count: 1 }],
      },
      status: 'active',
    };
    const result = createOutput(complex);

    expect(JSON.parse(result.content[0].text)).toEqual(complex);
  });
});
