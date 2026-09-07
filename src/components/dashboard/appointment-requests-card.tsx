interface AppointmentRequest {
  id: number;
  patient_name: string;
  patient_phone: string;
  specialty_name: string;
  preferred_date: string;
  preferred_time: string;
  reason: string;
  source: string;
  created_at: string;
}

interface AppointmentRequestsCardProps {
  requests: AppointmentRequest[];
}

export default function AppointmentRequestsCard({ requests }: AppointmentRequestsCardProps) {
  return (
    <div className="neon-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <h2 className="font-semibold text-white text-base">Solicitações</h2>
          <p className="text-xs text-slate-400 mt-0.5">{requests.length} pendente{requests.length !== 1 ? "s" : ""}</p>
        </div>
        <span className="neon-badge-warning text-xs font-medium px-2 py-0.5 rounded-full">
          {requests.length}
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-6 sm:py-8">
          <span className="text-3xl block mb-2">✅</span>
          <p className="text-sm text-slate-500">Nenhuma solicitação pendente.</p>
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="p-3 sm:p-3 rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{req.patient_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {req.specialty_name} · {req.preferred_date} {req.preferred_time}
                  </p>
                </div>
                <span className="neon-badge text-xs shrink-0">
                  {req.source === "ia" ? "IA" : "Web"}
                </span>
              </div>
              {req.reason && (
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{req.reason}</p>
              )}
              <div className="flex gap-2 mt-2.5">
                <button className="neon-btn flex-1 text-xs font-medium px-3 py-2.5 rounded-lg min-h-[44px]">
                  Aceitar
                </button>
                <button className="flex-1 text-xs font-medium bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 px-3 py-2.5 rounded-lg transition-colors min-h-[44px] border border-white/[0.06]">
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
