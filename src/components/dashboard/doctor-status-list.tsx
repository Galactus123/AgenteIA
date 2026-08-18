interface Doctor {
  id: number;
  name: string;
  specialty_name: string;
  status: string;
  schedule?: { weekday: number; start_time: string; end_time: string }[];
}

interface DoctorStatusListProps {
  doctors: Doctor[];
}

function getDayOfWeek(): number {
  return new Date().getDay();
}

function isAvailableToday(schedule?: { weekday: number; start_time: string; end_time: string }[]): boolean {
  if (!schedule || schedule.length === 0) return false;
  const today = getDayOfWeek();
  return schedule.some((s) => s.weekday === today);
}

export default function DoctorStatusList({ doctors }: DoctorStatusListProps) {
  const activeDoctors = doctors.filter((d) => d.status === "active");
  const today = getDayOfWeek();
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <h2 className="font-semibold text-slate-900 text-base">Médicos disponíveis</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeDoctors.length} médico{activeDoctors.length !== 1 ? "s" : ""} ativo{activeDoctors.length !== 1 ? "s" : ""}
          </p>
        </div>
        <a
          href="/medicos"
          className="text-xs font-medium text-primary hover:text-primary-dark transition-colors min-h-[44px] flex items-center"
        >
          Ver todos →
        </a>
      </div>

      {activeDoctors.length === 0 ? (
        <div className="text-center py-6 sm:py-8">
          <span className="text-3xl block mb-2">🩺</span>
          <p className="text-sm text-slate-400">Nenhum médico ativo.</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-2.5">
          {activeDoctors.map((doctor) => {
            const available = isAvailableToday(doctor.schedule);
            return (
              <div
                key={doctor.id}
                className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-slate-50 transition-colors min-h-[48px]"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                  {doctor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{doctor.name}</p>
                  <p className="text-xs text-slate-500 truncate">{doctor.specialty_name}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    available ? "bg-success-light text-success" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {available ? "Hoje" : dayNames[today]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
