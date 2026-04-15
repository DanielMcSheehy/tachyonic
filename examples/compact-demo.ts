/**
 * Compact Engine Example - Context Compression
 * 
 * This demonstrates the TF-IDF based compression algorithm
 * that removes irrelevant lines WITHOUT calling any external API.
 */
import { compact, compactMessages, compactCode } from '../src/core';

console.log('=== Compact Engine Demo ===\n');

// Example 1: Basic compression
console.log('1. Basic Text Compression');
console.log('=========================');

const longText = `This is the first line of some context.
This is the second line with more information.
Here's a third line that continues the pattern.
Fourth line is here with more details.
Fifth line continues the explanation.
Sixth line provides additional context.
Seventh line has more relevant content.
Eighth line is almost the end.
Ninth line is getting close to done.
Tenth line is the final one.`;

const result1 = compact(longText, undefined, { targetRatio: 0.5 });
console.log('Original lines:', result1.originalLines);
console.log('Kept lines:', result1.keptLines);
console.log('Compression ratio:', (result1.compressionRatio * 100).toFixed(1) + '%');
console.log('\nCompressed output:');
console.log(result1.output);

// Example 2: Query-aware compression
console.log('\n\n2. Query-Aware Compression');
console.log('==========================');

const codeContext = `// Database connection setup
const pool = new Pool(config);

// Express middleware configuration
app.use(cors());
app.use(express.json());

// Authentication middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send('Unauthorized');
  next();
}

// JWT token validation
function validateToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Route handlers
app.get('/api/users', getUsers);
app.post('/api/login', login);`;

// Compress with different queries
const queries = ['JWT authentication', 'database connection', 'route handlers'];

for (const query of queries) {
  const result = compact(codeContext, query, { targetRatio: 0.4 });
  console.log(`\nQuery: "${query}"`);
  console.log(`Kept ${result.keptLines}/${result.originalLines} lines`);
  console.log('Output preview:');
  console.log(result.output.split('\n').slice(0, 5).join('\n'));
}

// Example 3: Chat message compression
console.log('\n\n3. Chat Message Compression');
console.log('===========================');

const chatHistory = [
  { role: 'system', content: 'You are a helpful coding assistant.' },
  { role: 'user', content: 'How do I reverse a string in JavaScript?' },
  { role: 'assistant', content: 'You can use the split().reverse().join() method.' },
  { role: 'user', content: 'Can you show me with TypeScript types?' },
  { role: 'assistant', content: `Here's how with TypeScript:

function reverseString(str: string): string {
  return str.split('').reverse().join('');
}` },
  { role: 'user', content: 'Now I need to handle Unicode properly.' },
  { role: 'assistant', content: 'For Unicode, use Array.from() instead of split().' },
  { role: 'user', content: 'Help me implement JWT authentication in my Express app.' },
];

const compressed = compactMessages(chatHistory, 'JWT authentication', {
  preserveRecent: 2,
  targetRatio: 0.5,
});

console.log('Original token estimate:', compressed.stats.originalTokens);
console.log('Compressed token estimate:', compressed.stats.compressedTokens);
console.log('Reduction:', ((1 - compressed.stats.ratio) * 100).toFixed(1) + '%');

// Example 4: Code-aware compression
console.log('\n\n4. Code-Aware Compression');
console.log('========================');

const sourceCode = `import { useState, useEffect } from 'react';
import { fetchUser } from './api';

// Component props interface
interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

// Helper function
function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

// Main component
export function UserProfile({ userId, onUpdate }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchUser(userId).then(data => {
      setUser(data);
      setLoading(false);
    });
  }, [userId]);
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;
  
  return (
    <div className="user-profile">
      <h1>{user.name}</h1>
      <p>Joined: {formatDate(user.joinDate)}</p>
    </div>
  );
}`;

const codeResult = compactCode(sourceCode, 'UserProfile component', {
  targetRatio: 0.5,
  language: 'typescript',
});

console.log('Kept ranges:', codeResult.keptRanges.length);
console.log('Filtered ranges:', codeResult.filteredRanges.length);
console.log('\nCompressed code:');
console.log(codeResult.output);

console.log('\n\n✨ Compact uses TF-IDF scoring - no LLM calls required!');
console.log('Every kept line is byte-identical to the original.');
