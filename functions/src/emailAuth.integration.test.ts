import {describe,it,expect} from 'vitest';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';

const enabled=!!process.env.FIREBASE_AUTH_EMULATOR_HOST&&process.env.GCLOUD_PROJECT==='demo-d2-map-crm';
describe.skipIf(!enabled)('Firebase email link authentication',()=>{
 it('verifies a non-Google address and rejects the wrong address and reuse of its link',async()=>{
  if(!getApps().length)initializeApp({projectId:'demo-d2-map-crm'});
  const email='non-google-'+Date.now()+'@example.test';
  const link=await getAuth().generateSignInWithEmailLink(email,{url:'http://localhost:4173/',handleCodeInApp:true});
  const code=new URL(link).searchParams.get('oobCode');
  expect(code).toBeTruthy();
  const signIn=(address:string)=>fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=fake-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:address,oobCode:code})});
  expect((await signIn('wrong@example.test')).ok).toBe(false);
  const response=await signIn(email);expect(response.ok).toBe(true);
  const result=await response.json() as {localId:string;idToken:string};
  const user=await getAuth().getUser(result.localId);
  expect(user.email).toBe(email);expect(user.emailVerified).toBe(true);
  const claims=await getAuth().verifyIdToken(result.idToken);
  expect(claims.firebase.sign_in_provider).toBe('password');
  expect((await signIn(email)).ok).toBe(false);
  await getAuth().deleteUser(result.localId);
 });
});
