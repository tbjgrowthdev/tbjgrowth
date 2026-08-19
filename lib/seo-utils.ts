/**
 * Basic SEO and Readability Analysis Utils
 */

export function calculateKeywordDensity(content: string, keyword: string): number {
  if (!content || !keyword) return 0;
  
  // Strip HTML tags for accurate word count
  const plainText = content.replace(/<[^>]+>/g, ' ').toLowerCase();
  const searchKeyword = keyword.toLowerCase().trim();
  
  if (!searchKeyword) return 0;

  const words = plainText.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  
  if (totalWords === 0) return 0;

  // Simple occurrence count (can be improved to match exact phrases)
  const regex = new RegExp(`\\b${searchKeyword}\\b`, 'gi');
  const matches = plainText.match(regex);
  const keywordCount = matches ? matches.length : 0;

  return (keywordCount / totalWords) * 100;
}

export function calculateReadabilityScore(content: string): { score: number, label: string } {
  if (!content) return { score: 0, label: "N/A" };

  const plainText = content.replace(/<[^>]+>/g, ' ');
  const words = plainText.split(/\s+/).filter(w => w.length > 0).length;
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  
  // Very rough syllable estimation
  const syllables = plainText.split(/\s+/).reduce((count, word) => {
    word = word.toLowerCase();
    if (word.length <= 3) return count + 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return count + (matches ? matches.length : 1);
  }, 0);

  if (words === 0 || sentences === 0) return { score: 0, label: "N/A" };

  // Flesch-Kincaid Reading Ease formula
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  
  let label = "Hard";
  if (score > 80) label = "Very Easy";
  else if (score > 60) label = "Standard";
  else if (score > 40) label = "Fairly Hard";

  return { 
    score: Math.max(0, Math.min(100, Math.round(score))), 
    label 
  };
}
