// Debug the regex pattern matching with correct order
function globToRegex(pattern) {
  console.log(`Converting pattern: "${pattern}"`);
  
  // First escape special regex characters (but not * and ?)
  let escapedPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  console.log(`After escaping special chars: "${escapedPattern}"`);
  
  // Then handle ** (double star) patterns
  escapedPattern = escapedPattern.replace(/\*\*/g, '(.*)');
  console.log(`After converting **: "${escapedPattern}"`);
  
  // Then handle * (single star) patterns
  escapedPattern = escapedPattern.replace(/\*/g, '[^/]*');
  console.log(`After converting *: "${escapedPattern}"`);
  
  // Finally handle ? patterns
  escapedPattern = escapedPattern.replace(/\?/g, '.');
  console.log(`After converting ?: "${escapedPattern}"`);

  // Ensure the pattern matches the entire path
  const finalPattern = `^${escapedPattern}$`;
  console.log(`Final regex pattern: "${finalPattern}"`);
  
  return new RegExp(finalPattern);
}

// Test cases
console.log('=== Test 1: Simple pattern ===');
const regex1 = globToRegex('*.js');
console.log('Regex:', regex1);
console.log('Test "test.js":', regex1.test('test.js'));
console.log('Test "src/test.js":', regex1.test('src/test.js'));

console.log('\n=== Test 2: Recursive pattern ===');
const regex2 = globToRegex('**/*.ts');
console.log('Regex:', regex2);
console.log('Test "test.ts":', regex2.test('test.ts'));
console.log('Test "src/test.ts":', regex2.test('src/test.ts'));
console.log('Test "src/util/test.ts":', regex2.test('src/util/test.ts'));

console.log('\n=== Test 3: Complex pattern ===');
const regex3 = globToRegex('src/**/*.ts');
console.log('Regex:', regex3);
console.log('Test "test.ts":', regex3.test('test.ts'));
console.log('Test "src/test.ts":', regex3.test('src/test.ts'));
console.log('Test "src/util/test.ts":', regex3.test('src/util/test.ts'));