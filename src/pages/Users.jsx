import React from 'react'
import UserTable from '../components/UserTable'

export default function Users() {
  return (
    <div>
      <h1>Kullanıcılar</h1>
      <div className="card-b" style={{ padding: 8 }}>
        <UserTable />
      </div>
    </div>
  )
}
