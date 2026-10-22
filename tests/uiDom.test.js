import { describe, expect, it } from 'vitest';
import { escapeHtml, safeCatalogImageUrl, safeCssColor } from '../src/ui/dom.js';

describe('ui dom helpers', () => {
  it('escapes HTML entities for text and attributes', () => {
    expect(escapeHtml(`Bard "ležák" <script>alert('&')</script>`)).toBe(
      'Bard &quot;ležák&quot; &lt;script&gt;alert(&#39;&amp;&#39;)&lt;/script&gt;',
    );
  });

  it('only allows catalog images from svabin.com over https or data placeholders', () => {
    expect(safeCatalogImageUrl('https://svabin.com/img/bard.png')).toBe('https://svabin.com/img/bard.png');
    expect(safeCatalogImageUrl('https://www.svabin.com/img/bard.png')).toBe('https://www.svabin.com/img/bard.png');
    expect(safeCatalogImageUrl('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==')).toMatch(
      /^data:image\/gif;base64,/,
    );
    expect(safeCatalogImageUrl('http://svabin.com/img/bard.png')).toBe('');
    expect(safeCatalogImageUrl('javascript:alert(1)')).toBe('');
  });

  it('keeps CSS colors to a narrow safe subset', () => {
    expect(safeCssColor('#ece3d2', '#000')).toBe('#ece3d2');
    expect(safeCssColor('rgb(1, 2, 3)', '#000')).toBe('rgb(1, 2, 3)');
    expect(safeCssColor('red; background:url(javascript:alert(1))', '#000')).toBe('#000');
  });
});
