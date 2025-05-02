import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LivewireHelper } from './LivewireHelper';

export function activate(context: vscode.ExtensionContext) {
  console.log('Livewire Support extension activated');
  let disposable = vscode.commands.registerCommand('livewire-support.helloWorld', () => {
    vscode.window.showInformationMessage('Hello from Livewire Support!');
  });

  // Register Definition Provider for Blade and PHP files
  const bladeSelector = [
    { language: 'php', scheme: 'file' },
    { language: 'blade', scheme: 'file' }
  ];
  const definitionProvider = vscode.languages.registerDefinitionProvider(bladeSelector, {
    provideDefinition(document, position, token) {
      console.log('provideDefinition called');
      const range = document.getWordRangeAtPosition(position, /[a-zA-Z0-9\-]+/);
      if (!range) {
        console.log('No word range at position', position);
        return;
      }
      const word = document.getText(range);
      console.log('Word at position:', word);

      // Get the full line text
      const line = document.lineAt(position.line).text;
      console.log('Line text:', line);

      // Try to match <livewire:component-name
      const match = line.match(/<livewire:([a-zA-Z0-9\-]+)/);
      if (!match) {
        console.log('No <livewire:...> match found in line');
        return;
      }
      const componentName = match[1];
      console.log('Component name found:', componentName);

      if (word !== componentName) {
        console.log('Word under cursor does not match component name');
        return;
      }

      // Convert kebab-case to PascalCase for class name
      const className = componentName.split('-').map(
        part => part.charAt(0).toUpperCase() + part.slice(1)
      ).join('');
      console.log('Resolved class name:', className);

      // Use LivewireHelper.findAppLivewireDir
      const currentFilePath = document.uri.fsPath;
      const currentDir = path.dirname(currentFilePath);
      const appLivewireDir = LivewireHelper.findAppLivewireDir(currentDir);

      if (!appLivewireDir) {
        console.log('No app/Livewire directory found up the tree');
        return;
      }

      const phpFile = vscode.Uri.file(path.join(appLivewireDir, `${className}.php`));
      console.log('Resolved PHP file path:', phpFile.fsPath);
      return new vscode.Location(phpFile, new vscode.Position(0, 0));
    }
  });

  // Register Definition Provider for PHP view() calls
  const phpSelector = { language: 'php', scheme: 'file' };
  const viewDefinitionProvider = vscode.languages.registerDefinitionProvider(phpSelector, {
    provideDefinition(document, position, token) {
      const lineText = document.lineAt(position.line).text;
      const regex = /view\(['"]([a-zA-Z0-9_.\-]+)['"]\)/g;
      let match;
      let found = false;
      let viewName = '';
      let start = -1, end = -1;

      while ((match = regex.exec(lineText)) !== null) {
        const matchIndex = match.index + match[0].indexOf(match[1]);
        const matchStart = matchIndex;
        const matchEnd = matchIndex + match[1].length;
        if (position.character >= matchStart && position.character <= matchEnd) {
          found = true;
          viewName = match[1];
          start = matchStart;
          end = matchEnd;
          break;
        }
      }

      if (!found) return;

      // Use LivewireHelper.findViewsDir
      const currentFilePath = document.uri.fsPath;
      const currentDir = path.dirname(currentFilePath);
      const viewsDir = LivewireHelper.findViewsDir(currentDir);
      if (!viewsDir) return;

      const viewPath = viewName.replace(/\./g, '/');
      const bladeFile = path.join(viewsDir, `${viewPath}.blade.php`);
      if (!fs.existsSync(bladeFile)) return;
      const bladeUri = vscode.Uri.file(bladeFile);

      // Return a LocationLink with the full range of the view string
      const range = new vscode.Range(position.line, start, position.line, end);
      return [{
        originSelectionRange: range,
        targetUri: bladeUri,
        targetRange: new vscode.Range(0, 0, 0, 0)
      }];
    }
  });

  // Register Definition Provider for @livewire('component-name') in Blade files
  const bladeLivewireProvider = vscode.languages.registerDefinitionProvider(bladeSelector, {
    provideDefinition(document, position, token) {
      const lineText = document.lineAt(position.line).text;
      const regex = /@livewire\(['"]([a-zA-Z0-9_\-]+)['"]/g;
      let match;
      let found = false;
      let componentName = '';
      let start = -1, end = -1;

      while ((match = regex.exec(lineText)) !== null) {
        const matchIndex = match.index + match[0].indexOf(match[1]);
        const matchStart = matchIndex;
        const matchEnd = matchIndex + match[1].length;
        if (position.character >= matchStart && position.character <= matchEnd) {
          found = true;
          componentName = match[1];
          start = matchStart;
          end = matchEnd;
          break;
        }
      }

      if (!found) return;

      // Convert kebab-case to PascalCase for class name
      const className = componentName.split('-').map(
        part => part.charAt(0).toUpperCase() + part.slice(1)
      ).join('');

      // Use LivewireHelper.findAppLivewireDir
      const currentFilePath = document.uri.fsPath;
      const currentDir = path.dirname(currentFilePath);
      const appLivewireDir = LivewireHelper.findAppLivewireDir(currentDir);
      if (!appLivewireDir) return;

      const phpFile = path.join(appLivewireDir, `${className}.php`);
      if (!fs.existsSync(phpFile)) return;
      const phpUri = vscode.Uri.file(phpFile);

      // Return a LocationLink with the full range of the component string
      const range = new vscode.Range(position.line, start, position.line, end);
      return [{
        originSelectionRange: range,
        targetUri: phpUri,
        targetRange: new vscode.Range(0, 0, 0, 0)
      }];
    }
  });

  // Register CompletionItemProvider for Livewire component attributes in Blade files
  const livewireAttributeCompletionProvider = vscode.languages.registerCompletionItemProvider(
    bladeSelector,
    {
      async provideCompletionItems(document, position, token, context) {
        function toKebabCase(str: string): string {
          return str
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // camelCase to camel-Case
            .replace(/_/g, '-')                     // snake_case to snake-case
            .toLowerCase();
        }
        const lineText = document.lineAt(position.line).text;
        // Check if inside a <livewire:...> tag
        const tagMatch = lineText.match(/<livewire:([a-zA-Z0-9_\-]+)/);
        if (!tagMatch) return;
        const componentName = tagMatch[1];
        // Convert kebab-case to PascalCase for class name
        const className = componentName.split('-').map(
          part => part.charAt(0).toUpperCase() + part.slice(1)
        ).join('');
        // Find the component PHP file
        const currentFilePath = document.uri.fsPath;
        const currentDir = path.dirname(currentFilePath);
        const appLivewireDir = LivewireHelper.findAppLivewireDir(currentDir);
        if (!appLivewireDir) return;
        const phpFile = path.join(appLivewireDir, `${className}.php`);
        if (!fs.existsSync(phpFile)) return;
        // Read the PHP file and extract public properties
        const properties = LivewireHelper.getPublicPropertiesFromPhpFile(phpFile);
        const items = [];
        for (const propName of properties) {
          const kebabName = toKebabCase(propName);
          items.push(new vscode.CompletionItem(kebabName, vscode.CompletionItemKind.Field));
          items.push(new vscode.CompletionItem(`:${kebabName}`, vscode.CompletionItemKind.Field));
        }
        return items;
      }
    },
    ' ', // trigger on space
    ':'  // and maybe on colon
  );

  // Register CompletionItemProvider for @livewire('component', [ ... ]) array keys in Blade files
  const livewireArrayAttributeCompletionProvider = vscode.languages.registerCompletionItemProvider(
    bladeSelector,
    {
      async provideCompletionItems(document, position, token, context) {
        console.log('Livewire array attribute completion triggered');
        function toKebabCase(str: string): string {
          return str
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .replace(/_/g, '-')
            .toLowerCase();
        }
        // Search upwards for the @livewire directive and check if the cursor is inside its array
        let openParenLine = -1;
        let componentName = '';
        for (let i = position.line; i >= 0; i--) {
          const checkLine = document.lineAt(i).text;
          const match = checkLine.match(/^\s*@livewire\(['"]([a-zA-Z0-9_\-]+)['"]\s*,?/);
          if (match) {
            openParenLine = i;
            componentName = match[1];
            console.log('Found @livewire directive:', componentName, 'at line', i);
            break;
          }
        }
        if (openParenLine === -1) {
          console.log('No @livewire directive found upwards from line', position.line);
          return;
        }

        // Now, check if the cursor is inside the array brackets of this directive
        let openBracketLine = -1;
        let closeBracketLine = -1;
        for (let i = openParenLine; i < document.lineCount; i++) {
          const text = document.lineAt(i).text;
          if (openBracketLine === -1 && text.includes('[')) openBracketLine = i;
          if (text.includes(']')) {
            closeBracketLine = i;
            break;
          }
        }
        

        // Find the component PHP file
        const className = componentName.split('-').map(
          part => part.charAt(0).toUpperCase() + part.slice(1)
        ).join('');
        const currentFilePath = document.uri.fsPath;
        const currentDir = path.dirname(currentFilePath);
        const appLivewireDir = LivewireHelper.findAppLivewireDir(currentDir);
        if (!appLivewireDir) {
          console.log('No app/Livewire directory found');
          return;
        }
        const phpFile = path.join(appLivewireDir, `${className}.php`);
        const properties = LivewireHelper.getPublicPropertiesFromPhpFile(phpFile);
        console.log('Component class:', phpFile, 'Properties:', properties);
        const items = [];
        const lineUpToCursor = document.lineAt(position.line).text.substring(0, position.character);
        const lastComma = lineUpToCursor.lastIndexOf(',');
        const lastBracket = lineUpToCursor.lastIndexOf('[');
        const lastArrow = lineUpToCursor.lastIndexOf('=>');

        const lastKeyStart = Math.max(lastComma, lastBracket);

        if (lastArrow > lastKeyStart) {
          // There is a => after the last comma or bracket, so we're in a value position
          return;
        }
        // Otherwise, we're in a key position, so provide completions
        for (const propName of properties) {
          const kebabName = toKebabCase(propName);
          items.push(new vscode.CompletionItem(kebabName, vscode.CompletionItemKind.Field));
        }
        return items;
      }
    },
    "'", // trigger on single quote
    ":"  // and colon
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(definitionProvider);
  context.subscriptions.push(viewDefinitionProvider);
  context.subscriptions.push(bladeLivewireProvider);
  context.subscriptions.push(livewireAttributeCompletionProvider);
  context.subscriptions.push(livewireArrayAttributeCompletionProvider);
}

export function deactivate() {} 