export interface ActivityCardData {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  backDescription: string;
}

export interface ZodiacCardData {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  backDescription: string;
}

// Single source of truth for date-night activity cards
export const ACTIVITY_CARDS: ActivityCardData[] = [
  // New canonical Date Activities list
  { id: 'dinner',               name: 'Dinner',               emoji: '🍽️', shortDescription: 'Share a meal together',                backDescription: 'Enjoy a cozy restaurant and great conversation.' },
  { id: 'coffee',               name: 'Coffee',               emoji: '☕',  shortDescription: 'Casual coffee meetup',                 backDescription: 'Relaxed chat over your favorite brews.' },
  { id: 'drinks',               name: 'Drinks',               emoji: '🍸', shortDescription: 'Evening drinks & vibes',               backDescription: 'Meet at a bar or lounge for cocktails.' },
  { id: 'movies',               name: 'Movies',               emoji: '🎬', shortDescription: 'Catch a film together',                backDescription: 'Cinema night or a cozy at-home movie.' },
  { id: 'museum_gallery',       name: 'Museum/Gallery',       emoji: '🎨', shortDescription: 'Explore art and culture',              backDescription: 'Visit a museum or gallery and compare favorites.' },
  { id: 'activity',             name: 'Activity',             emoji: '🎯', shortDescription: 'Do something hands-on',               backDescription: 'Bowling, games, mini-golf—keep it interactive.' },
  { id: 'park',                 name: 'Park',                 emoji: '🏞️', shortDescription: 'Outdoors in the park',                backDescription: 'Walk, picnic, and enjoy the fresh air.' },
  { id: 'adventure_experience', name: 'Adventure/Experience', emoji: '🧭', shortDescription: 'Try something adventurous',           backDescription: 'Escape room, climbing, or a unique experience.' },
  { id: 'cooking',              name: 'Cooking',              emoji: '👨‍🍳', shortDescription: 'Cook or take a class',               backDescription: 'Make something delicious together at home or class.' },
];

export const ZODIAC_CARDS: ZodiacCardData[] = [
  { id: 'aries', name: 'Aries', emoji: '♈', shortDescription: 'Bold & Energetic', backDescription: 'Dynamic and confident, ready for adventure.' },
  { id: 'taurus', name: 'Taurus', emoji: '♉', shortDescription: 'Grounded & Loyal', backDescription: 'Values comfort, loyalty, and great food.' },
  { id: 'gemini', name: 'Gemini', emoji: '♊', shortDescription: 'Curious & Witty', backDescription: 'Loves conversation and clever banter.' },
  { id: 'cancer', name: 'Cancer', emoji: '♋', shortDescription: 'Caring & Intuitive', backDescription: 'Nurturing soul with deep emotions.' },
  { id: 'leo', name: 'Leo', emoji: '♌', shortDescription: 'Warm & Dazzling', backDescription: 'A generous heart that shines bright.' },
  { id: 'virgo', name: 'Virgo', emoji: '♍', shortDescription: 'Thoughtful & Steady', backDescription: 'Practical, kind, and detail-oriented.' },
  { id: 'libra', name: 'Libra', emoji: '♎', shortDescription: 'Charming & Balanced', backDescription: 'Seeks harmony and connection.' },
  { id: 'scorpio', name: 'Scorpio', emoji: '♏', shortDescription: 'Magnetic & Deep', backDescription: 'Intense bonds and strong intuition.' },
  { id: 'sagittarius', name: 'Sagittarius', emoji: '♐', shortDescription: 'Adventurous & Honest', backDescription: 'Free spirit who loves to explore.' },
  { id: 'capricorn', name: 'Capricorn', emoji: '♑', shortDescription: 'Driven & Loyal', backDescription: 'Ambitious with a steady heart.' },
  { id: 'aquarius', name: 'Aquarius', emoji: '♒', shortDescription: 'Original & Caring', backDescription: 'Big-picture thinker with compassion.' },
  { id: 'pisces', name: 'Pisces', emoji: '♓', shortDescription: 'Romantic & Dreamy', backDescription: 'Imaginative and deeply empathetic.' },
];

export const ACTIVITY_NAMES = ACTIVITY_CARDS.map(a => a.name);
export const ACTIVITY_IDS = ACTIVITY_CARDS.map(a => a.id);
