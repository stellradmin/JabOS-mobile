// Barrel export file following DRY principle and clean imports
export { RefactoredMatchCard as MatchCard } from './MatchCardRefactored';
export { MatchCardContainer } from './MatchCardContainer';
export { MatchCardNavigation } from './MatchCardNavigation';
export { MatchCardHeader } from './MatchCardHeader';
export { MatchCardContent } from './MatchCardContent';

// Type exports for external use
export type { 
  MatchProfile, 
  MatchCardProps,
  MatchCardActions,
  MatchCardNavigationProps,
  MatchCardDataProps
} from './MatchCardContainer';