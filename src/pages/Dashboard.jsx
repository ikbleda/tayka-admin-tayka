import React from 'react';
import Card from '../components/MetricCard';
import { useAppState } from '../context/AppState';
import { IoWarningOutline } from "react-icons/io5";

export default function Dashboard() {
  const { events = [] } = useAppState();

  const total = events.length;
  const open = events.filter((e) => e.status !== 'Resolved').length;
  const critical = events.filter((e) => (e.level || '').toLowerCase() === 'high' && e.status !== 'Resolved').length;

const stats = [
  { title: 'Toplam senaryo',
    value: total,
    description: 'Hazırlanmış, simüle edilebilir senaryo',  },
  { title: 'Aktif senaryo',
    value: open,
    description: 'Simülasyonda aktif analiz edilen olay',  },
  { title: 'Kritik senaryo',
	value: critical,
    description: 'High seviyesinde ve açık senaryolar',  },
];
 return (
    <div>
      <h1>Kontrol Paneli</h1>

      {/* Büyük öneri kartı */}
      <div className="card-b suggestion-card">
        <p><IoWarningOutline className="text-yellow-500" size={60} /></p>
		<h2>Öneri Üretilmedi</h2>
        <p>
		Merkezi karar çekirdeği, belirlenen güven eşiğini<br /> karşılayan veri tespit edemedi.<br /> Geçerli bilgiye ulaşılana kadar öneri sunulmayacak.
        </p>
      </div>

      {/* Küçük istatistik kartları */}
      <div className="cards-row">
        {stats.map((s, i) => (
          <Card key={i} title={s.title} value={s.value} description={s.description} />
        ))}
      </div>
    </div>
  );
}