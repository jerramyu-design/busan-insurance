import {calcAge} from './domain.mjs';
    const API_URL = (window.BUSAN_INSURANCE_CONFIG && window.BUSAN_INSURANCE_CONFIG.apiUrl || '').trim();
    let sessionToken='',sessionExpiresAt=0,sessionPromise=null,authEpoch=0,statsViewEpoch=0,statsTimer;

    const app = document.getElementById('app');
    const dob = document.getElementById('dob');
    const ageStatus = document.getElementById('ageStatus');
    const choices = [...document.querySelectorAll('.choose')];
    const under15Section = document.getElementById('under15Section');
    const adultSection = document.getElementById('adultSection');
    const summary = document.getElementById('summary');
    const nameInput = document.getElementById('name');
    const idInput = document.getElementById('idno');
    const idHint = document.getElementById('idHint');
    const dialog = document.getElementById('imgDialog');
    const modalImg = document.getElementById('modalImg');
    const modalTitle = document.getElementById('modalTitle');
    const submitChoice = document.getElementById('submitChoice');
    const submitMsg = document.getElementById('submitMsg');
    const nextTravelerDialog = document.getElementById('nextTravelerDialog');
    const nextTravelerStatus = document.getElementById('nextTravelerStatus');
    const registrationComplete = document.getElementById('registrationComplete');
    const statsBtn = document.getElementById('statsBtn');
    const statsDialog = document.getElementById('statsDialog');
    const statsLocked = document.getElementById('statsLocked');
    const statsContent = document.getElementById('statsContent');
    const statsPassword = document.getElementById('statsPassword');
    const statsError = document.getElementById('statsError');
    const statsBody = document.getElementById('statsBody');
    const statPeople = document.getElementById('statPeople');
    const statY1 = document.getElementById('statY1');
    const statAdult = document.getElementById('statAdult');
    const statPremium = document.getElementById('statPremium');
    let unlockedStats = null;

    function requireApiConfig(){
      if(!API_URL || /YOUR_PROJECT_REF|PASTE_FUNCTION_URL_HERE/i.test(API_URL)){
        throw new Error('尚未設定線上資料庫 API。請先完成 Supabase 部署，再把 Function URL 填入 config.js。');
      }
    }
    async function apiRequest(payload){
      requireApiConfig();
      if(!['login','health','logout'].includes(payload.action))await ensureSession();
      const requestEpoch=authEpoch;
      const controller = new AbortController();
      const timer = setTimeout(()=>controller.abort(), 15000);
      try{
        const res = await fetch(API_URL, {
          method:'POST',
          headers:{'Content-Type':'application/json',...(sessionToken?{Authorization:'Bearer '+sessionToken}:{})},
          cache:'no-store',credentials:'omit',keepalive:payload.action==='logout',
          body:JSON.stringify(payload),
          signal:controller.signal
        });
        let data={};
        try{ data=await res.json(); }catch(_e){}
        if(requestEpoch!==authEpoch)throw new Error('本次填寫已結束。');
        if(res.status===401 && payload.action!=='login'){sessionToken='';sessionExpiresAt=0;lockStatsView();}
        if(!res.ok || data.ok===false) throw new Error(data.error || `伺服器回應錯誤（${res.status}）`);
        return data;
      }catch(e){
        if(e && e.name==='AbortError') throw new Error('連線逾時，請確認網路或資料庫服務是否正常。');
        throw e;
      }finally{ clearTimeout(timer); }
    }

    async function ensureSession(){
      if(sessionToken&&sessionExpiresAt>Date.now()+5000)return;
      if(sessionPromise)return sessionPromise;
      const epoch=authEpoch;
      const pending=apiRequest({action:'login'}).then(result=>{
        if(epoch!==authEpoch)throw new Error('本次填寫已結束。');
        sessionToken=result.token;sessionExpiresAt=Date.parse(result.expiresAt);
      }).finally(()=>{if(sessionPromise===pending)sessionPromise=null;});
      sessionPromise=pending;
      return pending;
    }
    function resetSession(){
      authEpoch++;sessionToken='';sessionExpiresAt=0;sessionPromise=null;
      lockStatsView();statsDialog.close();dialog.close();clearDialog.close();nextTravelerDialog.close();
      nextTravelerStatus.textContent='';resetTraveler();
    }

    const calcAgeOnTripDate=calcAge;
    function updateEligibility(){
      const age = calcAgeOnTripDate(dob.value);
      const adultEligible = age!==null && age>=15;
      const under15 = age!==null && age<15;
      choices.forEach(c=>{ c.disabled=!adultEligible; if(!adultEligible) c.checked=false; });
      adultSection.classList.toggle('hidden', !adultEligible);
      under15Section.classList.toggle('hidden', !under15);
      if(age===null){
        ageStatus.textContent='請先輸入出生年月日，系統會以2026年10月18日判斷是否滿15歲。';
        ageStatus.className='age-status locked';
      }else if(adultEligible){
        ageStatus.textContent=`2026年10月18日年齡：${age}歲｜已滿15歲，可選擇下方滿15歲方案。`;
        ageStatus.className='age-status';
      }else{
        ageStatus.textContent=`2026年10月18日年齡：${age}歲｜未滿15歲，只能選擇 Y1 保障型。`;
        ageStatus.className='age-status locked';
      }
      renderSummary();
    }
    dob.addEventListener('change', updateEligibility);

    function validTwId(id){
      id=(id||'').trim().toUpperCase();
      if(!/^[A-Z][12]\d{8}$/.test(id)) return false;
      const letters='ABCDEFGHJKLMNPQRSTUVXYWZIO';
      const idx=letters.indexOf(id[0]);
      if(idx<0) return false;
      const code=10+idx;
      const nums=[Math.floor(code/10),code%10,...id.slice(1).split('').map(Number)];
      const weights=[1,9,8,7,6,5,4,3,2,1,1];
      return nums.reduce((s,n,i)=>s+n*weights[i],0)%10===0;
    }
    idInput.addEventListener('input',()=>{
      idInput.value=idInput.value.toUpperCase().replace(/\s/g,'');
      if(!idInput.value){idHint.textContent='';return}
      idHint.textContent=validTwId(idInput.value)?'身分證格式檢查：通過':'身分證格式檢查：請確認字號';
    });

    function renderSummary(){
      submitMsg.textContent='';submitMsg.className='';
      const age=calcAgeOnTripDate(dob.value);
      const nm=nameInput.value.trim()||'（未填）';
      const id=idInput.value.trim()||'（未填）';
      if(age===null){ summary.textContent='請先輸入出生年月日。'; return; }
      if(age<15){
        summary.innerHTML=`<strong>Y1 保障型</strong><div class="under15-badge" style="margin-left:8px">未滿15歲唯一可選</div>
        <div class="kv">
          <div>姓名</div><div>${escapeHtml(nm)}</div>
          <div>身分證字號</div><div>${escapeHtml(id)}</div>
          <div>出生年月日</div><div>${dob.value}（2026/10/18為${age}歲）</div>
          <div>保障組合</div><div>意外身故失能69萬／傷害醫療10萬／突發疾病10萬</div>
          <div>5天保費</div><div><b>176元</b></div>
          <div>限制</div><div><b>未滿15歲只能選擇此方案</b></div>
        </div>`;
        return;
      }
      const selected=document.querySelector('.choose:checked');
      if(!selected){ summary.textContent='已滿15歲，請選擇一個方案。'; return; }
      summary.innerHTML=`<strong>${selected.dataset.code} ${selected.dataset.name}</strong>
      <div class="kv">
        <div>姓名</div><div>${escapeHtml(nm)}</div>
        <div>身分證字號</div><div>${escapeHtml(id)}</div>
        <div>出生年月日</div><div>${dob.value}（2026/10/18為${age}歲）</div>
        <div>保障組合</div><div>${selected.dataset.cover}</div>
        <div>5天保費</div><div><b>${Number(selected.dataset.premium).toLocaleString()}元</b></div>
      </div>`;
    }
    function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
    choices.forEach(c=>c.addEventListener('change',renderSummary));
    [nameInput,idInput].forEach(el=>el.addEventListener('input',renderSummary));

    function currentSelection(){
      const age=calcAgeOnTripDate(dob.value);
      if(age===null) return null;
      if(age<15) return {code:'Y1',name:'保障型',cover:'69 / 10 / 10 萬',premium:176,age};
      const selected=document.querySelector('.choose:checked');
      if(!selected) return null;
      return {code:selected.dataset.code,name:selected.dataset.name,cover:selected.dataset.cover,premium:Number(selected.dataset.premium),age};
    }
    function validateTraveler(){
      const nm=nameInput.value.trim(); const id=idInput.value.trim().toUpperCase();
      if(!nm||nm.length>100) return '請輸入姓名（最多100字）。';
      if(!validTwId(id)) return '請輸入正確的身分證字號。';
      if(calcAgeOnTripDate(dob.value)===null)return '請輸入有效出生年月日。';
      const pick=currentSelection();
      if(!pick) return calcAgeOnTripDate(dob.value)>=15 ? '請選擇一個保險方案。' : '無法取得方案。';
      return '';
    }
    function resetTraveler(){
      nameInput.value='';idInput.value='';dob.value='';idHint.textContent='';
      choices.forEach(c=>c.checked=false);
      updateEligibility();
    }
    document.getElementById('nextTravelerYes').addEventListener('click',()=>{
      nextTravelerDialog.close();nextTravelerStatus.textContent='';
      resetTraveler();
      nameInput.scrollIntoView({behavior:'auto',block:'center'});
      nameInput.focus({preventScroll:true});
    });
    document.getElementById('nextTravelerNo').addEventListener('click',()=>{
      const pending=sessionToken?apiRequest({action:'logout'}).catch(()=>{}):Promise.resolve();
      resetSession();
      app.classList.add('hidden');registrationComplete.classList.remove('hidden');
      window.scrollTo({top:0,behavior:'auto'});
      document.getElementById('completeTitle').focus({preventScroll:true});
      // Browser-created tabs may refuse window.close(); retain a clear completion screen.
      try{window.close();}catch(_e){}
      void pending;
    });
    nextTravelerDialog.addEventListener('cancel',e=>e.preventDefault());
    document.getElementById('returnToForm').addEventListener('click',()=>{
      registrationComplete.classList.add('hidden');app.classList.remove('hidden');
      nameInput.scrollIntoView({behavior:'auto',block:'center'});nameInput.focus({preventScroll:true});
    });
    submitChoice.addEventListener('click',async()=>{
      if(submitChoice.disabled||nextTravelerDialog.open)return;
      submitMsg.className=''; submitMsg.textContent='';
      const err=validateTraveler();
      if(err){submitMsg.className='msg err';submitMsg.textContent=err;return}
      submitChoice.disabled=true; submitChoice.textContent='送出中…';
      try{
        const pick=currentSelection();
        const record={
          name:nameInput.value.trim(), idno:idInput.value.trim().toUpperCase(), dob:dob.value, age:pick.age,
          planCode:pick.code, planName:pick.name, cover:pick.cover, premium:pick.premium
        };
        const result=await apiRequest({action:'submit', record});
        submitMsg.className='msg ok';
        submitMsg.textContent=result.updated ? '已更新這位旅客的方案；線上統計表仍只保留一筆。' : '已送出並加入線上加密統計表。';
        nextTravelerStatus.textContent=submitMsg.textContent;
        nextTravelerDialog.showModal();
      }catch(e){ submitMsg.className='msg err'; submitMsg.textContent=e.message || '線上資料寫入失敗。'; }
      finally{ submitChoice.disabled=false; submitChoice.textContent='確認並送出這一位旅客'; }
    });

    function renderStats(records){
      statPeople.textContent=records.length;
      const y1=records.filter(r=>r.planCode==='Y1').length;
      statY1.textContent=y1;
      statAdult.textContent=records.length-y1;
      statPremium.textContent=records.reduce((s,r)=>s+Number(r.premium||0),0).toLocaleString()+'元';
      statsBody.innerHTML=records.length ? records.map((r,i)=>`<tr>
        <td>${i+1}</td><td>${escapeHtml(r.name||'')}</td><td>${escapeHtml(r.idno||'')}</td><td>${escapeHtml(r.dob||'')}</td><td>${Number(r.age)}歲</td>
        <td><b>${escapeHtml((r.planCode||'')+' '+(r.planName||''))}</b></td><td>${escapeHtml(r.cover||'')}</td><td>${Number(r.premium||0).toLocaleString()}元</td><td>${r.updatedAt ? new Date(r.updatedAt).toLocaleString('zh-TW') : ''}</td>
      </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;color:#65736b">目前尚無送出資料</td></tr>';
    }
    function lockStatsView(){
      statsViewEpoch++;clearTimeout(statsTimer);
      unlockedStats=null;statsPassword.value='';statsError.textContent='';
      clearPassword.value='';clearError.textContent='';
      statPeople.textContent=statY1.textContent=statAdult.textContent=statPremium.textContent='';
      statsLocked.classList.remove('hidden'); statsContent.classList.add('hidden');
      statsBody.innerHTML='';
    }
    statsBtn.addEventListener('click',()=>{lockStatsView();statsDialog.showModal();});
    document.getElementById('closeStats').addEventListener('click',()=>{lockStatsView();statsDialog.close();});
    document.getElementById('unlockStats').addEventListener('click',async()=>{
      statsError.textContent='';
      const viewEpoch=statsViewEpoch;
      const pwd=statsPassword.value;
      if(!pwd){statsError.textContent='請輸入統計表密碼。';return}
      const btn=document.getElementById('unlockStats'); btn.disabled=true; btn.textContent='解鎖中…';
      try{
        const result=await apiRequest({action:'stats', statsPassword:pwd});
        if(viewEpoch!==statsViewEpoch||!statsDialog.open)return;
        unlockedStats=Array.isArray(result.records)?result.records:[];
        statsTimer=setTimeout(lockStatsView,5*60*1000);
        renderStats(unlockedStats);
        statsLocked.classList.add('hidden'); statsContent.classList.remove('hidden');
        statsPassword.value='';
      }catch(e){if(viewEpoch===statsViewEpoch)statsError.textContent=e.message||'無法解鎖統計表。';}
      finally{btn.disabled=false;btn.textContent='解鎖統計表';}
    });
    statsPassword.addEventListener('keydown',e=>{if(e.key==='Enter') document.getElementById('unlockStats').click()});
    document.getElementById('lockStats').addEventListener('click',lockStatsView);
    const clearDialog=document.getElementById('clearDialog'),clearPassword=document.getElementById('clearPassword'),clearError=document.getElementById('clearError');
    document.getElementById('clearStats').addEventListener('click',()=>{if(!unlockedStats)return;clearPassword.value='';clearError.textContent='';clearDialog.showModal();clearPassword.focus();});
    document.getElementById('cancelClear').addEventListener('click',()=>clearDialog.close());
    clearDialog.addEventListener('close',()=>{clearPassword.value='';clearError.textContent='';});
    document.getElementById('confirmClear').addEventListener('click',async()=>{
      const pwd=clearPassword.value,btn=document.getElementById('confirmClear');
      if(!pwd){clearError.textContent='請再次輸入統計表密碼。';return;}btn.disabled=true;
      try{
        const challenge=await apiRequest({action:'prepareClear',statsPassword:pwd});
        if(!confirm('確定清除全部 '+challenge.count+' 筆資料？此動作無法復原。'))return;
        await apiRequest({action:'clear',statsPassword:pwd,confirmationToken:challenge.confirmationToken});
        clearDialog.close();unlockedStats=[];renderStats(unlockedStats);
      }catch(e){clearError.textContent=e.message||'清除失敗。';}
      finally{btn.disabled=false;clearPassword.value='';}
    });
    statsDialog.addEventListener('cancel',lockStatsView);
    statsDialog.addEventListener('close',lockStatsView);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){lockStatsView();clearDialog.close();}});
    window.addEventListener('pagehide',resetSession);
    statsDialog.addEventListener('click',e=>{if(e.target===statsDialog){lockStatsView();statsDialog.close();}});

    function openImage(src,title){ modalImg.src=src; modalTitle.textContent=title||'原始圖片'; dialog.showModal(); }
    document.querySelectorAll('.showimg').forEach(b=>b.addEventListener('click',()=>openImage(b.dataset.src,b.dataset.title)));
    document.querySelectorAll('.zoomable').forEach(img=>img.addEventListener('click',()=>openImage(img.src,img.dataset.title)));
    document.getElementById('closeDialog').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{ if(e.target===dialog) dialog.close(); });

    updateEligibility();
