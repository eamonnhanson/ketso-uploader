// Preview is a restricted student application, not a clone of the legacy uploader.
export const DEFAULT_STAGING_ORIGIN = 'https://student-staging.ketso-uploader.pages.dev';
export function isStudentStaging(request, env = {}) {
 const hostname=new URL(request.url).hostname;
 return env.STUDENT_STAGING==='true' || hostname.endsWith('.ketso-uploader.pages.dev') ||
  (!!env.CF_PAGES_BRANCH && env.CF_PAGES_BRANCH!=='main');
}
export function stagingOrigin(env) { return env.STUDENT_STAGING_ORIGIN || DEFAULT_STAGING_ORIGIN; }
export function allowedStagingHost(request,env) {
 return new URL(request.url).origin===stagingOrigin(env);
}
export function stagingDenied(message='This route is unavailable in the isolated student staging application.') {
 return Response.json({error:message},{status:403,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export const STAGING_CSP="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; worker-src 'none'";
export function secureStagingResponse(response) {
 const headers=new Headers(response.headers);
 headers.set('Content-Security-Policy',STAGING_CSP);
 headers.set('Cache-Control','no-store');
 headers.set('Referrer-Policy','no-referrer');
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('X-Frame-Options','DENY');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
