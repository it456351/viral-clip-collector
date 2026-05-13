const GAS_URL='https://script.google.com/macros/s/AKfycbwytCJtXcfhv4HeyOo8D9Yo-7Sqcfz8I_4HENa-X1kZWNmnnS_fSc8eQiXxJv1CcuMFmA/exec';
const LS_KEY='viralClips_v1';
const AUTH_KEY='vcc_auth_ok_2026';
const USERS={viralclip:'R(SMpGAYh]!4h4%z'};
let clips=[],editId=null;
let failCount=0,lockUntil=0;

document.addEventListener('DOMContentLoaded',()=>{
  const ok=sessionStorage.getItem(AUTH_KEY);
  if(ok==='true'){showApp();}else{showLogin();}
});

function showLogin(){
  document.getElementById('loginPage').style.display='flex';
  document.getElementById('mainApp').style.display='none';
  const form=document.getElementById('loginForm');
  form.replaceWith(form.cloneNode(true));
  document.getElementById('loginForm').addEventListener('submit',handleLogin);
}

function handleLogin(e){
  e.preventDefault();
  const err=document.getElementById('loginErr');
  if(Date.now()<lockUntil){const secs=Math.ceil((lockUntil-Date.now())/1000);err.textContent='Too many attempts. Wait '+secs+'s';return;}
  const user=document.getElementById('loginUser').value.trim();
  const pass=document.getElementById('loginPass').value;
  if(USERS[user]&&USERS[user]===pass){
    failCount=0;sessionStorage.setItem(AUTH_KEY,'true');
    document.getElementById('loginPage').style.display='none';showApp();
  }else{
    failCount++;document.getElementById('loginPass').value='';
    if(failCount>=5){lockUntil=Date.now()+30000;failCount=0;err.textContent='Too many attempts. Locked 30s.';return;}
    err.textContent='Invalid username or password ('+failCount+'/5)';
    setTimeout(()=>{err.textContent='';},3000);
  }
}

function showApp(){
  if(sessionStorage.getItem(AUTH_KEY)!=='true'){showLogin();return;}
  document.getElementById('mainApp').style.display='block';
  document.getElementById('loginPage').style.display='none';
  loadClips();
  document.getElementById('clipForm').addEventListener('submit',handleSave);
  document.getElementById('exportBtn').addEventListener('click',exportCSV);
  document.getElementById('searchInput').addEventListener('input',renderTable);
  document.getElementById('filterPlatform').addEventListener('change',renderTable);
  document.getElementById('filterStatus').addEventListener('change',renderTable);
  document.getElementById('sortSelect').addEventListener('change',renderTable);
  document.getElementById('logoutBtn').addEventListener('click',()=>{sessionStorage.removeItem(AUTH_KEY);location.reload();});
}

async function loadClips(){
  const raw=localStorage.getItem(LS_KEY);
  if(raw){clips=JSON.parse(raw);renderTable();updateStats();}
  try{
    const res=await fetch(GAS_URL,{redirect:'follow'});
    const data=await res.json();
    if(data.result==='OK'&&Array.isArray(data.clips)){
      clips=data.clips;localStorage.setItem(LS_KEY,JSON.stringify(clips));
      renderTable();updateStats();
    }
  }catch(err){console.warn('Sheet load failed, using cache',err);}
}

function saveToLocalStorage(){localStorage.setItem(LS_KEY,JSON.stringify(clips));}

async function handleSave(e){
  e.preventDefault();
  if(sessionStorage.getItem(AUTH_KEY)!=='true'){location.reload();return;}
  const msg=document.getElementById('formMsg');
  const clip={
    id:editId||Date.now().toString(),
    timestamp:editId?(clips.find(c=>c.id===editId)?.timestamp||new Date().toISOString()):new Date().toISOString(),
    platform:v('platform'),url:v('url'),song:v('song'),dance:v('dance'),
    character:v('character'),product:v('product'),score:parseInt(v('score'))||0,
    status:v('status'),note:v('note'),
  };
  if(editId){clips=clips.map(c=>c.id===editId?clip:c);editId=null;}else{clips.unshift(clip);}
  saveToLocalStorage();renderTable();updateStats();resetForm();
  showToast('Saving...');msg.textContent='Saving...';msg.className='form-msg';
  try{
    const res=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(clip),redirect:'follow'});
    const text=await res.text();
    if(text.includes('OK')){msg.textContent='Saved to Google Sheet!';msg.className='form-msg success';showToast('Saved!');}
    else{msg.textContent='Saved locally (Sheet sync issue)';msg.className='form-msg error';}
  }catch(err){msg.textContent='Saved locally (offline)';msg.className='form-msg error';}
  setTimeout(()=>{msg.textContent='';msg.className='form-msg';},3000);
}

function v(id){return document.getElementById(id).value.trim();}
function resetForm(){document.getElementById('clipForm').reset();editId=null;document.querySelector('#clipForm .btn--primary').textContent='Save Clip';}

