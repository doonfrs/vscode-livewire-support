import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LivewireHelper } from './LivewireHelper';

export function activate(context: vscode.ExtensionContext) {
  console.log('Livewire Support extension activated');

  let disposable = vscode.commands.registerCommand('livewire-support.helloWorld', () => {
    vscode.window.showInformationMessage('Hello from Livewire Support!');
  });

  const bladeSelector = [
    { language: 'php', scheme: 'file' },
    { language: 'blade', scheme: 'file' }
  ];

  // Improved definition provider for <livewire:component-name> tags
  const definitionProvider = vscode.languages.registerDefinitionProvider(bladeSelector, {
    provideDefinition(document, position, token) {
      const range = document.getWordRangeAtPosition(position, /[a-zA-Z0-9\-\.]+/);
      if (!range) return;
      
      const word = document.getText(range);
      const line = document.lineAt(position.line).text;

      // Enhanced regex to support dot notation in component names
      const match = line.match(/<livewire:([a-zA-Z0-9\-\.]+)/);
      if (!match) return;

      const componentName = match[1];
      if (word !== componentName) return;

      const phpPath = LivewireHelper.resolveLivewireComponentPhpPath(componentName, path.dirname(document.uri.fsPath));
      if (!phpPath) return;

      // Use LocationLink for better selection in the target file
      return [{
        originSelectionRange: range,
        targetUri: vscode.Uri.file(phpPath),
        targetRange: new vscode.Range(0, 0, 0, 0),
        targetSelectionRange: new vscode.Range(0, 0, 0, 0)
      }];
    }
  });

  // Definition provider for view('livewire.example-component') references in PHP
  const viewDefinitionProvider = vscode.languages.registerDefinitionProvider({ language: 'php', scheme: 'file' }, {
    provideDefinition(document, position, token) {
      // First, check the current line
      const lineText = document.lineAt(position.line).text;
      
      // Check for view function calls that might contain the cursor position
      // Updated regex to better match view calls with nested paths and arguments
      const viewRegex = /view\(\s*['"]([a-zA-Z0-9_.\-]+)['"]/g;
      let match;
      let found = false;
      let viewName = '';
      let start = -1, end = -1;
      
      while ((match = viewRegex.exec(lineText)) !== null) {
        const viewValue = match[1]; // The view name like 'livewire.shop.item-filters'
        const matchStart = lineText.indexOf(viewValue, match.index);
        const matchEnd = matchStart + viewValue.length;
        
        if (position.character >= matchStart && position.character <= matchEnd) {
          found = true;
          viewName = viewValue;
          start = matchStart;
          end = matchEnd;
          break;
        }
      }
      
      // If not found, check if we're in a multi-line view call
      if (!found) {
        // Check if we're in a string that could be part of a view call
        const stringRegex = /['"]([a-zA-Z0-9_.\-]+)['"]/g;
        
        while ((match = stringRegex.exec(lineText)) !== null) {
          const stringValue = match[1];
          const matchStart = lineText.indexOf(stringValue, match.index);
          const matchEnd = matchStart + stringValue.length;
          
          if (position.character >= matchStart && position.character <= matchEnd) {
            // Check if we're in a multi-line view call by scanning backward
            let isInViewCall = false;
            for (let i = position.line; i >= Math.max(0, position.line - 5); i--) {
              const prevLine = document.lineAt(i).text;
              if (prevLine.includes('view(')) {
                isInViewCall = true;
                break;
              }
              // Stop if we encounter a line ending with semicolon or block
              if (/[;{}]\s*$/.test(prevLine)) {
                break;
              }
            }
            
            if (isInViewCall) {
              found = true;
              viewName = stringValue;
              start = matchStart;
              end = matchEnd;
              break;
            }
          }
        }
      }
      
      if (!found) return;
      
      // Resolve the blade file path
      const viewsDir = LivewireHelper.findViewsDir(path.dirname(document.uri.fsPath));
      if (!viewsDir) return;
      
      // Convert dot notation to path with folder structure
      const viewPath = viewName.replace(/\./g, '/');
      const bladeFile = path.join(viewsDir, `${viewPath}.blade.php`);
      
      if (!fs.existsSync(bladeFile)) return;
      
      return [{
        originSelectionRange: new vscode.Range(position.line, start, position.line, end),
        targetUri: vscode.Uri.file(bladeFile),
        targetRange: new vscode.Range(0, 0, 0, 0),
        targetSelectionRange: new vscode.Range(0, 0, 0, 0)
      }];
    }
  });

  // Enhanced to handle multi-line view calls with arguments
  const enhancedViewDefinitionProvider = vscode.languages.registerDefinitionProvider({ language: 'php', scheme: 'file' }, {
    provideDefinition(document, position, token) {
      // Get the current line and character
      const lineText = document.lineAt(position.line).text;
      
      // First, check if we're in a view function call
      const viewCallRegex = /view\(\s*['"]([a-zA-Z0-9_.\-]+)['"]\)/g;
      const viewMatch = lineText.match(viewCallRegex);
      
      if (!viewMatch) {
        // If we don't find it on the current line, try to scan a few lines backward
        // to handle multi-line view calls
        for (let i = position.line - 1; i >= Math.max(0, position.line - 5); i--) {
          const prevLine = document.lineAt(i).text;
          if (prevLine.includes('view(') && !prevLine.includes(')')) {
            // Found a view call that might continue to our line
            for (let j = i; j <= Math.min(document.lineCount - 1, position.line + 5); j++) {
              const checkLine = document.lineAt(j).text;
              const multiLineMatch = checkLine.match(/['"]([a-zA-Z0-9_.\-]+)['"]/);
              if (multiLineMatch && j === position.line) {
                const matchStart = checkLine.indexOf(multiLineMatch[1]);
                const matchEnd = matchStart + multiLineMatch[1].length;
                
                if (position.character >= matchStart && position.character <= matchEnd) {
                  // We're inside a view name in a multi-line view call
                  const viewsDir = LivewireHelper.findViewsDir(path.dirname(document.uri.fsPath));
                  if (!viewsDir) return;
                  
                  const viewPath = multiLineMatch[1].replace(/\./g, '/');
                  const bladeFile = path.join(viewsDir, `${viewPath}.blade.php`);
                  
                  if (fs.existsSync(bladeFile)) {
                    return [{
                      originSelectionRange: new vscode.Range(j, matchStart, j, matchEnd),
                      targetUri: vscode.Uri.file(bladeFile),
                      targetRange: new vscode.Range(0, 0, 0, 0),
                      targetSelectionRange: new vscode.Range(0, 0, 0, 0)
                    }];
                  }
                }
              }
            }
            break;
          }
        }
        return; // Not in a view call
      }
      
      // Extract the view name from the regex match
      const viewName = viewMatch[1];
      
      // Check if the cursor is within the view name string
      const viewNameIndex = lineText.indexOf(viewName);
      if (position.character < viewNameIndex || 
          position.character > viewNameIndex + viewName.length) {
        return; // Cursor not within the view name
      }
      
      // Find the views directory
      const viewsDir = LivewireHelper.findViewsDir(path.dirname(document.uri.fsPath));
      if (!viewsDir) return;
      
      // Convert dot notation to path (e.g., livewire.shop.item-filters → livewire/shop/item-filters)
      const viewPath = viewName.replace(/\./g, '/');
      const bladeFile = path.join(viewsDir, `${viewPath}.blade.php`);
      
      // Check if the file exists
      if (!fs.existsSync(bladeFile)) return;
      
      // Return the link to the blade file
      return [{
        originSelectionRange: new vscode.Range(
          position.line, 
          viewNameIndex, 
          position.line, 
          viewNameIndex + viewName.length
        ),
        targetUri: vscode.Uri.file(bladeFile),
        targetRange: new vscode.Range(0, 0, 0, 0),
        targetSelectionRange: new vscode.Range(0, 0, 0, 0)
      }];
    }
  });

  // Enhanced definition provider for @livewire('component-name') directives
  const bladeLivewireProvider = vscode.languages.registerDefinitionProvider(bladeSelector, {
    provideDefinition(document, position, token) {
      const lineText = document.lineAt(position.line).text;
      // Enhanced regex to support dot notation in component names
      const regex = /@livewire\(['"]([a-zA-Z0-9_.\-]+)['"]/g;
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

      const phpPath = LivewireHelper.resolveLivewireComponentPhpPath(componentName, path.dirname(document.uri.fsPath));
      if (!phpPath) return;

      return [{
        originSelectionRange: new vscode.Range(position.line, start, position.line, end),
        targetUri: vscode.Uri.file(phpPath),
        targetRange: new vscode.Range(0, 0, 0, 0),
        targetSelectionRange: new vscode.Range(0, 0, 0, 0)
      }];
    }
  });

  // Enhanced completion provider for <livewire:component-name> attributes
  const livewireAttributeCompletionProvider = vscode.languages.registerCompletionItemProvider(
    bladeSelector,
    {
      async provideCompletionItems(document, position, token, context) {
        // Determine if the cursor is inside a livewire tag
        let tagLine = -1;
        let componentName = '';
        
        // Scan up to 10 lines backwards to find a livewire tag
        const scanLimit = Math.max(0, position.line - 10);
        for (let i = position.line; i >= scanLimit; i--) {
          const checkLine = document.lineAt(i).text;
          const match = checkLine.match(/<livewire:([a-zA-Z0-9_.\-]+)/);
          if (match) {
            tagLine = i;
            componentName = match[1];
            break;
          }
        }
        
        if (tagLine === -1) return;
        
        // Check if we're inside the opening tag (not after closing bracket)
        let closingTagFound = false;
        for (let i = tagLine; i <= position.line; i++) {
          const text = document.lineAt(i).text;
          if (i === position.line) {
            const textBeforeCursor = text.substring(0, position.character);
            if (textBeforeCursor.includes('/>') || textBeforeCursor.includes('>')) {
              closingTagFound = true;
              break;
            }
          } else {
            if (text.includes('/>') || text.includes('>')) {
              closingTagFound = true;
              break;
            }
          }
        }
        
        if (closingTagFound) return;
        
        // Check if we're in an attribute position (not inside attribute values)
        if (!LivewireHelper.isInAttributePosition(document, position)) {
          return;
        }
        
        const currentFilePath = document.uri.fsPath;
        const currentDir = path.dirname(currentFilePath);
        const phpFilePath = LivewireHelper.resolveLivewireComponentPhpPath(componentName, currentDir);
        
        if (!phpFilePath) return;
        
        const properties = LivewireHelper.getPublicPropertiesFromPhpFile(phpFilePath);
        const items = [];
        
        for (const propName of properties) {
          const kebabName = LivewireHelper.toKebabCase(propName);
          const regularItem = new vscode.CompletionItem(kebabName, vscode.CompletionItemKind.Field);
          regularItem.detail = `Property from ${componentName}`;
          regularItem.documentation = `Regular attribute for ${propName}`;
          
          const bindItem = new vscode.CompletionItem(`:${kebabName}`, vscode.CompletionItemKind.Field);
          bindItem.detail = `Binding for ${componentName}`;
          bindItem.documentation = `Data binding for ${propName}`;
          
          items.push(regularItem);
          items.push(bindItem);
        }
        
        return items;
      }
    },
    ' ',
    ':'
  );

  // Enhanced completion provider for @livewire('component-name', [...]) array attributes
  const livewireArrayAttributeCompletionProvider = vscode.languages.registerCompletionItemProvider(
    bladeSelector,
    {
      async provideCompletionItems(document, position) {
        let openParenLine = -1;
        let componentName = '';
        
        // Scan up to 10 lines backwards to find a livewire directive
        const scanLimit = Math.max(0, position.line - 10);
        for (let i = position.line; i >= scanLimit; i--) {
          const checkLine = document.lineAt(i).text;
          const match = checkLine.match(/@livewire\(['"]([a-zA-Z0-9_.\-]+)['"]/);
          if (match) {
            openParenLine = i;
            componentName = match[1];
            break;
          }
        }
        
        if (openParenLine === -1) return;

        // Find closing paren to make sure we're within the array argument
        let foundClosingParen = false;
        for (let i = openParenLine; i < document.lineCount; i++) {
          const text = document.lineAt(i).text;
          if (text.includes(')') && i < position.line) {
            foundClosingParen = true;
            break;
          }
        }
        
        if (foundClosingParen) return;

        const phpPath = LivewireHelper.resolveLivewireComponentPhpPath(componentName, path.dirname(document.uri.fsPath));
        if (!phpPath) return;

        // Check if we're in a key position in the array (not in a value position)
        const lineUpToCursor = document.lineAt(position.line).text.substring(0, position.character);
        const lastComma = lineUpToCursor.lastIndexOf(',');
        const lastBracket = lineUpToCursor.lastIndexOf('[');
        const lastArrow = lineUpToCursor.lastIndexOf('=>');
        const lastKeyStart = Math.max(lastComma, lastBracket);

        if (lastArrow > lastKeyStart) return; // We're inside a value, not a key

        const properties = LivewireHelper.getPublicPropertiesFromPhpFile(phpPath);
        
        return properties.map(prop => {
          const kebabName = LivewireHelper.toKebabCase(prop);
          // Return the plain property name without quotes
          const item = new vscode.CompletionItem(kebabName, vscode.CompletionItemKind.Field);
          item.detail = `Property from ${componentName}`;
          item.documentation = `Array key for ${prop}`;
          // Don't add quotes to the insertion text
          item.insertText = kebabName;
          return item;
        });
      }
    },
    "'", ":", '"'
  );

  context.subscriptions.push(
    disposable,
    definitionProvider,
    viewDefinitionProvider,
    enhancedViewDefinitionProvider,
    bladeLivewireProvider,
    livewireAttributeCompletionProvider,
    livewireArrayAttributeCompletionProvider
  );
}

export function deactivate() {}
