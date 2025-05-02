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
  
  static toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase();
  }
  
  static componentNameToClassName(componentName: string): { className: string, folders: string[] } {
    const parts = componentName.split('.');
    const classKebab = parts.pop() || '';
    const className = classKebab.split('-').map(
      part => part.charAt(0).toUpperCase() + part.slice(1)
    ).join('');
    const folders = parts.map(
      folder => folder.split('-').map(
        part => part.charAt(0).toUpperCase() + part.slice(1)
      ).join('')
    );
    
    return { className, folders };
  }
  
  static resolveLivewireComponentPhpPath(componentName: string, currentDir: string): string | null {
    const appLivewireDir = this.findAppLivewireDir(currentDir);
    if (!appLivewireDir) return null;

    const { className, folders } = this.componentNameToClassName(componentName);
    const relativePath = folders.length > 0
      ? path.join(...folders, `${className}.php`)
      : `${className}.php`;
    
    const phpFilePath = path.join(appLivewireDir, relativePath);
    return fs.existsSync(phpFilePath) ? phpFilePath : null;
  }
  
  static isInAttributePosition(document: any, position: any): boolean {
    const line = document.lineAt(position.line).text;
    const textBeforeCursor = line.substring(0, position.character);
    
    // Check if we're inside an HTML attribute name (not in a value)
    const lastEquals = textBeforeCursor.lastIndexOf('=');
    const lastSpace = textBeforeCursor.lastIndexOf(' ');
    const lastQuote = Math.max(
      textBeforeCursor.lastIndexOf('"'), 
      textBeforeCursor.lastIndexOf("'")
    );
    
    return lastSpace > lastEquals && lastSpace > lastQuote;
  }
} 