function renderTable(){
  if(sessionStorage.getItem(AUTH_KEY)!=='true'){location.reload();return;}
  const search=document.getElementById('searchInput').value.toLowerCase();
  const platform=document.getElementById('filterPlatform').value;
  const status=document.getElementById('filterStatus').value;
  const sort=document.getElementById('sortSelect').value;
  let filtered=[...clips];
  if(platform)filtered=filtered.filter(c=>c.platform===platform);
  if(status)filtered=filtered.filter(c=>c.status===status);
  if(search)filtered=filtered.filter(c=>[c.platform,c.url,c.song,c.dance,c.character,c.product,c.note].join(' ').toLowerCase().includes(search));
  if(sort==='oldest')filtered.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  else if(sort==='score_desc')filtered.sort((a,b)=>b.score-a.score);
  else if(sort==='score_asc')filtered.sort((a,b)=>a.score-b.score);
  const tbody=document.getElementById('clipBody');
  const empty=document.getElementById('emptyState');
  document.getElementById('clipCount').textContent=filtered.length;
  if(!filtered.length){tbody.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  tbody.innerHTML=filtered.map((c,i)=>`<tr><td style="color:var(--muted);font-family:var(--font-mono)">${i+1}</td><td>${platformBadge(c.platform)}</td><td><a href="${c.url}" target="_blank" rel="noopener" style="color:var(--accent);word-break:break-all">${c.url&&c.url.length>40?c.url.substring(0,40)+'...':(c.url||'-')}</a></td><td>${c.song||'-'}</td><td>${c.dance||'-'}</td><td>${c.character||'-'}</td><td><span style="color:var(--accent);font-weight:700">${c.score||0}</span></td><td>${statusBadge(c.status)}</td><td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.note||''}</td><td><button class="btn btn--sm" onclick="openClip('${c.id}')">Open</button> <button class="btn btn--sm" onclick="copyClip('${c.id}')">Copy</button> <button class="btn btn--sm btn--warning" onclick="editClip('${c.id}')">Edit</button> <button class="btn btn--sm btn--danger" onclick="deleteClip('${c.id}')">Del</button></td></tr>`).join('');
}

function platformBadge(p){const colors={TikTok:'#69C9D0',YouTube:'#FF0000',Instagram:'#E1306C',Facebook:'#1877F2',Twitter:'#1DA1F2',Other:'#888'};const c=colors[p]||'#888';return '<span style="background:'+c+'22;color:'+c+';border:1px solid '+c+';border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">'+(p||'?')+'</span>';}
function statusBadge(s){const colors={New:'var(--accent)',Watched:'#aaa',Hot:'#ff4444',Saved:'#44ff88'};const c=colors[s]||'#888';return '<span style="background:'+c+'22;color:'+c+';border:1px solid '+c+';border-radius:4px;padding:2px 8px;font-size:11px">'+(s||'New')+'</span>';}
function openClip(id){const c=clips.find(x=>x.id===id);if(c&&c.url)window.open(c.url,'_blank');}
function copyClip(id){const c=clips.find(x=>x.id===id);if(c){navigator.clipboard.writeText(c.url||'').then(()=>showToast('URL copied!'));}}
function editClip(id){
  const c=clips.find(x=>x.id===id);if(!c)return;editId=id;
  ['platform','url','song','dance','character','product','score','status','note'].forEach(k=>{const el=document.getElementById(k);if(el)el.value=c[k]||'';});
  document.querySelector('#clipForm .btn--primary').textContent='Update Clip';
  window.scrollTo({top:0,behavior:'smooth'});
}
function deleteClip(id){
  if(!confirm('Delete this clip?'))return;
  clips=clips.filter(c=>c.id!==id);saveToLocalStorage();renderTable();updateStats();showToast('Deleted');
}
function updateStats(){
  document.getElementById('totalClips').textContent=clips.length;
  const scores=clips.map(c=>c.score||0).filter(s=>s>0);
  document.getElementById('highScore').textContent=scores.length?Math.max(...scores):0;
}
function showToast(msg){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#39ff14;color:#000;padding:10px 24px;border-radius:8px;font-weight:700;z-index:9999;transition:opacity 0.3s';document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';clearTimeout(t._timer);t._timer=setTimeout(()=>{t.style.opacity='0';},2000);
}
function exportCSV(){
  const headers=['ID','Timestamp','Platform','URL','Song','Dance','Character','Product','Score','Status','Note'];
  const rows=clips.map(c=>[c.id,c.timestamp,c.platform,c.url,c.song,c.dance,c.character,c.product,c.score,c.status,c.note].map(x=>'"'+(x||'').toString().replace(/"/g,'""')+'"').join(','));
  const csv=[headers.join(','),...rows].join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='viral_clips.csv';a.click();
}
