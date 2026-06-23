import { supabase } from './supabaseClient';

// ─── Constants ───────────────────────────────────────────
export const LIMITS = {
  chat:      10,
  quiz:       3,
  flashcard:  3,
};

// ─── Check, reset if new day, and increment usage ────────
export async function checkAndIncrementUsage(userId, feature) {
  const maxAllowed = LIMITS[feature];
  const today = new Date().toISOString().split('T')[0];

  // Get current usage row
  const { data } = await supabase
    .from('usage_limits')
    .select('count, reset_date')
    .eq('user_id', userId)
    .eq('feature', feature)
    .single();

  // No row yet → insert fresh
  if (!data) {
    await supabase.from('usage_limits').insert({
      user_id: userId,
      feature,
      count: 1,
      reset_date: today,
    });
    return { used: 1, max: maxAllowed };
  }

  // New day → reset count
  if (data.reset_date < today) {
    await supabase.from('usage_limits')
      .update({ count: 1, reset_date: today })
      .eq('user_id', userId)
      .eq('feature', feature);
    return { used: 1, max: maxAllowed };
  }

  // Limit reached → throw
  if (data.count >= maxAllowed) {
    throw new Error(`Daily limit reached. Come back tomorrow!`);
  }

  // Normal increment
  const newCount = data.count + 1;
  await supabase.from('usage_limits')
    .update({ count: newCount })
    .eq('user_id', userId)
    .eq('feature', feature);

  return { used: newCount, max: maxAllowed };
}

// ─── Just fetch usage without incrementing (for display) ─
export async function getUsage(userId, feature) {
  const maxAllowed = LIMITS[feature];
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('usage_limits')
    .select('count, reset_date')
    .eq('user_id', userId)
    .eq('feature', feature)
    .single();

  if (!data || data.reset_date < today) {
    return { used: 0, max: maxAllowed };
  }

  return { used: data.count, max: maxAllowed };
}