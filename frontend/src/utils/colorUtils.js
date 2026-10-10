/**
 * Generates a deterministic numeric hash from a string input.
 */
function stringToHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

/**
 * Extracts hue (0-360 deg) from a hex color string.
 */
export function hexToHue(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
      default:
        break;
    }
    h /= 6;
  }
  return Math.round(h * 360);
}

/**
 * Converts HSL hue, saturation, and lightness to a Hex string.
 */
export function hslToHex(h, s = 80, l = 50) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Returns an accessible HSL color scheme for a course key (course_id or full_name).
 */
export function getCourseColorScheme(courseKey, customColors = {}) {
  const keyString = String(courseKey || '');
  let hue;

  if (customColors && customColors[keyString]) {
    const customVal = customColors[keyString];
    if (typeof customVal === 'string' && customVal.startsWith('#')) {
      hue = hexToHue(customVal);
    } else if (typeof customVal === 'number') {
      hue = customVal;
    }
  }

  if (hue === undefined) {
    if (!keyString) {
      return {
        bg: 'hsl(210, 80%, 94%)',
        border: 'hsl(210, 60%, 80%)',
        text: 'hsl(210, 85%, 20%)',
        hue: 210,
      };
    }
    const hash = stringToHash(keyString);
    hue = Math.abs(hash) % 360;
  }

  return {
    bg: `hsl(${hue}, 80%, 94%)`,
    border: `hsl(${hue}, 60%, 80%)`,
    text: `hsl(${hue}, 85%, 20%)`,
    hue: hue,
  };
}