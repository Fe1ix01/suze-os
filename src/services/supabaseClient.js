import { createClient } from '@supabase/supabase-js';

export class AuthConfigurationError extends Error {
  constructor(message){
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

let client;

// Lazy initialization keeps a missing/invalid Auth configuration out of local startup.
export function getSupabaseClient(){
  if(client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const missing = [];
  if(!url) missing.push('VITE_SUPABASE_URL');
  if(!publishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if(missing.length){
    throw new AuthConfigurationError(`云端登录未配置：缺少 ${missing.join('、')}。请检查本地环境变量并重启 Vite。本地功能可继续使用。`);
  }
  try{
    const parsed = new URL(url);
    if(!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
  }catch{
    throw new AuthConfigurationError('VITE_SUPABASE_URL 格式无效。请检查项目 URL 并重启 Vite。本地功能可继续使用。');
  }
  if(!publishableKey.startsWith('sb_publishable_')){
    throw new AuthConfigurationError('VITE_SUPABASE_PUBLISHABLE_KEY 必须配置为浏览器端 Publishable Key。请检查配置并重启 Vite。');
  }
  try{
    client = createClient(url,publishableKey,{
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: {
        // Bound network waits without cancelling or blocking any local feature.
        fetch: async (input,options={}) => {
          // AbortSignal.any is unavailable in Chrome 109. Preserve caller cancellation
          // and the same 12s timeout without relying on newer static signal methods.
          const controller = new AbortController();
          const abort = ()=>controller.abort(options.signal?.reason);
          if(options.signal?.aborted) abort();
          else options.signal?.addEventListener('abort',abort,{once:true});
          const timer = setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),12000);
          const isTokenRequest = new URL(input instanceof Request ? input.url : input).pathname === '/auth/v1/token';
          try{
            if(isTokenRequest) console.info('[Suze Auth] token request started');
            const response = await globalThis.fetch(input,{...options,signal:controller.signal});
            if(isTokenRequest) console.info('[Suze Auth] token response status:',response.status);
            return response;
          }finally{
            clearTimeout(timer);
            options.signal?.removeEventListener('abort',abort);
          }
        },
      },
    });
  }catch{
    throw new AuthConfigurationError('云端登录初始化失败。请检查 Supabase 环境变量和浏览器存储权限。本地功能可继续使用。');
  }
  return client;
}
