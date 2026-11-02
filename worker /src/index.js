const corsHeaders = origin => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
});
const json = (data,status=200,origin="*") => new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...corsHeaders(origin)}});
const fail = (message,status=400,origin="*") => json({error:message},status,origin);
const withCors = (response, origin) => {
  const headers = new Headers(response.headers);
  for (const [k,v] of Object.entries(corsHeaders(origin))) headers.set(k,v);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
};
const randomId = (n=16) => Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,"0")).join("");
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = s => Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function passwordHash(password,salt){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:fromB64(salt),iterations:180000,hash:"SHA-256"},key,256);
  return b64(bits);
}
async function sha(text){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function validUsername(s){return /^[a-zA-Z0-9_.-]{3,24}$/.test(s);}
function validPassword(s){return typeof s==="string"&&s.length>=8&&s.length<=128;}
async function body(req){try{return await req.json();}catch{return {};}}
async function userFrom(req,env){
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return null;
  const hash=await sha(token);
  const row=await env.DB.prepare("SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?").bind(hash,Date.now()).first();
  return row||null;
}
async function newSession(env,user){
  const token=randomId(32),hash=await sha(token);
  await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(hash,user.id,Date.now()+30*86400000).run();
  return token;
}
async function handle(req,env,ctx){
  const url=new URL(req.url);
  const origin=req.headers.get("Origin")||"*";
  const allowed=env.ALLOWED_ORIGIN||"*";
  const originAllowed=allowed==="*"||origin===allowed;
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(originAllowed?origin:allowed)});
  if(!originAllowed)return fail("Origin not allowed",403,allowed);
  if(url.pathname==="/api/health")return json({ok:true,service:"salavat-smart-api",version:"2.0.0"},200,origin);
  if(url.pathname==="/api/auth/register"&&req.method==="POST"){
    const b=await body(req),username=String(b.username||"").trim(),password=b.password;
    if(!validUsername(username))return fail("نام کاربری باید ۳ تا ۲۴ نویسه انگلیسی، عدد یا . _ - باشد.",400,origin);
    if(!validPassword(password))return fail("گذرواژه باید حداقل ۸ نویسه باشد.",400,origin);
    const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt),id=randomId(16);
    try{await env.DB.prepare("INSERT INTO users(id,username,password_hash,password_salt) VALUES(?,?,?,?)").bind(id,username,hash,salt).run();}
    catch{return fail("این نام کاربری قبلاً ثبت شده است.",409,origin);}
    const token=await newSession(env,{id,username});
    await env.DB.prepare("INSERT INTO user_sync(user_id,payload) VALUES(?,?)").bind(id,"{}").run();
    return json({token,username},201,origin);
  }
  if(url.pathname==="/api/auth/login"&&req.method==="POST"){
    const b=await body(req),username=String(b.username||"").trim();
    const row=await env.DB.prepare("SELECT id,username,password_hash,password_salt FROM users WHERE username=? COLLATE NOCASE").bind(username).first();
    if(!row||!validPassword(b.password)||await passwordHash(b.password,row.password_salt)!==row.password_hash)return fail("نام کاربری یا گذرواژه صحیح نیست.",401,origin);
    return json({token:await newSession(env,row),username:row.username},200,origin);
  }
  const user=await userFrom(req,env);
  if(url.pathname==="/api/sync"&&req.method==="GET"){
    if(!user)return fail("ابتدا وارد حساب شوید.",401,origin);
    const row=await env.DB.prepare("SELECT payload FROM user_sync WHERE user_id=?").bind(user.id).first();
    let payload={};try{payload=JSON.parse(row?.payload||"{}");}catch{}
    return json(payload,200,origin);
  }
  if(url.pathname==="/api/sync"&&req.method==="POST"){
    if(!user)return fail("ابتدا وارد حساب شوید.",401,origin);
    const b=await body(req);
    const current=await env.DB.prepare("SELECT payload FROM user_sync WHERE user_id=?").bind(user.id).first();
    let old={};try{old=JSON.parse(current?.payload||"{}");}catch{}
    const incoming=b.history&&typeof b.history==="object"?b.history:{};
    const history={...(old.history||{})};
    for(const [k,v] of Object.entries(incoming)){if(/^\d{4}-\d{2}-\d{2}$/.test(k))history[k]=Math.max(0,Math.max(Number(history[k]||0),Math.min(10000000,Number(v)||0)));}
    const payload={history,total:Math.max(Number(old.total||0),Number(b.total||0)),goal:Math.max(1,Math.min(1000000,Number(b.goal)||Number(old.goal)||100))};
    await env.DB.prepare("INSERT INTO user_sync(user_id,payload,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,updated_at=CURRENT_TIMESTAMP").bind(user.id,JSON.stringify(payload)).run();
    return json({ok:true,...payload},200,origin);
  }
  if(url.pathname==="/api/groups"&&req.method==="POST"){
    if(!user)return fail("برای ساخت ختم ابتدا وارد حساب شوید.",401,origin);
    const b=await body(req),name=String(b.name||"ختم صلوات").slice(0,60),id=randomId(12),code=randomId(4).toUpperCase();
    await env.DB.prepare("INSERT INTO groups_khatm(id,code,name,owner_id) VALUES(?,?,?,?)").bind(id,code,name,user.id).run();
    await env.DB.prepare("INSERT INTO group_members(group_id,user_id) VALUES(?,?)").bind(id,user.id).run();
    return json({group:{id,code,name,progress:0}},201,origin);
  }
  if(url.pathname==="/api/groups/join"&&req.method==="POST"){
    if(!user)return fail("برای پیوستن ابتدا وارد حساب شوید.",401,origin);
    const b=await body(req),code=String(b.code||"").trim().toUpperCase();
    const g=await env.DB.prepare("SELECT id,code,name,total FROM groups_khatm WHERE code=?").bind(code).first();
    if(!g)return fail("کد دعوت پیدا نشد.",404,origin);
    await env.DB.prepare("INSERT OR IGNORE INTO group_members(group_id,user_id) VALUES(?,?)").bind(g.id,user.id).run();
    return json({group:{id:g.id,code:g.code,name:g.name,progress:0,total:g.total}},200,origin);
  }
  if(url.pathname==="/api/groups"&&req.method==="GET"){
    if(!user)return fail("ابتدا وارد حساب شوید.",401,origin);
    const {results=[]}=await env.DB.prepare("SELECT g.id,g.code,g.name,g.total,m.progress FROM groups_khatm g JOIN group_members m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.created_at DESC").bind(user.id).all();
    return json({groups:results},200,origin);
  }
  if(url.pathname==="/api/global"&&req.method==="GET"){
    const id=env.GLOBAL_COUNTER.idFromName("global-salavat-counter"),stub=env.GLOBAL_COUNTER.get(id);
    return withCors(await stub.fetch("https://counter.local/get"),origin);
  }
  if(url.pathname==="/api/global"&&req.method==="POST"){
    const b=await body(req),inc=Math.max(0,Math.min(100,Math.floor(Number(b.increment)||0)));
    const id=env.GLOBAL_COUNTER.idFromName("global-salavat-counter"),stub=env.GLOBAL_COUNTER.get(id);
    return withCors(await stub.fetch("https://counter.local/increment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({increment:inc})}),origin);
  }
  if(url.pathname.startsWith("/media/")&&req.method==="GET"){
    const key=decodeURIComponent(url.pathname.slice(7));
    if(!key||key.includes(".."))return fail("مسیر فایل نامعتبر است.",400,origin);
    const obj=await env.AUDIO.get(key);
    if(!obj)return fail("فایل پیدا نشد.",404,origin);
    const headers=new Headers(corsHeaders(origin));obj.writeHttpMetadata(headers);headers.set("ETag",obj.httpEtag);headers.set("Cache-Control","public, max-age=3600");
    return new Response(obj.body,{headers});
  }
  return fail("مسیر مورد نظر وجود ندارد.",404,origin);
}
export default {async fetch(req,env,ctx){try{return await handle(req,env,ctx);}catch(e){return json({error:"خطای داخلی سرویس",detail:env.ENVIRONMENT==="development"?String(e):undefined},500,req.headers.get("Origin")||"*");}}};

export class GlobalCounter {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async fetch(req){
    let count=await this.ctx.storage.get("count")||0;
    if(new URL(req.url).pathname==="/get")return Response.json({count});
    if(req.method==="POST"){
      const b=await req.json().catch(()=>({}));
      count+=Math.max(0,Math.min(100,Math.floor(Number(b.increment)||0)));
      await this.ctx.storage.put("count",count);
      return Response.json({ok:true,count});
    }
    return new Response("Not found",{status:404});
  }
};
