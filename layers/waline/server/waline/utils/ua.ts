/**
 * Simple User-Agent parser for Workers
 * Returns browser name+version and OS name
 */

export function parseUA(ua: string): { browser: string; os: string } {
  if (!ua) return { browser: '', os: '' };
  return { browser: parseBrowser(ua), os: parseOS(ua) };
}

function parseBrowser(ua: string): string {
  // Order matters: more specific first
  const browsers: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/(\d+[.\d]*)/, 'Edge'],
    [/OPR\/(\d+[.\d]*)/, 'Opera'],
    [/Vivaldi\/(\d+[.\d]*)/, 'Vivaldi'],
    [/Firefox\/(\d+[.\d]*)/, 'Firefox'],
    [/Chrome\/(\d+[.\d]*)/, 'Chrome'],
    [/Version\/(\d+[.\d]*).*Safari/, 'Safari'],
    [/MSIE (\d+[.\d]*)/, 'IE'],
    [/Trident\/.*rv:(\d+[.\d]*)/, 'IE'],
  ];

  for (const [re, name] of browsers) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return '';
}

function parseOS(ua: string): string {
  if (/Windows NT 10/.test(ua)) return 'Windows 10';
  if (/Windows NT 6\.3/.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6\.2/.test(ua)) return 'Windows 8';
  if (/Windows NT 6\.1/.test(ua)) return 'Windows 7';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X (\d+[._]\d+)/.test(ua)) {
    const v = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace(/_/g, '.');
    return `macOS ${v}`;
  }
  if (/Macintosh/.test(ua)) return 'macOS';
  if (/Android (\d+[.\d]*)/.test(ua)) {
    return `Android ${ua.match(/Android (\d+[.\d]*)/)?.[1]}`;
  }
  if (/iPhone OS (\d+[_\d]*)/.test(ua)) {
    const v = ua.match(/iPhone OS (\d+[_\d]*)/)?.[1]?.replace(/_/g, '.');
    return `iOS ${v}`;
  }
  if (/iPad/.test(ua)) return 'iPadOS';
  if (/Linux/.test(ua)) return 'Linux';
  return '';
}
