/**
 * Date proposal related types for the dating app (Supabase Aligned)
 * Mirrored from stellr-backend/types/date-proposal.ts for frontend use.
 * Ideally, this would be a shared package.
 */

// Assuming these types are also available or defined within the frontend project,
// or will be copied/shared similarly.
// For now, defining them locally if not.
export type DateActivityType = string; // Placeholder if not shared
export type ZodiacSign = string;       // Placeholder if not shared

/**
 * Status of a date proposal, aligned with Supabase schema.
 */
export type DateProposalStatus =
  | 'pending'                // Waiting for response
  | 'accepted'               // Date accepted
  | 'rejected'               // Date rejected
  | 'cancelled_by_proposer'  // Date cancelled by the proposer
  | 'cancelled_by_recipient' // Date cancelled by the recipient
  | 'completed';               // Date completed

/**
 * Structure for the activity_details JSONB field.
 */
export interface ActivityDetails {
  type: DateActivityType;
  relatedZodiacSign?: ZodiacSign;
  customTitle?: string; 
  customDescription?: string;
}

/**
 * Date proposal interface, aligned with Supabase 'date_proposals' table.
 * For frontend use, Date objects might be preferred over ISO strings for easier handling.
 */
export interface DateProposalFE { // Suffix FE for Frontend if types differ slightly
  id: string;                     
  match_id: string;               
  proposer_id: string;            
  recipient_id: string;           
  conversation_id: string | null; 
  
  proposed_datetime: Date; // Changed to Date for frontend ease of use
  location: string | null;        
  notes: string | null;           
  
  status: DateProposalStatus;     
  activity_details: ActivityDetails | null; 
  
  created_at: Date;             // Changed to Date
  updated_at: Date;             // Changed to Date
}

/**
 * Interface for creating a new date proposal for Supabase.
 * Frontend will construct this and send it to the Edge Function.
 */
export interface CreateDateProposalInput {
  match_id: string;
  proposer_id: string;
  recipient_id: string;
  conversation_id?: string | null; 
  
  proposed_datetime: Date; // Input as Date, Edge function expects ISO string in payload
  location?: string | null;
  notes?: string | null;
  activity_details: ActivityDetails; 
}

/**
 * Interface for updating a date proposal status for Supabase.
 */
export interface UpdateDateProposalStatusInput {
  proposal_id: string;
  status: DateProposalStatus;
}
