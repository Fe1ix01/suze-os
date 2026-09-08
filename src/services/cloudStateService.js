import { getSession, getAuthErrorMessage } from './authService.js';
import { AuthConfigurationError, getSupabaseClient } from './supabaseClient.js';

// Version of the cloud envelope, independent of the existing local data formats.
export const CLOUD_SCHEMA_VERSION = 1;
const CLOUD_COLUMNS = 'user_id,schema_version,updated_at,core_state,job_radar_state';

export class CloudStateError extends Error {
  constructor(message){
    super(message);
    this.name = 'CloudStateError';
  }
}

async function requireUser(){
  const session = await getSession();
  if(!session?.user?.id) throw new CloudStateError('请先登录，再操作云端数据。');
  return {client:getSupabaseClient(),userId:session.user.id};
}

function checkResult(error,status){
  if(!error) return;
  if(status === 401) throw new CloudStateError('登录状态已失效，请重新登录后重试。');
  if(status === 403 || error.code === '42501'){
    throw new CloudStateError('没有当前账户的云端数据权限，请检查 user_state 的 RLS 和表权限。');
  }
  if(['42P01','PGRST205'].includes(error.code)){
    throw new CloudStateError('未找到 user_state 表，请检查 Supabase 表配置。');
  }
  if(['42703','PGRST204','23502','23514'].includes(error.code)){
    throw new CloudStateError('user_state 字段或约束不匹配，请检查 user_id、schema_version、updated_at、core_state 和 job_radar_state。');
  }
  if(error.code === '42P10'){
    throw new CloudStateError('user_state.user_id 需要主键或唯一约束，才能按账户保存云端快照。');
  }
  if(!status || status >= 500){
    throw new CloudStateError('暂时无法连接云端，请检查网络后手动重试。');
  }
  throw new CloudStateError('云端操作未完成，请检查 user_state 配置后重试。');
}

export async function getCloudState(){
  const {client,userId} = await requireUser();
  const {data,error,status} = await client.from('user_state')
    .select(CLOUD_COLUMNS).eq('user_id',userId).maybeSingle();
  checkResult(error,status);
  return data;
}

export async function hasCloudState(){
  const {client,userId} = await requireUser();
  const {data,error,status} = await client.from('user_state')
    .select('user_id').eq('user_id',userId).maybeSingle();
  checkResult(error,status);
  return data !== null;
}

export async function saveCloudState(coreState,jobRadarState,{isCurrent=()=>true}={}){
  const {client,userId} = await requireUser();
  if(!isCurrent()) throw new CloudStateError('账户已变化，已取消此次上传。请重新确认后再试。');
  if(![coreState,jobRadarState].every(value=>value !== null && typeof value === 'object' && !Array.isArray(value))){
    throw new CloudStateError('本地快照格式无效，已取消上传。');
  }
  const {data,error,status} = await client.from('user_state').upsert({
    user_id: userId,
    schema_version: CLOUD_SCHEMA_VERSION,
    core_state: coreState,
    job_radar_state: jobRadarState,
    // A database updated_at trigger, when present, remains authoritative.
    updated_at: new Date().toISOString(),
  },{onConflict:'user_id'}).select(CLOUD_COLUMNS).single();
  checkResult(error,status);
  return data;
}

export function getCloudErrorMessage(error){
  if(error instanceof CloudStateError) return error.message;
  if(error instanceof AuthConfigurationError) return getAuthErrorMessage(error);
  // Raw server errors may contain request details; never display or log them.
  return '云端操作未完成，请检查登录状态和网络后重试。本地数据保持不变。';
}
