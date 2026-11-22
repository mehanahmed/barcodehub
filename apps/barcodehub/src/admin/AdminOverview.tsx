import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { adminOverview } from '@/lib/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { PageHeader, Stat } from '../components/Shell';
import { formatTk } from '../lib/config';

function ChartCard({ title, data, color, money }: { title: string; data: { month: string; total: number }[]; color: string; money?: boolean }) {
  return (
    <div className="p-5 bg-card border border-border rounded-xl">
      <div className="font-bold mb-4">{title}</div>
      <div className="h-56"><ResponsiveContainer><BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} width={48} allowDecimals={false} />
        <Tooltip formatter={(v: number) => (money ? formatTk(v) : v)} />
        <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart></ResponsiveContainer></div>
    </div>
  );
}

export default function AdminOverview() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-overview'], queryFn: async () => (await adminOverview({})).overview });
  return (
    <>
      <PageHeader title="Overview" />
      {isLoading || !data ? <Skeleton className="h-80 rounded-xl" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Active tenants" value={data.activeTenants} hint={`${data.totalTenants} total`} />
            <Stat label="Revenue (30d)" value={formatTk(data.revenue30)} />
            <Stat label="Products" value={data.products.toLocaleString()} />
            <Stat label="Page views (30d)" value={data.views30.toLocaleString()} />
          </div>
          <div className="mt-6 grid lg:grid-cols-2 gap-4">
            <ChartCard title="Monthly revenue" data={data.revenueByMonth} color="hsl(var(--chart-1))" money />
            <ChartCard title="New tenants per month" data={data.tenantsByMonth} color="hsl(var(--chart-2))" />
          </div>
        </>
      )}
    </>
  );
}
