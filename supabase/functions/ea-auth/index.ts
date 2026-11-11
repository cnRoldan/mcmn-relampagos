import {createClient} from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
// Public login endpoint: credentials are checked by Supabase Auth, not by a
// caller-supplied role. Service credentials never leave this server function.
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Método no permitido.'},405);
 if(Number(req.headers.get('content-length')||0)>4096)return reply({error:'Solicitud demasiado grande.'},413);
 try{
  const text=await req.text();if(text.length>4096)return reply({error:'Solicitud demasiado grande.'},413);
  const body=JSON.parse(text),ea=typeof body.ea_id==='string'?body.ea_id.normalize('NFC').trim().replace(/\s+/g,' '):'',password=body.password;
  if(!/^[\p{L}\p{M}\p{N}_ -]{3,40}$/u.test(ea)||typeof password!=='string'||password.length>128)return reply({error:'ID de EA o contraseña no válidos.'},400);
  if(!['login','signup'].includes(body.action))return reply({error:'Acción no válida.'},400);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}),auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.action+':'+ea.toLowerCase()));
  const key=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const quota=await admin.rpc('consume_auth_attempt',{p_key:key});
  if(quota.error)return reply({error:'El acceso no está disponible. Inténtalo más tarde.'},503);
  if(!quota.data)return reply({error:'Demasiados intentos. Espera diez minutos e inténtalo otra vez.'},429);
  if(body.action==='signup'){
   if(password.length<10)return reply({error:'Utiliza una contraseña de al menos 10 caracteres.'},400);
   // Supabase Auth uses an internal email-shaped identifier for username-only
   // accounts. This .invalid address is never used for correspondence and
   // does not claim to verify ownership of a real email address or EA account.
   const identityHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ea.toLowerCase()));
   const identity=Array.from(new Uint8Array(identityHash),v=>v.toString(16).padStart(2,'0')).join('');
   const email=`ea-${identity}@accounts.mcm.invalid`;
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{ea_id:ea}});
   if(created.error)return reply({error:'No se ha podido crear la cuenta. El ID de EA puede estar ya registrado.'},400);
   const {data,error}=await auth.auth.signInWithPassword({email,password});
   if(error||!data.session)return reply({message:'Cuenta creada. Ya puedes entrar con tu ID de EA y contraseña.'});
   return reply({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token},message:'Cuenta de capitán creada.'});
  }
  const lookup=await admin.rpc('auth_email_for_ea',{p_ea_id:ea});
  if(lookup.error)return reply({error:'El acceso no está disponible. Inténtalo más tarde.'},503);
  const {data,error}=await auth.auth.signInWithPassword({email:lookup.data||'unknown-account@mcm.invalid',password});
  if(error||!data.session||!lookup.data)return reply({error:'ID de EA o contraseña incorrectos.'},401);
  return reply({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}});
 }catch{return reply({error:'No se ha podido completar el acceso.'},400)}
});
