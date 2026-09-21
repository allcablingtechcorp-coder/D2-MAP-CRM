import { useEffect, useState } from "react";
import { useCrmWorkspace } from "../application/CrmWorkspaceLive";
import { useRuntimeSession } from "../application/SessionRuntime";
import { useLifecycleText } from "../i18n/lifecycle";
export function TeamSelector({ value, onChange }: { value: string | null | undefined; onChange: (value: string | null) => void }) {
  const workspace = useCrmWorkspace(), runtime = useRuntimeSession(), l = useLifecycleText();
  const [teams, setTeams] = useState<{id:string; name:string}[]>([]), [error, setError] = useState(false);
  const required = runtime.membership?.scope === "assigned_teams";
  useEffect(() => { let active = true; workspace.assignmentOptions().then((options) => { if(active) { setTeams(options.teams); if(required && value === undefined && options.teams[0]) onChange(options.teams[0].id); } }).catch(() => { if(active) setError(true); }); return () => { active = false; }; }, []);
  return <label>{l.team}<select required={required} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}><option value="">{l.none}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{error && <small role="alert">{l.error}</small>}</label>;
}
