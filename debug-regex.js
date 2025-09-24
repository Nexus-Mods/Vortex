// Debug the regex pattern matching
function globToRegex(pattern) {
  console.log(`🔍 Converting pattern: "${pattern}"`);
  
  // Escape special regex characters
  let escapedPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&');  // Escape regex special characters
  console.log(`🔧 After escaping special chars: "${escapedPattern}"`);
  
  escapedPattern = escapedPattern
    .replace(/\\\?\\\?/g, '.*');  // Convert ?? to .*
  console.log(`🔧 After converting ?: "${escapedPattern}"`);
  
  escapedPattern = escapedPattern
    .replace(/\\\*\\\*/g, '.*');  // Convert ** to .*
  console.log(`🔧 After converting **: "${escapedPattern}"`);
  
  escapedPattern = escapedPattern
    .replace(/\\\*/g, '[^/]*');  // Convert * to [^/]*
  console.log(`🔧 After converting *: "${escapedPattern}"`);
  
  const finalPattern = `^${escapedPattern}$`;
  console.log(`✅ Final regex pattern: "${finalPattern}"`);
  
  return new RegExp(finalPattern);
}

// Test cases
console.log('🧪 === Test 1: Simple pattern ===');
const regex1 = globToRegex('*.js');
console.log('📋 Regex:', regex1);
console.log('🔍 Test "test.js":', regex1.test('test.js'));
console.log('🔍 Test "src/test.js":', regex1.test('src/test.js'));

console.log('\n🧪 === Test 2: Recursive pattern ===');
const regex2 = globToRegex('**/*.ts');
console.log('📋 Regex:', regex2);
console.log('🔍 Test "test.ts":', regex2.test('test.ts'));
console.log('🔍 Test "src/test.ts":', regex2.test('src/test.ts'));
console.log('🔍 Test "src/util/test.ts":', regex2.test('src/util/test.ts'));

console.log('\n🧪 === Test 3: Complex pattern ===');
const regex3 = globToRegex('src/**/*.ts');
console.log('📋 Regex:', regex3);
console.log('🔍 Test "test.ts":', regex3.test('test.ts'));
console.log('🔍 Test "src/test.ts":', regex3.test('src/test.ts'));
console.log('🔍 Test "src/util/test.ts":', regex3.test('src/util/test.ts'));