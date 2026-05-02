import { createClient } from '@supabase/supabase-js';

const urlName = 'NEXT_PUBLIC_' + 'SUPABASE_URL';
const keyName = 'NEXT_PUBLIC_' + 'SUPABASE_ANON_KEY';

export const db = createClient(process.env[urlName] || '', process.env[keyName] || '');
