import { signIn, signOut, getSession, onAuthStateChange, getAuthErrorMessage } from './services/authService.js';
import { initCloudStateUI } from './cloudState.js';

export function initAuth(){
  const cloudStateUI = initCloudStateUI();
  const loginButton = document.getElementById('openAuth');
  const account = document.getElementById('authAccount');
  const emailLabel = document.getElementById('authEmail');
  const logoutButton = document.getElementById('signOut');
  const status = document.getElementById('authStatus');
  const dialog = document.getElementById('authDialog');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('authEmailInput');
  const passwordInput = document.getElementById('authPasswordInput');
  const submitButton = document.getElementById('authSubmit');
  const errorLabel = document.getElementById('authError');
  let busy = false;
  let revision = 0;
  let unsubscribe;
  let currentSession = null;

  function renderSession(session){
    currentSession = session;
    const signedIn = Boolean(session?.user);
    loginButton.hidden = signedIn;
    account.hidden = !signedIn;
    emailLabel.textContent = session?.user?.email || '';
    cloudStateUI.setSession(session);
    if(signedIn && dialog.open) dialog.close();
  }

  function setBusy(value,action){
    busy = value;
    form.setAttribute('aria-busy',String(value));
    submitButton.disabled = value;
    emailInput.disabled = value;
    passwordInput.disabled = value;
    logoutButton.disabled = value;
    submitButton.textContent = value && action === 'signIn' ? '登录中…' : '登录';
    logoutButton.textContent = value && action === 'signOut' ? '退出中…' : '退出';
  }

  loginButton.addEventListener('click',()=>{
    errorLabel.textContent = status.textContent;
    dialog.showModal();
  });
  document.getElementById('closeAuth').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{passwordInput.value='';});

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    console.info('[Suze Auth] submit received');
    if(busy){
      console.info('[Suze Auth] submit ignored: already pending');
      return;
    }
    errorLabel.textContent = '';
    status.textContent = '';
    // Validate here so a native required-field block cannot hide the submit event.
    if(!form.checkValidity()){
      errorLabel.textContent = !emailInput.validity.valid
        ? (emailInput.validity.valueMissing ? '请填写邮箱。' : '请输入有效的邮箱地址。')
        : '请填写密码。';
      console.info('[Suze Auth] submit blocked: invalid fields');
      (!emailInput.validity.valid ? emailInput : passwordInput).focus();
      return;
    }
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    setBusy(true,'signIn');
    revision++;
    try{
      const session = await signIn(email,password);
      renderSession(session);
      console.info('[Suze Auth] sign-in succeeded');
    }catch(error){
      console.info('[Suze Auth] sign-in failed');
      const message = getAuthErrorMessage(error);
      errorLabel.textContent = message;
      status.textContent = message;
    }finally{
      setBusy(false);
      if(dialog.open) passwordInput.focus();
    }
  });

  logoutButton.addEventListener('click',async()=>{
    if(busy) return;
    status.textContent = '';
    setBusy(true,'signOut');
    revision++;
    try{
      await signOut();
      renderSession(null);
      loginButton.focus();
    }catch(error){
      status.textContent = currentSession
        ? '退出未完成。' + getAuthErrorMessage(error)
        : '已退出当前浏览器；云端会话撤销尚未确认。请检查网络。本地功能可继续使用。';
    }finally{setBusy(false);}
  });

  // Auth restoration runs after the local app is ready and never gates its controls.
  async function restoreSession(){
    try{
      unsubscribe = onAuthStateChange((_event,session)=>{
        revision++;
        renderSession(session);
        status.textContent = '';
        errorLabel.textContent = '';
      });
      const startedAt = revision;
      const session = await getSession();
      if(revision === startedAt) renderSession(session);
    }catch(error){
      if(!currentSession && !busy) status.textContent = getAuthErrorMessage(error);
    }
  }
  loginButton.disabled = false;
  console.info('[Suze Auth] form listener ready');
  void restoreSession();
  if(import.meta.hot) import.meta.hot.dispose(()=>unsubscribe?.());
}
