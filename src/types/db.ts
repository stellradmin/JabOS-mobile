// Helper aliases to consume generated Supabase Database type without generics in this plan.
// This file depends on generated types at src/types/database.types.ts

import { Database } from "./supabase";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
