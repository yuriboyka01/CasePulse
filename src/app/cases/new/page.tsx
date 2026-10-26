import { CaseRegistrationForm } from '@/components/cases/CaseRegistrationForm';
import { WorkspaceHeader } from '@/components/common/WorkspaceHeader';

export default function NewCasePage() {
  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrows={<span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A5535]">Authorized intake</span>}
        title="Register a received case"
        subtitle="Add an existing complaint to the shared monitoring workspace for the bureau responsible for handling it."
      />
      <CaseRegistrationForm />
    </div>
  );
}
