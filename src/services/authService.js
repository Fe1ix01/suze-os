import { AuthConfigurationError, getSupabaseClient } from './supabaseClient.js';

export async function signIn(email,password){
  console.info('[Suze Auth] signIn service called');
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({email:email.trim(),password});
  if(error) throw error;
  return data.session;
}

export async function signOut(){
  // Sign out this browser session; leave sessions on other devices alone.
  const { error } = await getSupabaseClient().auth.signOut({scope:'local'});
  if(error) throw error;
}

export async function getSession(){
  const { data, error } = await getSupabaseClient().auth.getSession();
  if(error) throw error;
  return data.session;
}

export async function getUser(){
  const { data, error } = await getSupabaseClient().auth.getUser();
  if(error) throw error;
  return data.user;
}

// Keep callbacks synchronous and free of further Supabase calls.
export function onAuthStateChange(callback){
  const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

// Never render raw SDK/server errors, URLs, keys, or tokens into the page.
export function getAuthErrorMessage(error){
  if(error instanceof AuthConfigurationError) return error.message;
  const messages = {
    invalid_credentials: '邮箱或密码不正确，请检查后重试。',
    email_not_confirmed: '此账户邮箱尚未验证，请先在 Supabase 中确认已有账户。',
    user_banned: '此账户暂时无法登录，请检查 Supabase 中的账户状态。',
    email_provider_disabled: 'Email + Password 登录未启用，请检查 Supabase Auth 配置。',
    signup_disabled: '此账户无法登录，请使用已经创建并验证的账户。',
    over_request_rate_limit: '登录请求过于频繁，请稍后再试。',
    request_timeout: '云端登录请求超时，请检查网络后重试。本地功能可继续使用。',
  };
  if(messages[error?.code]) return messages[error.code];
  if(error?.status === 429) return messages.over_request_rate_limit;
  if(['AuthRetryableFetchError','AbortError','TimeoutError','TypeError'].includes(error?.name)){
    return '暂时无法连接 Supabase，请检查网络后重试。本地功能可继续使用。';
  }
  return '账户操作未完成，请稍后重试；若持续失败，请检查 Supabase Auth 配置。本地功能可继续使用。';
}
