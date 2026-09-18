export const TRIP_DATE='2026-10-18';
// Fixed transcription from the supplied project. Never infer insurance values.
export const PLAN_RULES={
  Y1:{'69 / 10 / 10 萬':{name:'保障型',premium:176}},
  U3:{'300 / 30 / 30 萬':{name:'豪華定額型',premium:953},'500 / 50 / 50 萬':{name:'豪華定額型',premium:1153},'1000 / 50 / 50 萬':{name:'豪華定額型',premium:1390}},
  Z10:{'300 / 30 / 30 萬':{name:'夏旅雙享型',premium:1100},'500 / 50 / 50 萬':{name:'夏旅雙享型',premium:1300},'1000 / 50 / 50 萬':{name:'夏旅雙享型',premium:1537}},
  Z9:{'300 / 30 / 30 萬':{name:'雙重守護型',premium:1225},'500 / 50 / 50 萬':{name:'雙重守護型',premium:1425},'1000 / 50 / 50 萬':{name:'雙重守護型',premium:1662}},
};
export class InputError extends Error {}
export function calcAge(dob){
  if(typeof dob!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dob))return null;
  const [y,m,d]=dob.split('-').map(Number),birth=new Date(Date.UTC(y,m-1,d));
  if(birth.getUTCFullYear()!==y||birth.getUTCMonth()!==m-1||birth.getUTCDate()!==d)return null;
  const age=2026-y-((m>10||(m===10&&d>18))?1:0);
  return age>=0&&age<=120&&dob<=TRIP_DATE?age:null;
}
export function validTwId(id){
  if(typeof id!=='string'||!/^[A-Z][12]\d{8}$/.test(id))return false;
  const code=10+'ABCDEFGHJKLMNPQRSTUVXYWZIO'.indexOf(id[0]);
  const nums=[Math.floor(code/10),code%10,...id.slice(1).split('').map(Number)];
  return nums.reduce((s,n,i)=>s+n*[1,9,8,7,6,5,4,3,2,1,1][i],0)%10===0;
}
export function validateRecord(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new InputError('旅客資料格式錯誤。');
  for(const key of ['name','idno','dob','planCode','planName','cover'])if(typeof raw[key]!=='string')throw new InputError('旅客資料格式錯誤。');
  const name=raw.name.trim(),idno=raw.idno.trim().toUpperCase(),dob=raw.dob;
  if(!name||name.length>100||/[\u0000-\u001f\u007f]/u.test(name))throw new InputError('請輸入有效姓名（最多100字）。');
  if(!validTwId(idno))throw new InputError('身分證字號格式錯誤。');
  const age=calcAge(dob);if(age===null)throw new InputError('出生年月日資料錯誤。');
  const {planCode,cover}=raw;
  const rule=Object.hasOwn(PLAN_RULES,planCode)&&Object.hasOwn(PLAN_RULES[planCode],cover)?PLAN_RULES[planCode][cover]:null;
  if(!rule)throw new InputError('保險方案資料不在允許範圍。');
  if(age<15&&planCode!=='Y1')throw new InputError('2026/10/18 未滿15歲只能選 Y1。');
  if(age>=15&&planCode==='Y1')throw new InputError('滿15歲不可使用未滿15歲 Y1 方案。');
  if(raw.premium!==rule.premium||raw.planName!==rule.name)throw new InputError('保費或方案名稱與固定資料不符。');
  return {name,idno,dob,age,planCode,planName:rule.name,cover,premium:rule.premium};
}
