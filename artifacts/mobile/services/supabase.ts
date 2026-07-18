/**
 * @deprecated Use '@/lib/supabase/client' directly.
 *
 * Backward-compatibility re-export.
 * This file keeps existing imports from breaking while the codebase
 * migrates to the new lib/supabase/ module structure.
 *
 * Migrate all imports from '@/services/supabase' to '@/lib/supabase/client'.
 */

export {
  supabase,
  requireSupabase,
  isSupabaseConfigured,
} from '@/lib/supabase/client';
