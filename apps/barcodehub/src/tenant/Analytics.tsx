import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { getAnalytics } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { PageHeader, Stat } from '../components/Shell';

const ranges = [{ d: 30, l: '30 days' }, { d: 90, l: '90 days' }, { d: 365, l: '1 year' }];
const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({ queryKey: ['analytics', days], queryFn: async () => (await getAnalytics({ days })).analytics });
  return (
    <>
      <PageHeader title="Analytics" actions={
        <div className="flex bg-muted rounded-lg p-1 text-sm">
          {ranges.map((r) => <button key={r.d} onClick={() => setDays(r.d)} className={`px-3 py-1 rounded-md ${days === r.d ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'}`}>{r.l}</button>)}
        </div>} />
      {isLoading || !data ? <Skeleton className="h-80 rounded-xl" /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Total views" value={data.total.toLocaleString()} />
            <Stat label="QR scans" value={data.qr.toLocaleString()} />
            <Stat label="From search" value={data.search.toLocaleString()} />
          </div>
          {!data.enabled ? (
            <div className="mt-6 p-10 border border-dashed border-border rounded-xl text-center">
              <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="mt-3 font-semibold">Charts are available on paid packages</p>
              <Button className="mt-4" asChild><Link to="/app/subscription">Upgrade</Link></Button>
            </div>
          ) : (
            <>
              <div className="mt-6 p-5 bg-card border border-border rounded-xl">
                <div className="font-bold mb-4">Daily views</div>
                <div className="h-64"><ResponsiveContainer>
                  <LineChart data={data.daily}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={32} /><Tooltip />
                    <Line type="monotone" dataKey="views" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} /></LineChart>
                </ResponsiveContainer></div>
              </div>
              <div className="mt-6 grid md:grid-cols-2 gap-4">
                <div className="p-5 bg-card border border-border rounded-xl"><div className="font-bold mb-2">Views by source</div>
                  <div className="h-56">{data.bySource.length ? <ResponsiveContainer><PieChart>
                    <Pie data={data.bySource} dataKey="views" nameKey="source" innerRadius={50} outerRadius={80}>{data.bySource.map((_: any, i: number) => <Cell key={i} fill={colors[i % 4]} />)}</Pie><Legend /><Tooltip /></PieChart></ResponsiveContainer>
                    : <p className="text-sm text-muted-foreground">No data yet.</p>}</div></div>
                <div className="p-5 bg-card border border-border rounded-xl"><div className="font-bold mb-2">Top products</div>
                  {data.top.length ? data.top.map((t: any) => <div key={t.barcodeNumber} className="flex justify-between py-2 text-sm border-b border-border last:border-0"><span>{t.title}</span><span>{t.views.toLocaleString()}</span></div>)
                    : <p className="text-sm text-muted-foreground">No views yet.</p>}</div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
