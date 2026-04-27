import { buildClassTeacherPhoneTel } from "@/lib/phone-tel";

export function ParentClassTeacherContactLine(props: {
  teacherName: string;
  phone: string | null;
}) {
  const { teacherName, phone } = props;
  const tel = buildClassTeacherPhoneTel(phone);

  return (
    <p className="mt-2 text-xs font-medium text-slate-700 dark:text-zinc-300">
      <span>Class Teacher: {teacherName}</span>
      {" · "}
      {tel ? (
        <a
          href={tel.href}
          className="text-school-primary underline decoration-school-primary/40 underline-offset-2 hover:opacity-90"
        >
          {tel.display}
        </a>
      ) : (
        <span className="font-normal text-slate-500 dark:text-zinc-400">
          No phone number provided
        </span>
      )}
    </p>
  );
}
