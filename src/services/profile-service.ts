import { supabase } from '../lib/supabase';

export class ProfileService {
  async getProfile(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}

export default ProfileService;

