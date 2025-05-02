import * as path from 'path';
import * as fs from 'fs';

export class LivewireHelper {
  static findAppLivewireDir(startPath: string): string | null {
    let dir = startPath;
    while (true) {
      const candidate = path.join(dir, 'app', 'Livewire');
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  }

  static findViewsDir(startPath: string): string | null {
    let dir = startPath;
    while (true) {
      const candidate = path.join(dir, 'resources', 'views');
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  }

  static getPublicPropertiesFromPhpFile(phpFile: string): string[] {
    if (!fs.existsSync(phpFile)) return [];
    const phpContent = fs.readFileSync(phpFile, 'utf8');
    const propertyRegex = /public\s+\$([a-zA-Z0-9_]+)/g;
    let match;
    const properties: string[] = [];
    while ((match = propertyRegex.exec(phpContent)) !== null) {
      properties.push(match[1]);
    }
    return properties;
  }
} 