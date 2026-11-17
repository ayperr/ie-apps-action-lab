export default function handler(req,res) {
  if(req.method!=='GET'){res.status(405).json({error:'Method not allowed'});return;}
  const url=process.env.SUPABASE_URL;
  const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY;
  res.setHeader('Cache-Control','no-store');
  if(!url||!publishableKey){res.status(503).json({error:'Supabase configuration is not available.'});return;}
  // Publishable key only: synthetic tables enforce SELECT-only grants and RLS.
  res.status(200).json({url,publishableKey});
}
