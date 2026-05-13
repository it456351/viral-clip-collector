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
  form.addEventListener('submit',handleLogin);
}

async function handleLogin(e){
  e.preventDefault();
  const now=Date.now();
  if(now<lockUntil){
    const secs=Math.ceil((lockUntil-now)/1000);
    document.getElementById('loginErr').textContent='Too many attempts. Wait '+secs+'s';
    return;
  }
  const u=document.getElementById('loginUser').value.trim();
  const p=document.getElementById('loginPass').value;
  if(USERS[u]&&USERS[u]===p){
    failCount=0;
    sessionStorage.setItem(AUTH_KEY,'true');
    showApp();
  }else{
    failCount++;
    if(failCount>=5){lockUntil=Date.now()+30000;failCount=0;}
    document.getElementById('loginErr').textContent='Invalid credentials';
  }
}

function showApp(){
  document.getElementById('loginPage').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('logoutBtn').addEventListener('click',()=>{
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
  });
  document.getElementById('clipForm').addEventListener('submit',handleSave);
  document.getElementById('exportBtn').addEventListener('click',exportCSV);
  document.getElementById('searchInput').addEventListener('input',renderTable);
  document.getElementById('filterPlatform').addEventListener('change',renderTable);
  document.getElementById('filterStatus').addEventListener('change',renderTable);
  document.getElementById('sortSelect').addEventListener('change',renderTable);
  loadClips();
}

async function loadClips(){
  const raw=localStorage.getItem(LS_KEY);
  if(raw){try{clips=JSON.parse(raw);}catch(e){clips=[];}}
  renderTable();updateStats();
  try{
    const res=await fetch(GAS_URL+'?action=get',{redirect:'follow'});
    const data=await res.json();
    if(data.result==='OK'&&Array.isArray(data.clips)){
      clips=data.clips;
      localStorage.setItem(LS_KEY,JSON.stringify(clips));
      renderTable();updateStats();
    }
  }catch(err){console.warn('Sheet load failed, using cache',err);}
}

async function handleSave(e){
  e.preventDefault();
  const v=id=>document.getElementById(id).value.trim();
  const clipData={
    id:editId||(Date.now().toString(36)+Math.random().toString(36).substr(2,4)).toUpperCase(),
    timestamp:editId?clips.find(c=>c.id===editId)?.timestamp||new Date().toISOString():new Date().toISOString(),
    platform:v('platform'),url:v('url'),song:v('song'),dance:v('dance'),
    character:v('character'),product:v('product'),
    score:parseInt(v('score'))||0,status:v('status'),note:v('note')
  };
  if(!clipData.platform||!clipData.url){
    document.getElementById('formMsg').textContent='Platform and URL required';
    return;
  }
  document.getElementById('formMsg').textContent='Saving...';
  if(editId){
    const idx=clips.findIndex(c=>c.id===editId);
    if(idx>-1)clips[idx]=clipData;
    editId=null;
  }else{
    clips.unshift(clipData);
  }
  localStorage.setItem(LS_KEY,JSON.stringify(clips));
  renderTable();updateStats();
  try{
    const res=await fetch(GAS_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain'},
      body:JSON.stringify(clipData),
      redirect:'follow'
    });
    const data=await res.json();
    if(data.result==='OK'){
      document.getElementById('formMsg').textContent='Saved to Google Sheet!';
    }else{
      document.getElementById('formMsg').textContent='Saved locally (sheet error)';
    }
  }catch(err){
    document.getElementById('formMsg').textContent='Saved locally (offline)';
    console.warn('Sheet save failed',err);
  }
  e.target.reset();
  setTimeout(()=>document.getElementById('formMsg').textContent='',3000);
}

function updateStats(){
  document.getElementById('totalCount').textContent=clips.length;
  const scores=clips.map(c=>c.score||0).filter(s=>s>0);
  document.getElementById('highScore').textContent=scores.length?Math.max(...scores):0;
}

function renderTable(){
  const search=document.getElementById('searchInput').value.toLowerCase();
  const plat=document.getElementById('filterPlatform').value;
  const stat=document.getElementById('filterStatus').value;
  const sort=document.getElementById('sortSelect').value;
  let filtered=clips.filter(c=>{
    const matchSearch=!search||(c.url||'').toLowerCase().includes(search)||(c.song||'').toLowerCase().includes(search)||(c.note||'').toLowerCase().includes(search);
    const matchPlat=!plat||(c.platform||'')===(plat);
    const matchStat=!stat||(c.status||'')===(stat);
    return matchSearch&&matchPlat&&matchStat;
  });
  if(sort==='newest')filtered.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  else if(sort==='oldest')filtered.sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));
  else if(sort==='score')filtered.sort((a,b)=>(b.score||0)-(a.score||0));
  document.getElementById('clipCount').textContent=filtered.length;
  const tbody=document.getElementById('clipBody');
  const empty=document.getElementById('emptyState');
  if(!filtered.length){
    tbody.innerHTML='';
    empty.style.display='block';
    return;
  }
  empty.style.display='none';
  tbody.innerHTML=filtered.map((c,i)=>`<tr><td>${i+1}</td><td><span class="platform-badge">${c.platform||'-'}</span></td><td><a href="${c.url||'#'}" target="_blank" rel="noopener">${(c.url||'').substring(0,35)}...</a></td><td>${c.song||'-'}</td><td>${c.dance||'-'}</td><td>${c.character||'-'}</td><td>${c.score||0}</td><td><span class="status-badge ${(c.status||'').toLowerCase()}">${c.status||'-'}</span></td><td>${c.note||'-'}</td><td><button onclick="openClip('${c.id}')">Open</button><button onclick="copyClip('${c.id}')">Copy</button><button onclick="editClip('${c.id}')">Edit</button><button onclick="delClip('${c.id}')">Del</button></td></tr>`).join('');
}

function openClip(id){const c=clips.find(x=>x.id===id);if(c&&c.url)window.open(c.url,'_blank');}
function copyClip(id){const c=clips.find(x=>x.id===id);if(c&&c.url)navigator.clipboard.writeText(c.url).then(()=>showToast('URL copied!'));}
function editClip(id){
  const c=clips.find(x=>x.id===id);if(!c)return;editId=id;
  const set=(elId,val)=>{const el=document.getElementById(elId);if(el)el.value=val||'';};
  set('platform',c.platform);set('url',c.url);set('song',c.song);set('dance',c.dance);set('character',c.character);set('product',c.product);set('score',c.score);set('status',c.status);set('note',c.note);
  document.getElementById('clipForm').scrollIntoView({behavior:'smooth'});
}
async function delClip(id){
  if(!confirm('Delete this clip?'))return;
  clips=clips.filter(c=>c.id!==id);localStorage.setItem(LS_KEY,JSON.stringify(clips));renderTable();updateStats();
}
function exportCSV(){
  const headers=['ID','Timestamp','Platform','URL','Song','Dance','Character','Product','Score','Status','Note'];
  const rows=clips.map(c=>[c.id,c.timestamp,c.platform,c.url,c.song,c.dance,c.character,c.product,c.score,c.status,c.note].map(v=>`"${(v||'').toString().replace(/"/g,'""')}"`).join(','));
  const csv=[headers.join(','),...rows].join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='viral_clips_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
}
function showToast(msg){const t=document.getElementById('toast');if(t){t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',2000);}}
