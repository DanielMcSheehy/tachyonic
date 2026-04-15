/**
 * Fast Apply Example - Standalone Edit Merging
 * 
 * This demonstrates the actual reverse-engineered algorithm
 * that merges edit snippets WITHOUT calling any external API.
 */
import { fastApply, parseSnippet, isMarker, batchApply } from '../src/core';

console.log('=== Fast Apply Engine Demo ===\n');

// Example 1: Simple edit
console.log('1. Simple Function Edit');
console.log('=======================');

const original1 = `function greet(name: string) {
  console.log("Hello, " + name);
  return "Greeting sent";
}`;

const edit1 = `// ... existing code ...
  console.log("Hello, " + name);
  const timestamp = new Date().toISOString();
  console.log("Timestamp:", timestamp);
// ... existing code ...`;

const result1 = fastApply(original1, edit1);
console.log('Original:', original1);
console.log('\nEdit snippet:', edit1);
console.log('\nResult:', result1.success ? '✅ Success' : '❌ Failed');
console.log('Output:');
console.log(result1.output);
console.log('\nStats:', result1.stats);

// Example 2: Multiple edits
console.log('\n\n2. Batch Apply Multiple Edits');
console.log('============================');

const original2 = `class UserService {
  private users: User[] = [];
  
  getUser(id: string): User {
    return this.users.find(u => u.id === id);
  }
  
  createUser(data: CreateUserDto): User {
    const user = new User(data);
    this.users.push(user);
    return user;
  }
}`;

const edits = [
  {
    instructions: 'Add null check to getUser',
    snippet: `// ... existing code ...
  getUser(id: string): User {
    const user = this.users.find(u => u.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
// ... existing code ...`,
  },
  {
    instructions: 'Add validation to createUser',
    snippet: `// ... existing code ...
  createUser(data: CreateUserDto): User {
    if (!data.email || !data.name) {
      throw new Error('Email and name are required');
    }
    const user = new User(data);
    this.users.push(user);
    return user;
  }
// ... existing code ...`,
  },
];

const batchResult = batchApply(original2, edits.map(e => ({ 
  instructions: e.instructions, 
  snippet: e.snippet 
})));

console.log('Batch results:');
batchResult.results.forEach((r, i) => {
  console.log(`  Edit ${i + 1}: ${r.success ? '✅' : '❌'}`);
});
console.log('\nFinal output:');
console.log(batchResult.finalOutput);

// Example 3: Fuzzy matching
console.log('\n\n3. Fuzzy Matching with Whitespace Differences');
console.log('===============================================');

const original3 = `function calculate() {
    const x = 1;
    const y = 2;
    return x + y;
}`;

// Note: different indentation in snippet
const edit3 = `// ... existing code ...
  const x = 1;
  const z = 3;
  const y = 2;
// ... existing code ...`;

const result3 = fastApply(original3, edit3, { fuzzyMatching: true });
console.log('Result:', result3.success ? '✅ Success with fuzzy matching' : '❌ Failed');
console.log('Conflicts:', result3.conflicts.length);
console.log('Output:');
console.log(result3.output);

// Example 4: Detect markers
console.log('\n\n4. Marker Detection');
console.log('===================');

const snippets = [
  '// ... existing code ...',
  '/* ... existing code ... */',
  '# ... existing code ...',
  'const x = 1;',
];

snippets.forEach(s => {
  console.log(`"${s}" => ${isMarker(s) ? 'MARKER' : 'NOT A MARKER'}`);
});

console.log('\n\n✨ Fast Apply is purely deterministic - no LLM calls required!');
