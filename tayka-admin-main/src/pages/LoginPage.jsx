import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRole, login, isAuthenticated } from '../utils/auth'
import { defaultRouteForRole } from '../utils/rbac'


export default function Login() {
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [error, setError] = useState('')
const navigate = useNavigate()


useEffect(() => {
  if (isAuthenticated()) {
    const role = getRole?.()
    navigate(defaultRouteForRole(role), { replace: true })
  }
}, [navigate])

async function handleSubmit(e) {
  e.preventDefault()
  setError('')
  const res = await login({ email, password })
  if (res.ok) {
    const role = getRole?.()
    navigate(defaultRouteForRole(role), { replace: true })
  } else {
    setError(res.message)
  }
}


return (
<div className="login-page">
<form className="card login-card" onSubmit={handleSubmit}>
<h2>Giriş Yap</h2>
<label>
Kullanıcı Adı
<input value={email} onChange={e => setEmail(e.target.value)} type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
</label>
<label>
Şifre
<input value={password} onChange={e => setPassword(e.target.value)} type="password" required />
</label>
{error && <div className="error">{error}</div>}
<button className="btn" type="submit" >GİRİŞ YAP</button>
<hr width="90%" />
<p style={{ color: '#a6a6a6', textAlign: 'center', fontSize: '12px' }}>Yetkisiz erişim izlenir ve kayıt altına alınır.</p>
</form>
</div>
)
}