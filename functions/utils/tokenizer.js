// functions/utils/tokenizer.js
const fs = require('fs');
const path = require('path');

// Load vocabulary from file (simplified version)
const vocabPath = path.join(__dirname, '../models/vocab.json');
const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));

// Simple tokenizer implementation (simplified for Firebase)
function tokenize(text, maxLength = 128) {
  // This is a simplified tokenizer implementation
  // In a real-world scenario, you would use a proper tokenizer library
  
  // Normalize text
  const normalizedText = text.toLowerCase().trim();
  
  // Split into words and remove empty strings
  const words = normalizedText.split(/\s+/).filter(word => word.length > 0);
  
  // Convert words to tokens (simplified)
  const tokens = [];
  words.forEach(word => {
    if (vocab[word]) {
      tokens.push(vocab[word]);
    } else {
      // Handle unknown words
      tokens.push(vocab['[UNK]']);
    }
  });
  
  // Add special tokens
  const input_ids = [vocab['[CLS]'], ...tokens];
  if (input_ids.length > maxLength - 1) {
    input_ids.length = maxLength - 1;
  }
  input_ids.push(vocab['[SEP]']);
  
  // Pad to max length
  while (input_ids.length < maxLength) {
    input_ids.push(vocab['[PAD]']);
  }
  
  // Create attention mask (1 for real tokens, 0 for padding)
  const attention_mask = input_ids.map(id => id === vocab['[PAD]'] ? 0 : 1);
  
  return {
    input_ids,
    attention_mask
  };
}

module.exports = {
  tokenize
};
