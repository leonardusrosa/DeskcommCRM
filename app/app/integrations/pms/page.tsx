import { PmsConnectionPanel } from "@/components/admin/pms/PmsConnectionPanel";

export const metadata = {
  title: "PMS Dental | Deskcomm",
};

export default function PmsIntegrationPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Integração PMS Dental</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure a coexistência administrativa entre o Deskcomm e o PMS da clínica.
        </p>
      </div>
      <PmsConnectionPanel />
    </main>
  );
}
