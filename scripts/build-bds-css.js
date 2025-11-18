const fs = require('fs');
const path = require('path');

const IMPORT_REGEX = /@import\s+url?\(\s*["']?(.*?)["']?\s*\)\s*;/g;

function resolveImports(filePath, seen = new Set()) {
  const absolutePath = path.resolve(filePath);
  if (seen.has(absolutePath)) {
    return '';
  }
  seen.add(absolutePath);

  let css = fs.readFileSync(absolutePath, 'utf8');

  return css.replace(IMPORT_REGEX, (_match, importPath) => {
    if (/^https?:\/\//i.test(importPath)) {
      return `@import url("${importPath}");`;
    }

    const resolvedPath = path.resolve(path.dirname(absolutePath), importPath);
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`Skipping missing import: ${importPath} (from ${filePath})`);
      return '';
    }

    return resolveImports(resolvedPath, seen);
  });
}

function buildBundle() {
  const entryFiles = [
    'public/tokens/tokens.css',
    'public/elements/elements.css',
    'public/blocks/blocks.css',
    'public/templates/templates.css',
  ];

  const seen = new Set();
  const bundledCss = entryFiles
    .map((filePath) => resolveImports(filePath, seen))
    .join('\n\n');

  const outputPath = path.resolve('public/bds.css');
  const banner =
    '/* Auto-generated bundle: tokens → elements → blocks → templates. */\n';

  fs.writeFileSync(outputPath, `${banner}${bundledCss}\n`, 'utf8');
  console.log(`Built ${outputPath}`);
}

buildBundle();
