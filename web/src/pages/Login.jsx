import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { NAME } from '../lib/labels';
import { Button, Card, Field } from '../components/Ui';
export default function Login() {
  const { login } = useAuth();
  const [id, setId] = useState('OPERATOR'); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    const result = await login(id, pw).catch((error) => ({ ok: false, error: error.message }));
    setBusy(false);
    if (!result.ok) {
      const message = {
        SESSION_SECRET_REQUIRED: 'Server session security is not configured. Contact the operator.',
        IDENTITY_PASSWORD_NOT_CONFIGURED: 'This identity has no server-side password configured. Contact the operator.',
        IDENTITY_PASSWORD_TOO_WEAK: 'The configured identity password does not meet the minimum length. Contact the operator.',
      }[result.error];
      setErr(message || 'Wrong identity or password.');
    }
  };
  return (
    <div className="max-w-sm mx-auto mt-[12vh] px-4">
      <Card><h1 className="text-xl font-semibold">Rasid</h1><p className="text-mute text-sm mb-4">One receivable. One verifiable position record.</p>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Sign in as"><select value={id} onChange={(e) => setId(e.target.value)} name="identity">{Object.entries(NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Password"><input type="password" name="password" required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>
          <Button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          {err && <p role="alert" className="text-alert text-sm">{err}</p>}
        </form></Card>
    </div>
  );
}
